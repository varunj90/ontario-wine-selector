/**
 * Cleanup script: purge N:1 false Vivino matches.
 *
 * Problem: the sync-vivino-explore script matched multiple LCBO wines to the
 * same Vivino wine (same vivinoUrl), giving them all the same rating.
 * E.g. 25 different Henry of Pelham wines all pointing to a single Baco Noir.
 *
 * Strategy:
 *   1. Group all wines by their vivinoUrl (excluding search URLs).
 *   2. For groups with >1 wine:
 *      a. Keep the one with the highest confidence score.
 *      b. Delete quality signals for the rest.
 *      c. Reset their vivinoUrl to null (so the app generates a search URL).
 *   3. Report results.
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

const { Pool } = pg;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const DRY_RUN = process.argv.includes("--dry-run");
  if (DRY_RUN) console.log("=== DRY RUN — no changes will be written ===\n");

  // Step 1: Fetch all wines with non-search Vivino URLs and their signals
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

  console.log(`Total wines with direct Vivino URLs: ${wines.length}`);

  // Step 2: Group by vivinoUrl
  const groups = new Map<string, typeof wines>();
  for (const wine of wines) {
    const url = wine.vivinoUrl!;
    if (!groups.has(url)) groups.set(url, []);
    groups.get(url)!.push(wine);
  }

  const uniqueGroups = [...groups.values()].filter((g) => g.length === 1);
  const dupeGroups = [...groups.values()].filter((g) => g.length > 1);

  console.log(`Unique 1:1 matches: ${uniqueGroups.length}`);
  console.log(`N:1 duplicate groups: ${dupeGroups.length}`);
  console.log(
    `Wines in duplicate groups: ${dupeGroups.reduce((s, g) => s + g.length, 0)}`,
  );

  // Step 3: For each duplicate group, keep the best match
  let signalsDeleted = 0;
  let urlsReset = 0;
  let kept = 0;

  for (const group of dupeGroups) {
    // Sort by confidence (highest first), then by signal existence
    group.sort((a, b) => {
      const confA = a.qualitySignals[0]?.confidenceScore ?? 0;
      const confB = b.qualitySignals[0]?.confidenceScore ?? 0;
      return confB - confA;
    });

    const bestMatch = group[0];
    const losers = group.slice(1);

    kept++;
    if (DRY_RUN) {
      console.log(
        `\n[KEEP] ${bestMatch.name} (conf: ${bestMatch.qualitySignals[0]?.confidenceScore?.toFixed(3) ?? "none"})`,
      );
      console.log(`  URL: ${bestMatch.vivinoUrl}`);
    }

    for (const loser of losers) {
      if (DRY_RUN) {
        console.log(
          `  [PURGE] ${loser.name} (conf: ${loser.qualitySignals[0]?.confidenceScore?.toFixed(3) ?? "none"})`,
        );
      }

      if (!DRY_RUN) {
        // Delete quality signals for this wine
        const deleted = await prisma.wineQualitySignal.deleteMany({
          where: { wineId: loser.id, source: "vivino" },
        });
        signalsDeleted += deleted.count;

        // Reset vivinoUrl to null (resolveVivinoUrl will generate a search URL)
        await prisma.wine.update({
          where: { id: loser.id },
          data: { vivinoUrl: null },
        });
        urlsReset++;
      } else {
        signalsDeleted += loser.qualitySignals.length;
        urlsReset++;
      }
    }
  }

  console.log(`\n=== ${DRY_RUN ? "DRY RUN " : ""}Results ===`);
  console.log(`Kept (best match per group): ${kept}`);
  console.log(`Signals deleted: ${signalsDeleted}`);
  console.log(`Vivino URLs reset: ${urlsReset}`);
  console.log(`Remaining clean 1:1 matches: ${uniqueGroups.length + kept}`);

  // Step 4: Final verification (only in live mode)
  if (!DRY_RUN) {
    const remainingSignals = await prisma.wineQualitySignal.count({
      where: { source: "vivino" },
    });
    const remainingDirectUrls = await prisma.wine.count({
      where: {
        vivinoUrl: { not: null },
        NOT: { vivinoUrl: { contains: "/search/wines" } },
      },
    });
    console.log(`\n=== Post-cleanup verification ===`);
    console.log(`Remaining Vivino signals: ${remainingSignals}`);
    console.log(`Remaining direct Vivino URLs: ${remainingDirectUrls}`);
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
