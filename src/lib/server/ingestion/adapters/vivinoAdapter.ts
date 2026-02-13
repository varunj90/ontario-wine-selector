import { parse } from "csv-parse/sync";

import { prisma } from "@/lib/server/db";

import { fetchJsonWithRetry } from "../httpClient";
import type { DeadLetterRecord } from "../validation";

type UpstreamVivinoResponse = {
  signals?: unknown[];
};

type SnapshotRow = {
  brand: string;
  name: string;
  location: string;
  rating: number;
  ratingCount: number;
};

const DEFAULT_SNAPSHOT_URLS = [
  "https://raw.githubusercontent.com/Murphite/My-Vivino/main/vivino_dataset_red.csv",
  "https://raw.githubusercontent.com/Murphite/My-Vivino/main/vivino_dataset_white.csv",
  "https://raw.githubusercontent.com/Murphite/My-Vivino/main/vivino_dataset_rose.csv",
  "https://raw.githubusercontent.com/Murphite/My-Vivino/main/vivino_dataset_sparkling.csv",
  "https://raw.githubusercontent.com/Murphite/My-Vivino/main/vivino_dataset_dessert.csv",
  "https://raw.githubusercontent.com/Murphite/My-Vivino/main/vivino_dataset_fortified.csv",
];

const SNAPSHOT_MIN_MATCH_SCORE = Number(process.env.VIVINO_SNAPSHOT_MIN_MATCH_SCORE ?? "0.55");
const TRUSTED_MATCH_FLOOR = Number(process.env.VIVINO_SNAPSHOT_CONFIDENCE_FLOOR ?? "0.55");

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreMatch(a: string, b: string): number {
  const aTokens = new Set(normalize(a).split(" ").filter((token) => token.length > 2));
  const bTokens = new Set(normalize(b).split(" ").filter((token) => token.length > 2));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1;
  }

  const unionSize = aTokens.size + bTokens.size - overlap;
  return unionSize > 0 ? overlap / unionSize : 0;
}

function hasProducerTokenOverlap(producer: string, brand: string): boolean {
  const producerTokens = normalize(producer).split(" ").filter((token) => token.length > 2);
  const brandTokens = new Set(normalize(brand).split(" ").filter((token) => token.length > 2));
  if (producerTokens.length === 0 || brandTokens.size === 0) return false;
  return producerTokens.some((token) => brandTokens.has(token));
}

async function fetchTextWithRetry(url: string): Promise<string> {
  const retries = 2;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { "user-agent": "ontario-wine-selector/1.0" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }

  throw lastError ?? new Error(`Failed fetching CSV snapshot from ${url}`);
}

function parseSnapshotRows(csvText: string): SnapshotRow[] {
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
  }) as Array<Record<string, string>>;

  const rows: SnapshotRow[] = [];
  for (const record of records) {
    const brand = (record.Brand ?? "").trim();
    const name = (record.Name ?? "").replace(/\n+/g, " ").trim();
    const location = (record.Location ?? "").trim();
    const rating = Number.parseFloat((record.Rating ?? "").trim());
    const ratingCountRaw = (record["Number of Ratings"] ?? "").replace(/[^0-9]/g, "");
    const ratingCount = Number.parseInt(ratingCountRaw || "0", 10);

    if (!brand || !name || !Number.isFinite(rating)) {
      continue;
    }
    rows.push({
      brand,
      name,
      location,
      rating: Math.max(0, Math.min(5, rating)),
      ratingCount: Number.isFinite(ratingCount) ? ratingCount : 0,
    });
  }

  return rows;
}

async function loadVivinoSnapshotRows(deadLetters: DeadLetterRecord[]): Promise<SnapshotRow[]> {
  const configuredUrls = process.env.VIVINO_SNAPSHOT_URLS
    ? process.env.VIVINO_SNAPSHOT_URLS.split(",").map((url) => url.trim()).filter(Boolean)
    : DEFAULT_SNAPSHOT_URLS;

  const allRows: SnapshotRow[] = [];
  for (const url of configuredUrls) {
    try {
      const csvText = await fetchTextWithRetry(url);
      allRows.push(...parseSnapshotRows(csvText));
    } catch (error) {
      deadLetters.push({
        source: "vivino_signals",
        stage: "adapter",
        reason: error instanceof Error ? error.message : "Failed to load Vivino CSV snapshot",
        payload: { url },
      });
    }
  }

  return allRows;
}

