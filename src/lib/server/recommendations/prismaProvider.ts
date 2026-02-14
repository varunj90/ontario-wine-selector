import { prisma } from "@/lib/server/db";

import { getLiveStoreInventory } from "./liveLcboStoreInventory";
import type { WineCatalogProvider } from "./providers";
import type { RatingSource, RecommendationFilterInput, RecommendationWine } from "./types";
import { isTrustedVivinoSignal, resolveVivinoUrl } from "./vivinoTrust";

const MIN_TRUSTED_VIVINO_CONFIDENCE = Number(process.env.VIVINO_MIN_CONFIDENCE ?? "0.65");
const MIN_PRODUCER_AVG_SAMPLE_SIZE = Number(process.env.PRODUCER_AVG_MIN_SAMPLE_SIZE ?? "3");
const GENERIC_PRODUCER_LABELS = new Set([
  "chateau",
  "château",
  "domaine",
  "bodega",
  "cantina",
  "tenuta",
  "maison",
  "winery",
  "cellars",
  "vineyards",
  "estate",
]);

function fallbackLcboUrl(wineName: string, producer: string) {
  return `https://www.lcbo.com/en/catalogsearch/result/?q=${encodeURIComponent(`"${wineName} ${producer}"`)}`;
}

function normalizeProducerLabel(value: string) {
  return value.trim().toLowerCase();
}

function isReliableProducerForAverage(value: string) {
  const normalized = normalizeProducerLabel(value);
  if (!normalized || normalized === "unknown producer") return false;
  if (GENERIC_PRODUCER_LABELS.has(normalized)) return false;
  return true;
}

export class PrismaWineCatalogProvider implements WineCatalogProvider {
  async listCandidates(filters: RecommendationFilterInput): Promise<RecommendationWine[]> {
    const liveStoreInventory = filters.storeId ? await getLiveStoreInventory(filters.storeId) : null;

    // Push filters to the DB to reduce materialised row volume.
    // For varietal we use a hybrid OR clause: exact match on clean varietal
    // values, OR name/varietal ILIKE for legacy rows whose varietal field
    // still holds a description string.  The service layer keeps its own
    // belt-and-suspenders check as a final safety net.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};
    if (filters.types.length > 0) where.type = { in: filters.types };
    if (filters.countries.length > 0) where.country = { in: filters.countries };
    if (filters.varietals.length > 0) {
      where.OR = filters.varietals.flatMap((v) => [
        { varietal: v },                                       // exact match (clean data)
        { name: { contains: v, mode: "insensitive" } },       // grape in product name
        { varietal: { contains: v, mode: "insensitive" } },   // grape buried in legacy description
      ]);
    }

    const wines = await prisma.wine.findMany({
      where,
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
    });

    // ── Compute producer-level average ratings (fallback for unmatched wines) ──
    // Tighten trust: only compute within same producer + type + country.
    const producerRatings = new Map<string, { sum: number; count: number }>();
    for (const wine of wines) {
      const sig = wine.qualitySignals[0];
      if (!sig || !isTrustedVivinoSignal(sig.confidenceScore ?? 0, MIN_TRUSTED_VIVINO_CONFIDENCE)) continue;
      if (!isReliableProducerForAverage(wine.producer)) continue;
      const key = `${normalizeProducerLabel(wine.producer)}|${wine.type}|${wine.country}`;
      const entry = producerRatings.get(key) ?? { sum: 0, count: 0 };
      entry.sum += sig.rating ?? 0;
      entry.count += 1;
      producerRatings.set(key, entry);
    }

    const candidates = wines.flatMap<RecommendationWine>((wine) => {
        const signal = wine.qualitySignals[0];
        const signalConfidence = signal?.confidenceScore ?? 0;
        const hasTrustedVivinoMatch = Boolean(signal) && isTrustedVivinoSignal(signalConfidence, MIN_TRUSTED_VIVINO_CONFIDENCE);

        // Determine rating source: direct > producer_avg > none
        let matchedRating: number;
        let matchedRatingCount: number;
        let ratingSource: RatingSource;

        if (hasTrustedVivinoMatch) {
          matchedRating = signal?.rating ?? 0;
          matchedRatingCount = signal?.ratingCount ?? 0;
          ratingSource = "direct";
        } else {
          const producerKey = `${normalizeProducerLabel(wine.producer)}|${wine.type}|${wine.country}`;
          const producerAvg = producerRatings.get(producerKey);
          if (
            isReliableProducerForAverage(wine.producer) &&
            producerAvg &&
            producerAvg.count >= MIN_PRODUCER_AVG_SAMPLE_SIZE
          ) {
            matchedRating = Number((producerAvg.sum / producerAvg.count).toFixed(1));
            matchedRatingCount = 0;  // We don't have a per-wine count for averages
            ratingSource = "producer_avg";
          } else {
            matchedRating = 0;
            matchedRatingCount = 0;
            ratingSource = "none";
          }
        }
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
        const hasVivinoMatch = hasTrustedVivinoMatch || ratingSource === "producer_avg";

        const listedPriceCents =
          preferredMarket?.listedPriceCents ??
          (hasLiveStoreStock ? liveStoreInventory?.priceBySku.get(sku) : undefined) ??
          fallbackMarket?.listedPriceCents ??
          0;
        const stockConfidence: RecommendationWine["stockConfidence"] =
          market?.inStock || hasLiveStoreStock ? "High" : "Medium";
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
          ratingSource,
          hasVivinoMatch,
          vivinoMatchConfidence: signal ? signalConfidence : undefined,
          matchScore: ratingSource === "direct"
            ? Math.max(3.5, Math.min(5, matchedRating + signalConfidence * 0.3))
            : ratingSource === "producer_avg"
              ? Math.max(3.2, Math.min(4.8, matchedRating))
              : 3.3,
          stockConfidence,
          why: [
            ratingSource === "direct"
              ? `Vivino ${matchedRating.toFixed(1)} with ${matchedRatingCount.toLocaleString()} reviews (${Math.round(signalConfidence * 100)}% match confidence)`
              : ratingSource === "producer_avg"
                ? `Producer avg ${matchedRating.toFixed(1)} from ${producerRatings.get(wine.producer)?.count ?? 0} other wines by ${wine.producer}`
                : signal
                  ? `Found a possible Vivino match, but confidence (${Math.round(signalConfidence * 100)}%) is below trust threshold`
                  : "No Vivino rating yet — search on Vivino to verify",
            stockConfidence === "High" ? "Available based on latest inventory sync" : "Inventory can change quickly by store",
            `Source refreshed ${referenceDate.toISOString().slice(0, 10)}`,
          ],
          storeId,
          storeLabel,
          lcboUrl: wine.lcboUrl ?? fallbackLcboUrl(wine.name, wine.producer),
          lcboLinkType: wine.lcboUrl && wine.lcboUrl.includes("/en/") && !wine.lcboUrl.includes("catalogsearch") ? "verified_product" : "search_fallback",
          vivinoUrl: resolveVivinoUrl(
            wine.vivinoUrl,
            wine.name,
            wine.producer === "Unknown Producer" ? "" : wine.producer,
            wine.country,
          ),
        } satisfies RecommendationWine];
      });

    return candidates;
  }
}
