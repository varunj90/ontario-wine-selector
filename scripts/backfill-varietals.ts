/**
 * One-off migration: recompute the `varietal` column for every existing Wine
 * row using two strategies:
 *
 * 1. Fast name-based extraction (no network)
 * 2. LCBO product page scraping for wines still tagged "Blend" (authoritative)
 *
 * Run with:  npx tsx scripts/backfill-varietals.ts
 *            npx tsx scripts/backfill-varietals.ts --skip-scrape   (fast mode)
 *
 * Safe to re-run — it only updates wines whose varietal would change.
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { extractVarietal } from "../src/lib/server/ingestion/extractVarietal";
import { scrapeLcboVarietal } from "../src/lib/server/ingestion/scrapeLcboVarietal";

const SCRAPE_DELAY_MS = 300; // rate-limit between LCBO page fetches
const skipScrape = process.argv.includes("--skip-scrape");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Please check your .env file.");
  process.exit(1);
}
const adapter = new PrismaPg(new Pool({ connectionString }));
const prisma = new PrismaClient({ adapter });

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const wines = await prisma.wine.findMany({
    select: { id: true, name: true, varietal: true, lcboUrl: true },
  });

  console.log(`Found ${wines.length} wines. Running name-based extraction…\n`);

  let updatedByName = 0;
  let skippedName = 0;
  let collisions = 0;
  const blendWines: typeof wines = [];

  // ── Pass 1: name-based extraction (instant, no network) ────────────────
  for (const wine of wines) {
    const newVarietal = extractVarietal(wine.name);

    if (newVarietal === wine.varietal) {
      if (newVarietal === "Blend") blendWines.push(wine);
      skippedName += 1;
      continue;
    }

    // If extraction returns "Blend" but current varietal is short & specific, keep it.
    if (newVarietal === "Blend" && wine.varietal.length <= 30) {
      blendWines.push(wine);
      skippedName += 1;
      continue;
    }

    // If extraction returns "Blend" and current is a long description, still push to
    // scrape pass (better to get authoritative data than guess).
    if (newVarietal === "Blend") {
      blendWines.push(wine);
      skippedName += 1;
      continue;
    }

    try {
      await prisma.wine.update({
        where: { id: wine.id },
        data: { varietal: newVarietal },
      });
      updatedByName += 1;
      if (updatedByName <= 25) {
        console.log(`  ✓ "${wine.name}" → "${newVarietal}"`);
      }
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === "P2002") {
        collisions += 1;
      } else {
        throw error;
      }
    }
  }

  console.log(`\nPass 1 (name extraction): Updated ${updatedByName}, Skipped ${skippedName}, Collisions ${collisions}`);
  console.log(`Wines still "Blend" or undetermined: ${blendWines.length}`);

  // ── Pass 2: LCBO page scraping for remaining "Blend" wines ─────────────
  if (skipScrape) {
    console.log("\n--skip-scrape flag set. Skipping LCBO page scraping.");
  } else if (blendWines.length > 0) {
    console.log(`\nPass 2: Scraping LCBO product pages for ${blendWines.length} wines…`);
    let updatedByScrape = 0;
    let scrapeErrors = 0;
    let scrapeNull = 0;
    let scrapedCollisions = 0;

    for (let i = 0; i < blendWines.length; i++) {
      const wine = blendWines[i]!;
      const url = wine.lcboUrl;
      if (!url || url.includes("catalogsearch")) {
        scrapeNull += 1;
        continue;
      }

      const varietal = await scrapeLcboVarietal(url);
      if (!varietal) {
        scrapeNull += 1;
        if (i < 5) console.log(`  ✗ No varietal found: "${wine.name}" (${url})`);
        await sleep(SCRAPE_DELAY_MS);
        continue;
      }

      if (varietal === wine.varietal) {
        await sleep(SCRAPE_DELAY_MS);
        continue;
      }

      try {
        await prisma.wine.update({
          where: { id: wine.id },
          data: { varietal },
        });
        updatedByScrape += 1;
        if (updatedByScrape <= 25) {
          console.log(`  ✓ "${wine.name}" → "${varietal}" (scraped)`);
        }
      } catch (error) {
        const code = (error as { code?: string } | null)?.code;
        if (code === "P2002") {
          scrapedCollisions += 1;
        } else {
          scrapeErrors += 1;
          console.error(`  ✗ Error updating "${wine.name}":`, error);
        }
      }

      // Progress reporting
      if ((i + 1) % 100 === 0) {
        console.log(`  … scraped ${i + 1}/${blendWines.length} (updated: ${updatedByScrape})`);
      }

      await sleep(SCRAPE_DELAY_MS);
    }

    console.log(`\nPass 2 (scraping): Updated ${updatedByScrape}, No varietal ${scrapeNull}, Errors ${scrapeErrors}, Collisions ${scrapedCollisions}`);
  }

  // ── Summary ────────────────────────────────────────────────────────────
  const finalCounts = await prisma.wine.groupBy({
    by: ["varietal"],
    _count: true,
    orderBy: { _count: { varietal: "desc" } },
    take: 20,
  });

  console.log("\n=== Top 20 varietal values after backfill ===");
  for (const row of finalCounts) {
    console.log(`  ${row._count} × ${row.varietal}`);
  }

  const blendCount = await prisma.wine.count({ where: { varietal: "Blend" } });
  const total = await prisma.wine.count();
  console.log(`\nTotal wines: ${total}, Still "Blend": ${blendCount} (${((blendCount / total) * 100).toFixed(1)}%)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
