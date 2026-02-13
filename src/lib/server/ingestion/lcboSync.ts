import { prisma } from "@/lib/server/db";

import { persistDeadLetters } from "./deadLetterStore";
import { validateCatalogFeedItems } from "./validation";

export async function syncLcboCatalog(feed: unknown[]) {
  const { validItems, deadLetters } = validateCatalogFeedItems(feed, "lcbo_catalog");

  const run = await prisma.ingestionRun.create({
    data: {
      source: "lcbo_catalog",
      status: "running",
      itemsRead: feed.length,
      metadata: { rejectedItems: deadLetters.length },
    },
  });

  await persistDeadLetters(deadLetters, run.id);

  let itemsWritten = 0;

  try {
    for (const item of validItems) {
      const store = await prisma.store.upsert({
        where: { lcboStoreCode: item.storeCode },
        update: {
          displayName: item.storeLabel,
          city: item.storeCity ?? undefined,
          latitude: item.storeLatitude ?? undefined,
          longitude: item.storeLongitude ?? undefined,
          isActive: true,
        },
        create: {
          lcboStoreCode: item.storeCode,
          displayName: item.storeLabel,
          city: item.storeCity ?? "Unknown",
          province: "ON",
          latitude: item.storeLatitude ?? undefined,
          longitude: item.storeLongitude ?? undefined,
        },
      });

      const identityWhere = {
        name: item.name,
        producer: item.producer,
        varietal: item.varietal,
        country: item.country,
        subRegion: item.subRegion,
      };

      let wine;
      try {
        wine = await prisma.wine.upsert({
          where: { lcboProductId: item.externalId },
          update: {
            name: item.name,
            producer: item.producer,
            type: item.type,
            varietal: item.varietal,
            country: item.country,
            subRegion: item.subRegion,
            fullRegionLabel: item.regionLabel,
            lcboUrl: item.lcboUrl,
            vivinoUrl: item.vivinoUrl,
          },
          create: {
            lcboProductId: item.externalId,
            name: item.name,
            producer: item.producer,
            type: item.type,
            varietal: item.varietal,
            country: item.country,
            subRegion: item.subRegion,
            fullRegionLabel: item.regionLabel,
            lcboUrl: item.lcboUrl,
            vivinoUrl: item.vivinoUrl,
          },
        });
      } catch (error) {
        // Rare identity collision fallback keeps full sync resilient without slowing every row.
        const errorCode = (error as { code?: string } | null)?.code;
        if (errorCode === "P2002") {
          const byIdentity = await prisma.wine.findUnique({
            where: { name_producer_varietal_country_subRegion: identityWhere },
          });
          if (!byIdentity) throw error;
          wine = await prisma.wine.update({
            where: { id: byIdentity.id },
            data: {
              lcboProductId: byIdentity.lcboProductId ?? item.externalId,
              name: item.name,
              producer: item.producer,
              type: item.type,
              varietal: item.varietal,
              country: item.country,
              subRegion: item.subRegion,
              fullRegionLabel: item.regionLabel,
              lcboUrl: item.lcboUrl,
              vivinoUrl: item.vivinoUrl,
            },
          });
        } else {
          throw error;
        }
      }

      await prisma.wineMarketData.deleteMany({
        where: { wineId: wine.id, storeId: store.id },
      });

      await prisma.wineMarketData.create({
        data: {
          wineId: wine.id,
          storeId: store.id,
          listedPriceCents: item.listedPriceCents,
          inventoryQuantity: item.inventoryQuantity,
          inStock: item.inStock,
          sourceUpdatedAt: item.sourceUpdatedAt,
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
        errorMessage: error instanceof Error ? error.message : "Unknown LCBO sync failure",
        metadata: { rejectedItems: deadLetters.length },
      },
    });
    throw error;
  }

  return { runId: run.id, itemsRead: feed.length, itemsWritten, rejectedItems: deadLetters.length };
}
