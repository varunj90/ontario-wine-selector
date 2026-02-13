#!/usr/bin/env npx tsx
/**
 * Backfill script: fix LCBO URLs and producer names for all existing wines.
 *
 * Two-pass strategy:
 *
 * Pass 1 — Producer extraction (fast, no network)
 *   Uses extractProducer() to infer producers from wine names + known varietals.
 *
 * Pass 2 — LCBO URL correction (requires LCBO API)
 *   Paginates through the LCBO GraphQL API, matches products by SKU to our DB,
 *   and updates lcboUrl from the real externalId field.
 *   Also fixes vivinoUrl to remove "Unknown Producer" noise.
 *
 * Usage:
 *   npx tsx scripts/backfill-urls-producers.ts
 *   npx tsx scripts/backfill-urls-producers.ts --skip-api    # Skip Pass 2
 *   npx tsx scripts/backfill-urls-producers.ts --dry-run     # Preview changes
 */

import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { extractProducer } from "../src/lib/server/ingestion/extractProducer";
import { buildVivinoSearchUrl } from "../src/lib/server/recommendations/vivinoTrust";

// ── Prisma setup (same pattern as src/lib/server/db.ts) ───────────────────
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as never);

// ── CLI flags ──────────────────────────────────────────────────────────────
const args = new Set(process.argv.slice(2));
const skipApi = args.has("--skip-api");
const dryRun = args.has("--dry-run");

// ── LCBO GraphQL setup ────────────────────────────────────────────────────
const LCBO_ENDPOINT = process.env.LCBO_API_BASE_URL?.trim() || "https://api.lcbo.dev/graphql";
const RATE_LIMIT_MS = 400;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Pass 1: Producer extraction from wine names ──────────────────────────

async function pass1ProducerExtraction() {
  console.log("\n══════════════════════════════════════════════════════");
  console.log("  Pass 1: Producer extraction from wine names");
  console.log("══════════════════════════════════════════════════════\n");

  const wines = await prisma.wine.findMany({
    select: { id: true, name: true, producer: true, varietal: true, country: true },
  });

  console.log(`Total wines: ${wines.length}`);

  let updated = 0;
  let alreadyGood = 0;
  let stillUnknown = 0;
  let vivinoUrlFixed = 0;
  let collisions = 0;

  for (const wine of wines) {
    const newProducer = extractProducer(wine.name, wine.varietal);

    const producerChanged = wine.producer === "Unknown Producer" && newProducer !== "Unknown Producer";

    if (producerChanged) {
      // Also fix the vivinoUrl to remove "Unknown Producer" noise
      const cleanProducer = newProducer !== "Unknown Producer" ? newProducer : "";
      const newVivinoUrl = buildVivinoSearchUrl(wine.name, cleanProducer, wine.country);

      if (!dryRun) {
        try {
          await prisma.wine.update({
            where: { id: wine.id },
            data: {
              producer: newProducer,
              vivinoUrl: newVivinoUrl,
            },
          });
        } catch (error) {
          // P2002: changing the producer would collide with another wine's
          // identity constraint. Skip rather than crash the backfill.
          const code = (error as { code?: string } | null)?.code;
          if (code === "P2002") {
            collisions += 1;
            if (collisions <= 3) {
              console.log(`  ⚠ Constraint collision, skipped: "${wine.name}" → "${newProducer}"`);
            }
            continue;
          }
          throw error;
        }
      }
      updated += 1;
      vivinoUrlFixed += 1;

      if (updated <= 10) {
        console.log(`  ✓ "${wine.name}" → producer: "${newProducer}"`);
      }
    } else if (wine.producer !== "Unknown Producer") {
      // Producer was already set — but still fix vivinoUrl if it contains "Unknown+Producer"
      alreadyGood += 1;
    } else {
      stillUnknown += 1;
      if (stillUnknown <= 5) {
        console.log(`  ⚠ Could not extract producer: "${wine.name}" (varietal: ${wine.varietal})`);
      }
    }
  }

  console.log(`\n  Producers updated:       ${updated}`);
  console.log(`  Already had producer:    ${alreadyGood}`);
  console.log(`  Still unknown:           ${stillUnknown}`);
  console.log(`  Constraint collisions:   ${collisions}`);
  console.log(`  Vivino URLs cleaned:     ${vivinoUrlFixed}`);
  if (dryRun) console.log("  (DRY RUN — no DB writes)");
}

// ── Pass 2: LCBO URL correction via API ──────────────────────────────────

