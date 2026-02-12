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

    const candidates = wines.flatMap<RecommendationWine>((wine) => {
        const signal = wine.qualitySignals[0];
        const matchedRating = signal?.rating ?? 0;
        const matchedRatingCount = signal?.ratingCount ?? 0;
        const signalConfidence = signal?.confidenceScore ?? 0;
        const preferredMarket = filters.storeId
          ? wine.marketData.find((entry) => {
              const code = entry.store.lcboStoreCode ?? entry.store.id;
              return code === filters.storeId;
            })
          : null;
        const market = preferredMarket ?? wine.marketData[0];
        if (!market) return [];
        const hasVivinoMatch = Boolean(signal);

        return [{
          id: wine.id,
          name: wine.name,
          producer: wine.producer,
          type: wine.type as RecommendationWine["type"],
          varietal: wine.varietal,
          country: wine.country,
          subRegion: wine.subRegion,
          region: wine.fullRegionLabel,
          price: market.listedPriceCents / 100,
          rating: matchedRating,
          ratingCount: matchedRatingCount,
          hasVivinoMatch,
          matchScore: hasVivinoMatch ? Math.max(3.5, Math.min(5, matchedRating + signalConfidence * 0.3)) : 3.3,
          stockConfidence: market.inStock ? "High" : "Medium",
          why: [
            hasVivinoMatch
              ? `Vivino ${matchedRating.toFixed(1)} with ${matchedRatingCount} reviews`
              : "Vivino rating is not matched yet; use the Vivino search link to verify",
            market.inStock ? "Available based on latest inventory sync" : "Inventory can change quickly by store",
            `Source refreshed ${(signal?.fetchedAt ?? market.sourceUpdatedAt).toISOString().slice(0, 10)}`,
          ],
          storeId: market.store.lcboStoreCode ?? market.store.id,
          storeLabel: market.store.displayName,
          lcboUrl: wine.lcboUrl ?? fallbackLcboUrl(wine.name, wine.producer),
          lcboLinkType: wine.lcboUrl && wine.lcboUrl.includes("/en/") && !wine.lcboUrl.includes("catalogsearch") ? "verified_product" : "search_fallback",
          vivinoUrl: wine.vivinoUrl ?? `https://www.vivino.com/search/wines?q=${encodeURIComponent(wine.name)}`,
        } satisfies RecommendationWine];
      });

    return candidates;
  }
}
