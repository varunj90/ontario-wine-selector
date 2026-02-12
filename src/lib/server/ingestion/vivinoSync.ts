import { prisma } from "@/lib/server/db";

import { persistDeadLetters } from "./deadLetterStore";
import { validateSignalFeedItems } from "./validation";

export async function syncVivinoSignals(feed: unknown[]) {
  const { validItems, deadLetters } = validateSignalFeedItems(feed, "vivino_signals");

  const run = await prisma.ingestionRun.create({
    data: {
      source: "vivino_signals",
      status: "running",
      itemsRead: feed.length,
      metadata: { rejectedItems: deadLetters.length },
    },
  });

  await persistDeadLetters(deadLetters, run.id);

  let itemsWritten = 0;

  try {
    for (const item of validItems) {
      const wine = await prisma.wine.findUnique({
        where: { lcboProductId: item.externalId },
      });

      if (!wine) {
        continue;
      }

      await prisma.wineQualitySignal.deleteMany({
        where: { wineId: wine.id, source: item.source },
      });

      await prisma.wineQualitySignal.create({
        data: {
          wineId: wine.id,
          source: item.source,
          rating: item.rating,
          ratingCount: item.ratingCount,
          confidenceScore: item.confidenceScore,
          fetchedAt: item.fetchedAt,
        },
      });

      itemsWritten += 1;
    }

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: "completed",
        completedAt: new Date(),
        itemsWritten,
        metadata: { rejectedItems: deadLetters.length },
      },
    });
  } catch (error) {
    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        completedAt: new Date(),
        itemsWritten,
        errorMessage: error instanceof Error ? error.message : "Unknown Vivino sync failure",
        metadata: { rejectedItems: deadLetters.length },
      },
    });
    throw error;
  }

  return { runId: run.id, itemsRead: feed.length, itemsWritten, rejectedItems: deadLetters.length };
}