/**
 * Minimum match score when producer is unknown and we can't validate the match
 * via producer/brand overlap. Higher threshold to reduce false positives.
 */
const UNKNOWN_PRODUCER_MIN_SCORE = Number(process.env.VIVINO_UNKNOWN_PRODUCER_MIN_SCORE ?? "0.62");

async function buildSignalsFromSnapshot(deadLetters: DeadLetterRecord[]) {
  const snapshotRows = await loadVivinoSnapshotRows(deadLetters);
  const wines = await prisma.wine.findMany({
    where: {
      lcboProductId: { not: null },
    },
    select: {
      lcboProductId: true,
      name: true,
      producer: true,
      country: true,
    },
    take: Number(process.env.VIVINO_SYNC_MAX_WINES ?? "5000"),
  });

  const signals: unknown[] = [];
  for (const wine of wines) {
    if (!wine.lcboProductId) continue;

    const isUnknownProducer = wine.producer === "Unknown Producer";

    // When producer is unknown, exclude it from the target to avoid noise
    // from "unknown" and "producer" tokens inflating/deflating Jaccard scores.
    const target = isUnknownProducer
      ? wine.name
      : `${wine.producer} ${wine.name}`;

    let best: SnapshotRow | null = null;
    let bestScore = 0;
    for (const row of snapshotRows) {
      const candidate = `${row.brand} ${row.name}`;
      let score = scoreMatch(target, candidate);
      if (wine.country && row.location.toLowerCase().includes(wine.country.toLowerCase())) {
        score += 0.08;
      }
      if (score > bestScore) {
        bestScore = score;
        best = row;
      }
    }

    if (!best) {
      continue;
    }

    // When we have real producer data, require token overlap with the CSV brand
    // to avoid matching the wrong producer's wine with the same name.
    // When producer is unknown, skip this gate but require a higher name score.
    if (!isUnknownProducer) {
      if (!hasProducerTokenOverlap(wine.producer, best.brand)) {
        continue;
      }
      if (bestScore < SNAPSHOT_MIN_MATCH_SCORE) {
        continue;
      }
    } else {
      if (bestScore < UNKNOWN_PRODUCER_MIN_SCORE) {
        continue;
      }
    }

    signals.push({
      externalId: wine.lcboProductId,
      source: "vivino",
      rating: Number(best.rating.toFixed(2)),
      ratingCount: best.ratingCount,
      confidenceScore: Math.max(TRUSTED_MATCH_FLOOR, Math.min(0.95, bestScore)),
      fetchedAt: new Date(),
    });
  }

  return signals;
}

export async function fetchVivinoSignalsFromSource(): Promise<{ items: unknown[]; deadLetters: DeadLetterRecord[] } | null> {
  const baseUrl = process.env.VIVINO_API_BASE_URL;
  const deadLetters: DeadLetterRecord[] = [];
  if (!baseUrl) {
    const snapshotItems = await buildSignalsFromSnapshot(deadLetters);
    return { items: snapshotItems, deadLetters };
  }

  const apiKey = process.env.VIVINO_API_KEY;
  const endpoint = `${baseUrl.replace(/\/$/, "")}/signals`;
  const payload = await fetchJsonWithRetry<UpstreamVivinoResponse>(endpoint, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
    retries: 2,
    retryBackoffMs: 700,
    rateLimitMs: 300,
  });
  if (!Array.isArray(payload.signals)) {
    deadLetters.push({
      source: "vivino_signals",
      stage: "adapter",
      reason: "Expected payload.signals to be an array",
      payload,
    });
    return { items: [], deadLetters };
  }
  return { items: payload.signals, deadLetters };
}
