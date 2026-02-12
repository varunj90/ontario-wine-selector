import { fetchVivinoSignalsFromSource } from "../src/lib/server/ingestion/adapters/vivinoAdapter";
import { persistDeadLetters } from "../src/lib/server/ingestion/deadLetterStore";
import { syncVivinoSignals } from "../src/lib/server/ingestion/vivinoSync";
import { prisma } from "../src/lib/server/db";

async function main() {
  let feed: unknown[] | null = null;
  try {
    const liveFeedResult = await fetchVivinoSignalsFromSource();
    if (liveFeedResult?.items && liveFeedResult.items.length > 0) {
      feed = liveFeedResult.items;
    }
    if (liveFeedResult?.deadLetters && liveFeedResult.deadLetters.length > 0) {
      await persistDeadLetters(liveFeedResult.deadLetters);
    }
  } catch (error) {
    console.warn("Vivino adapter failed. Keeping last-known-good signal data.", error);
  }

  if (!feed) {
    console.warn("No Vivino real/snapshot feed available. Skipping signal sync to avoid synthetic fallback.");
    return;
  }

  const result = await syncVivinoSignals(feed);
  console.log("Vivino sync completed:", result);
}

main()
  .catch((error) => {
    console.error("Vivino sync failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
