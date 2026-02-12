import { fetchLcboFeedFromSource } from "../src/lib/server/ingestion/adapters/lcboAdapter";
import { persistDeadLetters } from "../src/lib/server/ingestion/deadLetterStore";
import { syncLcboCatalog } from "../src/lib/server/ingestion/lcboSync";
import { prisma } from "../src/lib/server/db";

async function main() {
  let feed: unknown[] | null = null;
  try {
    const liveFeedResult = await fetchLcboFeedFromSource();
    if (liveFeedResult?.items && liveFeedResult.items.length > 0) {
      feed = liveFeedResult.items;
    }
    if (liveFeedResult?.deadLetters && liveFeedResult.deadLetters.length > 0) {
      await persistDeadLetters(liveFeedResult.deadLetters);
    }
  } catch (error) {
    console.warn("LCBO adapter failed. Keeping last-known-good catalog data.", error);
  }

  if (!feed) {
    console.warn("No LCBO real feed available. Skipping catalog sync to avoid overwriting with synthetic data.");
    return;
  }

  const result = await syncLcboCatalog(feed);
  console.log("LCBO sync completed:", result);
}

main()
  .catch((error) => {
    console.error("LCBO sync failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
