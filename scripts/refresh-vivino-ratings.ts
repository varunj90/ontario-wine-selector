#!/usr/bin/env npx tsx
/**
 * Vivino Rating Refresh & New Match Discovery
 *
 * Phase 1: Refresh ratings for wines that already have a direct Vivino URL.
 *          Fetches the actual Vivino wine page and extracts the current live
 *          rating from JSON-LD (schema.org) data.
 *
 * Phase 2: Find new matches for unmatched LCBO wines by searching the Vivino
 *          explore API with the wine_name filter (winery-level), then verifying
 *          each match by fetching the wine page for the live rating.
 *
 * Usage:
 *   npx tsx scripts/refresh-vivino-ratings.ts
 *   npx tsx scripts/refresh-vivino-ratings.ts --dry-run
 *   npx tsx scripts/refresh-vivino-ratings.ts --phase=1   # refresh only
 *   npx tsx scripts/refresh-vivino-ratings.ts --phase=2   # new matches only
 */

import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// ── Prisma ─────────────────────────────────────────────────────────
const connectionString = process.env.DATABASE_URL;
if (!connectionString) { console.error("DATABASE_URL not set"); process.exit(1); }
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as never);

// ── CLI ────────────────────────────────────────────────────────────
const argv = new Set(process.argv.slice(2));
const dryRun = argv.has("--dry-run");
const phaseArg = process.argv.find((a) => a.startsWith("--phase="));
const runPhase = phaseArg ? Number(phaseArg.split("=")[1]) : 0; // 0 = both

// ── Config ─────────────────────────────────────────────────────────
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const RATE_MS = 600; // be polite — Vivino wine pages are heavier than API
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Types ──────────────────────────────────────────────────────────

type LiveRating = {
  rating: number;
  ratingCount: number;
  canonicalUrl: string | null; // /w/{id} URL if found
  wineId: number | null;
};

// ── Fetch live rating from a Vivino wine page ──────────────────────

