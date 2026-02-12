import { prisma } from "@/lib/server/db";

import type { WineCatalogProvider } from "./providers";
import type { RecommendationFilterInput, RecommendationWine } from "./types";

function fallbackLcboUrl(wineName: string, producer: string) {
  return `https://www.lcbo.com/en/catalogsearch/result/?q=${encodeURIComponent(`"${wineName} ${producer}"`)}`;
}

export class PrismaWineCatalogProvider implements WineCatalogProvider {
  async listCandidates(filters: RecommendationFilterInput): Promise<RecommendationWine[]> {
    const wines = await prisma.wine.findMany({
      include: {
        qualitySignals: {
          where: { source: "vivino" },
          orderBy: [{ fetchedAt: "desc" }],
          take: 1,
        },
        marketData: {
          include: { store: true },
          orderBy: [{ sourceUpdatedAt: "desc" }],
        },
      },
      take: 500,
    });

    return wines
      .map((wine) => {
        const signal = wine.qualitySignals[0];
        const preferredMarket = filters.storeId
          ? wine.marketData.find((entry) => {
              const code = entry.store.lcboStoreCode ?? entry.store.id;
              return code === filters.storeId;
            })
          : null;
        const market = preferredMarket ?? wine.marketData[0];
        if (!signal || !market) return null;

        return {
          id: wine.id,
          name: wine.name,
          producer: wine.producer,
          type: wine.type as RecommendationWine["type"],
          varietal: wine.varietal,
          country: wine.country,
          subRegion: wine.subRegion,
          region: wine.fullRegionLabel,
          price: market.listedPriceCents / 100,
          rating: signal.rating,
          ratingCount: signal.ratingCount,
          matchScore: Math.max(3.5, Math.min(5, signal.rating + signal.confidenceScore * 0.3)),
          stockConfidence: market.inStock ? "High" : "Medium",
          why: [
            `Vivino ${signal.rating.toFixed(1)} with ${signal.ratingCount} reviews`,
            market.inStock ? "Available based on latest inventory sync" : "Inventory can change quickly by store",
            `Source refreshed ${signal.fetchedAt.toISOString().slice(0, 10)}`,
          ],
          storeId: market.store.lcboStoreCode ?? market.store.id,
          storeLabel: market.store.displayName,
          lcboUrl: wine.lcboUrl ?? fallbackLcboUrl(wine.name, wine.producer),
          lcboLinkType: wine.lcboUrl && wine.lcboUrl.includes("/en/") && !wine.lcboUrl.includes("catalogsearch") ? "verified_product" : "search_fallback",
          vivinoUrl: wine.vivinoUrl ?? `https://www.vivino.com/search/wines?q=${encodeURIComponent(wine.name)}`,
        } satisfies RecommendationWine;
      })
      .filter((wine): wine is RecommendationWine => wine !== null);
  }
}
