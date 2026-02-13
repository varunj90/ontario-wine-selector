import { prisma } from "@/lib/server/db";

import { getLiveStoreInventory } from "./liveLcboStoreInventory";
import type { WineCatalogProvider } from "./providers";
import type { RecommendationFilterInput, RecommendationWine } from "./types";
import { isTrustedVivinoSignal, resolveVivinoUrl } from "./vivinoTrust";

const MIN_TRUSTED_VIVINO_CONFIDENCE = Number(process.env.VIVINO_MIN_CONFIDENCE ?? "0.72");

function fallbackLcboUrl(wineName: string, producer: string) {
  return `https://www.lcbo.com/en/catalogsearch/result/?q=${encodeURIComponent(`"${wineName} ${producer}"`)}`;
}

export class PrismaWineCatalogProvider implements WineCatalogProvider {
  async listCandidates(filters: RecommendationFilterInput): Promise<RecommendationWine[]> {
    const liveStoreInventory = filters.storeId ? await getLiveStoreInventory(filters.storeId) : null;

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
      take: 2500,
    });

    const candidates = wines.flatMap<RecommendationWine>((wine) => {
        const signal = wine.qualitySignals[0];
        const signalConfidence = signal?.confidenceScore ?? 0;
        const hasTrustedVivinoMatch = Boolean(signal) && isTrustedVivinoSignal(signalConfidence, MIN_TRUSTED_VIVINO_CONFIDENCE);
        const matchedRating = hasTrustedVivinoMatch ? (signal?.rating ?? 0) : 0;
        const matchedRatingCount = hasTrustedVivinoMatch ? (signal?.ratingCount ?? 0) : 0;
        const preferredMarket = filters.storeId
          ? wine.marketData.find((entry) => {
              const code = entry.store.lcboStoreCode ?? entry.store.id;
              return code === filters.storeId;
            })
          : null;
        const fallbackMarket = wine.marketData[0];
        const sku = wine.lcboProductId ?? "";
        const hasLiveStoreStock = Boolean(
          liveStoreInventory &&
            sku &&
            liveStoreInventory.storeCode === filters.storeId &&
            liveStoreInventory.inStockWineSkus.has(sku),
        );
        const market = preferredMarket ?? fallbackMarket;
        if (!market && !hasLiveStoreStock) return [];
        const hasVivinoMatch = hasTrustedVivinoMatch;

        const listedPriceCents =
          preferredMarket?.listedPriceCents ??
          (hasLiveStoreStock ? liveStoreInventory?.priceBySku.get(sku) : undefined) ??
          fallbackMarket?.listedPriceCents ??
          0;
        const stockConfidence: RecommendationWine["stockConfidence"] =
          preferredMarket?.inStock || hasLiveStoreStock ? "High" : "Medium";
        const storeId =
          (hasLiveStoreStock ? filters.storeId : undefined) ??
          market?.store.lcboStoreCode ??
          market?.store.id ??
          "";
        const storeLabel =
          (hasLiveStoreStock ? liveStoreInventory?.storeLabel : undefined) ??
          market?.store.displayName ??
          "LCBO store";
        const referenceDate = signal?.fetchedAt ?? market?.sourceUpdatedAt ?? new Date();

        return [{
          id: wine.id,
          name: wine.name,
          producer: wine.producer,
          type: wine.type as RecommendationWine["type"],
          varietal: wine.varietal,
          country: wine.country,
          subRegion: wine.subRegion,
          region: wine.fullRegionLabel,
          price: listedPriceCents / 100,
          rating: matchedRating,
          ratingCount: matchedRatingCount,
          hasVivinoMatch,
          vivinoMatchConfidence: signal ? signalConfidence : undefined,
          matchScore: hasVivinoMatch ? Math.max(3.5, Math.min(5, matchedRating + signalConfidence * 0.3)) : 3.3,
          stockConfidence,
          why: [
            hasVivinoMatch
              ? `Vivino ${matchedRating.toFixed(1)} with ${matchedRatingCount} reviews (${Math.round(signalConfidence * 100)}% match confidence)`
              : signal
                ? `Found a possible Vivino match, but confidence (${Math.round(signalConfidence * 100)}%) is below trust threshold`
                : "Vivino rating is not matched yet; use the Vivino search link to verify",
            stockConfidence === "High" ? "Available based on latest inventory sync" : "Inventory can change quickly by store",
            `Source refreshed ${referenceDate.toISOString().slice(0, 10)}`,
          ],
          storeId,
          storeLabel,
          lcboUrl: wine.lcboUrl ?? fallbackLcboUrl(wine.name, wine.producer),
          lcboLinkType: wine.lcboUrl && wine.lcboUrl.includes("/en/") && !wine.lcboUrl.includes("catalogsearch") ? "verified_product" : "search_fallback",
          vivinoUrl: resolveVivinoUrl(wine.vivinoUrl, wine.name, wine.producer, wine.country),
        } satisfies RecommendationWine];
      });

    return candidates;
  }
}