async function pass2LcboUrlCorrection() {
  console.log("\n══════════════════════════════════════════════════════");
  console.log("  Pass 2: LCBO URL correction via API externalId");
  console.log("══════════════════════════════════════════════════════\n");

  // Build a Set of all SKUs in our DB for fast lookup
  const winesWithSku = await prisma.wine.findMany({
    where: { lcboProductId: { not: null } },
    select: { id: true, lcboProductId: true, lcboUrl: true },
  });

  const skuMap = new Map<string, { id: string; lcboUrl: string | null }>();
  for (const w of winesWithSku) {
    if (w.lcboProductId) {
      skuMap.set(w.lcboProductId, { id: w.id, lcboUrl: w.lcboUrl });
    }
  }
  console.log(`  DB wines with LCBO SKU: ${skuMap.size}`);

  let pagesProcessed = 0;
  let urlsFixed = 0;
  let urlsAlreadyCorrect = 0;
  let productsNotInDb = 0;
  let hasNextPage = true;
  let cursor: string | null = null;

  while (hasNextPage) {
    const query = `
      query BackfillUrls($after: String) {
        products(
          filters: { categorySlug: "wine", isBuyable: true }
          pagination: { first: 20, after: $after }
        ) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              sku
              externalId
            }
          }
        }
      }
    `;

    const resp = await fetch(LCBO_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables: { after: cursor } }),
    });

    if (!resp.ok) {
      console.error(`  API error: ${resp.status} ${resp.statusText}`);
      break;
    }

    const json = (await resp.json()) as {
      data?: {
        products?: {
          pageInfo?: { hasNextPage: boolean; endCursor?: string | null };
          edges?: Array<{ node?: { sku?: string; externalId?: string } }>;
        };
      };
    };

    const products = json.data?.products;
    if (!products?.edges) {
      console.error("  Unexpected API response shape");
      break;
    }

    for (const edge of products.edges) {
      const node = edge?.node;
      if (!node?.sku || !node.externalId) continue;

      const dbWine = skuMap.get(node.sku);
      if (!dbWine) {
        productsNotInDb += 1;
        continue;
      }

      // Extract real URL from externalId
      const urlMatch = node.externalId.match(/\$(https:\/\/www\.lcbo\.com\/[^\s]+)/);
      if (!urlMatch) continue;

      const correctUrl = urlMatch[1];
      if (dbWine.lcboUrl === correctUrl) {
        urlsAlreadyCorrect += 1;
        continue;
      }

      if (!dryRun) {
        await prisma.wine.update({
          where: { id: dbWine.id },
          data: { lcboUrl: correctUrl },
        });
      }
      urlsFixed += 1;

      if (urlsFixed <= 5) {
        console.log(`  ✓ SKU ${node.sku}: ${dbWine.lcboUrl} → ${correctUrl}`);
      }
    }

    hasNextPage = Boolean(products.pageInfo?.hasNextPage);
    cursor = products.pageInfo?.endCursor ?? null;
    pagesProcessed += 1;

    if (pagesProcessed % 25 === 0) {
      console.log(`  ... processed ${pagesProcessed} pages, fixed ${urlsFixed} URLs so far`);
    }

    await sleep(RATE_LIMIT_MS);
  }

  console.log(`\n  Pages processed:           ${pagesProcessed}`);
  console.log(`  URLs fixed:                ${urlsFixed}`);
  console.log(`  URLs already correct:      ${urlsAlreadyCorrect}`);
  console.log(`  API products not in DB:    ${productsNotInDb}`);
  if (dryRun) console.log("  (DRY RUN — no DB writes)");
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║  Backfill: URLs + Producers                         ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  if (dryRun) console.log("  *** DRY RUN MODE ***");

  await pass1ProducerExtraction();

  if (skipApi) {
    console.log("\n  Skipping Pass 2 (--skip-api flag)");
  } else {
    await pass2LcboUrlCorrection();
  }

  // Summary: check final state
  const summary = await prisma.wine.groupBy({
    by: ["producer"],
    _count: true,
    orderBy: { _count: { producer: "desc" } },
    take: 20,
  });

  console.log("\n══════════════════════════════════════════════════════");
  console.log("  Top 20 producers after backfill:");
  console.log("══════════════════════════════════════════════════════");
  for (const row of summary) {
    console.log(`  ${row._count.toString().padStart(5)} × ${row.producer}`);
  }

  const unknownCount = await prisma.wine.count({ where: { producer: "Unknown Producer" } });
  const totalCount = await prisma.wine.count();
  console.log(`\n  Unknown producers remaining: ${unknownCount} / ${totalCount} (${((unknownCount / totalCount) * 100).toFixed(1)}%)`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