async function fetchLiveRating(vivinoUrl: string): Promise<LiveRating | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 15_000);

  try {
    const resp = await fetch(vivinoUrl, {
      headers: { "User-Agent": UA, "Accept": "text/html" },
      signal: ac.signal,
      redirect: "follow",
    });
    clearTimeout(timer);

    if (!resp.ok) return null;

    const html = await resp.text();

    // Extract rating from JSON-LD (most reliable)
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    let rating = 0;
    let ratingCount = 0;

    if (jsonLdMatch) {
      try {
        const ld = JSON.parse(jsonLdMatch[1]);
        if (ld.aggregateRating) {
          rating = parseFloat(ld.aggregateRating.ratingValue) || 0;
          ratingCount = parseInt(ld.aggregateRating.reviewCount, 10) || 0;
        }
      } catch { /* ignore parse error */ }
    }

    // Fallback: extract from raw HTML patterns
    if (!rating) {
      const rMatch = html.match(/ratingValue["']?\s*[:=]\s*["']?([0-9.]+)/i);
      const cMatch = html.match(/reviewCount["']?\s*[:=]\s*["']?([0-9]+)/i);
      rating = rMatch ? parseFloat(rMatch[1]) : 0;
      ratingCount = cMatch ? parseInt(cMatch[1], 10) : 0;
    }

    // Also try ratings_average (more granular count)
    const avgMatch = html.match(/ratings_count["']?\s*[:=]\s*["']?([0-9]+)/i);
    if (avgMatch) {
      const fullCount = parseInt(avgMatch[1], 10);
      if (fullCount > ratingCount) ratingCount = fullCount;
    }

    // Extract canonical URL (the /w/{id} link)
    const canonicalMatch = html.match(/href="(\/w\/[0-9]+)"/);
    const finalUrl = resp.url; // after redirects
    const wineIdMatch = finalUrl.match(/\/w\/([0-9]+)/);
    const canonicalUrl = canonicalMatch
      ? `https://www.vivino.com${canonicalMatch[1]}`
      : wineIdMatch
        ? `https://www.vivino.com/w/${wineIdMatch[1]}`
        : null;
    const wineId = wineIdMatch ? parseInt(wineIdMatch[1], 10) : null;

    if (rating <= 0) return null;

    return { rating, ratingCount, canonicalUrl, wineId };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 1: Refresh existing matched wines
// ═══════════════════════════════════════════════════════════════════

async function phase1Refresh() {
  console.log("── Phase 1: Refreshing ratings for matched wines ──\n");

  // Get all wines with direct (non-search) Vivino URLs
  const wines = await prisma.wine.findMany({
    where: {
      vivinoUrl: { not: null },
      NOT: { vivinoUrl: { contains: "/search/wines" } },
    },
    include: {
      qualitySignals: {
        where: { source: "vivino" },
        orderBy: [{ fetchedAt: "desc" }],
        take: 1,
      },
    },
  });

  console.log(`  Wines with direct Vivino URLs: ${wines.length}\n`);

  let refreshed = 0;
  let failed = 0;
  let unchanged = 0;
  let ratingChanges: { name: string; old: number; new_: number; oldCount: number; newCount: number }[] = [];

  for (const [i, wine] of wines.entries()) {
    const oldSignal = wine.qualitySignals[0];
    const oldRating = oldSignal?.rating ?? 0;
    const oldCount = oldSignal?.ratingCount ?? 0;

    const live = await fetchLiveRating(wine.vivinoUrl!);

    if (!live) {
      failed++;
      if ((i + 1) % 50 === 0 || i < 5) console.log(`  [${i + 1}/${wines.length}] ✗ ${wine.name} — fetch failed`);
      await sleep(RATE_MS);
      continue;
    }

    const ratingChanged = Math.abs(live.rating - oldRating) >= 0.05;
    const countChanged = Math.abs(live.ratingCount - oldCount) > 10;

    if (ratingChanged || countChanged) {
      ratingChanges.push({ name: wine.name, old: oldRating, new_: live.rating, oldCount: oldCount, newCount: live.ratingCount });

      if (!dryRun) {
        // Update signal
        if (oldSignal) {
          await prisma.wineQualitySignal.update({
            where: { id: oldSignal.id },
            data: {
              rating: live.rating,
              ratingCount: live.ratingCount,
              fetchedAt: new Date(),
            },
          });
        } else {
          await prisma.wineQualitySignal.create({
            data: {
              wineId: wine.id,
              source: "vivino",
              rating: live.rating,
              ratingCount: live.ratingCount,
              confidenceScore: 0.95, // verified live
              fetchedAt: new Date(),
            },
          });
        }

        // Update canonical URL if we found one
        if (live.canonicalUrl) {
          await prisma.wine.update({
            where: { id: wine.id },
            data: { vivinoUrl: live.canonicalUrl },
          });
        }
      }

      refreshed++;
    } else {
      unchanged++;
    }

    if ((i + 1) % 50 === 0 || i < 5) {
      const marker = ratingChanged ? `⚡ ${oldRating} → ${live.rating}` : "✓";
      console.log(`  [${i + 1}/${wines.length}] ${marker} ${wine.name} | ${live.rating}/5 (${live.ratingCount} reviews)`);
    }

    await sleep(RATE_MS);
  }

  console.log(`\n  Phase 1 results:`);
  console.log(`    Refreshed: ${refreshed}`);
  console.log(`    Unchanged: ${unchanged}`);
  console.log(`    Failed: ${failed}`);

  if (ratingChanges.length > 0) {
    console.log(`\n  Rating changes (${ratingChanges.length}):`);
    ratingChanges.slice(0, 20).forEach((c) => {
      console.log(`    ${c.name}: ${c.old} → ${c.new_} (${c.oldCount} → ${c.newCount} reviews)`);
    });
    if (ratingChanges.length > 20) console.log(`    ... and ${ratingChanges.length - 20} more`);
  }

  return { refreshed, failed, unchanged };
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 2: Find new matches for unmatched wines
// ═══════════════════════════════════════════════════════════════════

// Normalise for comparison
function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function tokensOf(s: string): Set<string> {
  const STOP = new Set(["the", "de", "di", "du", "le", "la", "les", "von", "van", "vqa", "doc", "docg", "igt", "aoc", "aop"]);
  return new Set(
    normalise(s).split(" ").filter((t) => t.length > 1 && !STOP.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

async function fetchExploreByWinery(wineryId: number, page: number = 1): Promise<{ wines: { id: number; name: string; wineryName: string; seoName: string; rating: number; ratingCount: number }[]; total: number }> {
  const params = new URLSearchParams({
    country_code: "CA", currency_code: "CAD",
    winery_id: String(wineryId),
    page: String(page), per_page: "50",
  });

  try {
    const resp = await fetch(`https://www.vivino.com/api/explore/explore?${params}`, {
      headers: { "User-Agent": UA },
    });
    if (!resp.ok) return { wines: [], total: 0 };

    const json = (await resp.json()) as any;
    const ev = json.explore_vintage ?? {};
    const wines = (ev.matches ?? []).map((m: any) => {
      const v = m.vintage;
      const w = v?.wine;
      return {
        id: w?.id,
        name: w?.name ?? "",
        wineryName: w?.winery?.name ?? "",
        seoName: w?.seo_name ?? "",
        rating: w?.statistics?.wine_ratings_average ?? 0,
        ratingCount: w?.statistics?.wine_ratings_count ?? 0,
      };
    }).filter((w: any) => w.id);

    return { wines, total: ev.records_matched ?? 0 };
  } catch {
    return { wines: [], total: 0 };
  }
}

async function phase2NewMatches() {
  console.log("\n── Phase 2: Finding new Vivino matches ─────────────\n");

  // Get wines without a direct Vivino URL (those needing matches)
  const unmatched = await prisma.wine.findMany({
    where: {
      OR: [
        { vivinoUrl: null },
        { vivinoUrl: { contains: "/search/wines" } },
      ],
    },
    select: { id: true, name: true, producer: true, country: true },
  });

  console.log(`  Unmatched wines: ${unmatched.length}`);

  // Group by producer
  const byProducer = new Map<string, typeof unmatched>();
  for (const w of unmatched) {
    if (w.producer === "Unknown Producer") continue;
    const key = normalise(w.producer);
    if (!key || key.length < 2) continue;
    if (!byProducer.has(key)) byProducer.set(key, []);
    byProducer.get(key)!.push(w);
  }

  console.log(`  Unique producers to search: ${byProducer.size}`);

  // Get existing winery map from our synced data (wines that already have matches)
  // We'll look up their winery IDs from the explore API
  const matchedWines = await prisma.wine.findMany({
    where: {
      vivinoUrl: { not: null },
      NOT: { vivinoUrl: { contains: "/search/wines" } },
    },
    include: {
      qualitySignals: {
        where: { source: "vivino" },
        take: 1,
      },
    },
    select: { id: true, name: true, producer: true, vivinoUrl: true },
  });

  // For each producer group, try to find wines via the explore API
  // We use winery-level search by trying different explore parameters
  let newMatches = 0;
  let producersSearched = 0;
  let producersWithResults = 0;
  const claimedVivinoIds = new Set<number>();

  // Pre-claim already matched wine IDs
  for (const w of matchedWines) {
    const idMatch = w.vivinoUrl?.match(/\/w\/([0-9]+)/);
    if (idMatch) claimedVivinoIds.add(parseInt(idMatch[1], 10));
  }

  for (const [prodNorm, wines] of byProducer) {
    producersSearched++;

    // Try to find this producer's wines on Vivino explore
    // The explore API doesn't have a text search, so we use winery_id
    // We need to find the winery ID first — look it up by fetching the explore API
    // sorted by winery name match

    // For now, we try to find a matching wine from our already-fetched catalog
    // The winery expansion already tried this in the sync script, so most easy matches
    // are already done. For Phase 2, we do per-wine page lookups.

    for (const lcboWine of wines) {
      // Build the search URL that we already store as vivinoUrl for unmatched wines
      const nameForSearch = lcboWine.name;
      const producerForSearch = lcboWine.producer === "Unknown Producer" ? "" : lcboWine.producer;
      const nameIncludes = producerForSearch && nameForSearch.toLowerCase().includes(producerForSearch.toLowerCase());
      const parts = nameIncludes ? [nameForSearch] : [producerForSearch, nameForSearch].filter(Boolean);
      const searchQuery = parts.join(" ");
      const searchUrl = `https://www.vivino.com/search/wines?q=${encodeURIComponent(searchQuery)}`;

      // We can't scrape the search results (CSR), but we CAN use the explore API
      // with a winery lookup. For this phase, we try fetching the search URL
      // and see if it redirects to a specific wine page.
      try {
        const resp = await fetch(searchUrl, {
          headers: { "User-Agent": UA, "Accept": "text/html" },
          redirect: "follow",
        });

        if (!resp.ok) { await sleep(RATE_MS); continue; }

        const finalUrl = resp.url;
        const html = await resp.text();

        // Check if we landed on a specific wine page (not search results)
        if (finalUrl.includes("/w/") || (!finalUrl.includes("/search/") && finalUrl.match(/vivino\.com\/[^/]+\/[^/]+-/))) {
          // We're on a wine page! Extract rating
          const jsonLdMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
          if (jsonLdMatch) {
            try {
              const ld = JSON.parse(jsonLdMatch[1]);
              if (ld.aggregateRating && ld.name) {
                const rating = parseFloat(ld.aggregateRating.ratingValue) || 0;
                const ratingCount = parseInt(ld.aggregateRating.reviewCount, 10) || 0;
                const vivinoName = ld.name;

                // Verify the match is reasonable
                const lcboTokens = tokensOf(lcboWine.name);
                const vivinoTokens = tokensOf(vivinoName);
                const sim = jaccard(lcboTokens, vivinoTokens);

                if (sim >= 0.3 && rating > 0) {
                  // Extract wine ID
                  const wineIdMatch = finalUrl.match(/\/w\/([0-9]+)/);
                  const wineId = wineIdMatch ? parseInt(wineIdMatch[1], 10) : null;

                  // Enforce 1:1
                  if (wineId && claimedVivinoIds.has(wineId)) {
                    await sleep(RATE_MS);
                    continue;
                  }
                  if (wineId) claimedVivinoIds.add(wineId);

                  const canonicalUrl = wineId ? `https://www.vivino.com/w/${wineId}` : finalUrl;

                  if (!dryRun) {
                    // Create/update signal
                    await prisma.wineQualitySignal.deleteMany({ where: { wineId: lcboWine.id, source: "vivino" } });
                    await prisma.wineQualitySignal.create({
                      data: {
                        wineId: lcboWine.id,
                        source: "vivino",
                        rating,
                        ratingCount,
                        confidenceScore: 0.90, // search redirect = high confidence
                        fetchedAt: new Date(),
                      },
                    });
                    await prisma.wine.update({
                      where: { id: lcboWine.id },
                      data: { vivinoUrl: canonicalUrl },
                    });
                  }

                  newMatches++;
                  if (newMatches <= 20) {
                    console.log(`  ✓ "${lcboWine.name}" → "${vivinoName}" | ${rating}/5 (${ratingCount} reviews) [sim=${sim.toFixed(2)}]`);
                  }
                }
              }
            } catch { /* ignore */ }
          }
        }
      } catch { /* timeout or network error */ }

      await sleep(RATE_MS);

      // Progress logging
      if (producersSearched % 50 === 0) {
        console.log(`  ... ${producersSearched}/${byProducer.size} producers, ${newMatches} new matches`);
      }
    }
  }

  console.log(`\n  Phase 2 results:`);
  console.log(`    Producers searched: ${producersSearched}`);
  console.log(`    New matches found: ${newMatches}`);

  return { newMatches, producersSearched };
}

// ═══════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   Vivino Rating Refresh & Match Discovery        ║");
  console.log("╚══════════════════════════════════════════════════╝");
  if (dryRun) console.log("  *** DRY RUN ***\n");

  let p1 = { refreshed: 0, failed: 0, unchanged: 0 };
  let p2 = { newMatches: 0, producersSearched: 0 };

  if (runPhase === 0 || runPhase === 1) {
    p1 = await phase1Refresh();
  }

  if (runPhase === 0 || runPhase === 2) {
    p2 = await phase2NewMatches();
  }

  console.log("\n══════════════════════════════════════════════════");
  console.log("  FINAL RESULTS");
  console.log("══════════════════════════════════════════════════");
  if (runPhase === 0 || runPhase === 1) {
    console.log(`  Phase 1 — Rating refresh`);
    console.log(`    Refreshed: ${p1.refreshed} | Unchanged: ${p1.unchanged} | Failed: ${p1.failed}`);
  }
  if (runPhase === 0 || runPhase === 2) {
    console.log(`  Phase 2 — New matches`);
    console.log(`    New: ${p2.newMatches} from ${p2.producersSearched} producers`);
  }
  if (dryRun) console.log("  (DRY RUN — no changes written)");

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
