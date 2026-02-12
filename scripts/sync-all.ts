import { fetchLcboFeedFromSource } from "../src/lib/server/ingestion/adapters/lcboAdapter";
import { fetchVivinoSignalsFromSource } from "../src/lib/server/ingestion/adapters/vivinoAdapter";
import { persistDeadLetters } from "../src/lib/server/ingestion/deadLetterStore";
import { syncLcboCatalog } from "../src/lib/server/ingestion/lcboSync";
import { syncVivinoSignals } from "../src/lib/server/ingestion/vivinoSync";
import { prisma } from "../src/lib/server/db";

async function main() {
  let catalogFeed: unknown[] | null = null;

  try {
    const liveCatalog = await fetchLcboFeedFromSource();
    if (liveCatalog?.items && liveCatalog.items.length > 0) {
      catalogFeed = liveCatalog.items;
    }
    if (liveCatalog?.deadLetters?.length) {
      await persistDeadLetters(liveCatalog.deadLetters);
    }
  } catch (error) {
    console.warn("LCBO adapter failed. Keeping last-known-good catalog data.", error);
  }

  let catalogResult: Awaited<ReturnType<typeof syncLcboCatalog>> | null = null;
  if (catalogFeed) {
    catalogResult = await syncLcboCatalog(catalogFeed);
  } else {
    console.warn("No LCBO real feed available. Skipping catalog sync to preserve existing dataset.");
  }

  let signalFeed: unknown[] | null = null;
  try {
    const liveSignals = await fetchVivinoSignalsFromSource();
    if (liveSignals?.items && liveSignals.items.length > 0) {
      signalFeed = liveSignals.items;
    }
    if (liveSignals?.deadLetters?.length) {
      await persistDeadLetters(liveSignals.deadLetters);
    }
  } catch (error) {
    console.warn("Vivino adapter failed. Keeping last-known-good signal data.", error);
  }

  let signalResult: Awaited<ReturnType<typeof syncVivinoSignals>> | null = null;
  if (signalFeed) {
    signalResult = await syncVivinoSignals(signalFeed);
  } else {
    console.warn("No Vivino real/snapshot feed available. Skipping signal sync to preserve existing dataset.");
  }

  console.log("All sync jobs completed:", { catalogResult, signalResult });
}

main()
  .catch((error) => {
    console.error("Sync-all failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
