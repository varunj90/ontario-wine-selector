import { prisma } from "../src/lib/server/db";
import { MOCK_WINES } from "../src/lib/server/recommendations/mockData";

async function seed() {
  console.log("Seeding mock wines into database...");

  for (const wine of MOCK_WINES) {
    const store = await prisma.store.upsert({
      where: { lcboStoreCode: wine.storeId },
      update: {
        displayName: wine.storeLabel,
        isActive: true,
      },
      create: {
        lcboStoreCode: wine.storeId,
        displayName: wine.storeLabel,
        postalPrefix: "M5",
        city: "Toronto",
        province: "ON",
      },
    });

    const dbWine = await prisma.wine.upsert({
      where: {
        wine_identity_unique: {
          name: wine.name,
          producer: wine.producer,
          varietal: wine.varietal,
          country: wine.country,
          subRegion: wine.subRegion,
        },
      },
      update: {
        type: wine.type,
        fullRegionLabel: wine.region,
        lcboUrl: wine.lcboUrl,
        vivinoUrl: wine.vivinoUrl,
      },
      create: {
        name: wine.name,
        producer: wine.producer,
        type: wine.type,
        varietal: wine.varietal,
        country: wine.country,
        subRegion: wine.subRegion,
        fullRegionLabel: wine.region,
        lcboUrl: wine.lcboUrl,
        vivinoUrl: wine.vivinoUrl,
      },
    });

    await prisma.wineQualitySignal.deleteMany({
      where: { wineId: dbWine.id, source: "vivino" },
    });

    await prisma.wineQualitySignal.create({
      data: {
        wineId: dbWine.id,
        source: "vivino",
        rating: wine.rating,
        ratingCount: wine.ratingCount,
        confidenceScore: 0.85,
        fetchedAt: new Date(),
      },
    });

    await prisma.wineMarketData.deleteMany({
      where: { wineId: dbWine.id, storeId: store.id },
    });

    await prisma.wineMarketData.create({
      data: {
        wineId: dbWine.id,
        storeId: store.id,
        listedPriceCents: Math.round(wine.price * 100),
        inventoryQuantity: 24,
        inStock: wine.stockConfidence === "High",
        sourceUpdatedAt: new Date(),
      },
    });
  }

  console.log("Seed complete.");
}

seed()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
