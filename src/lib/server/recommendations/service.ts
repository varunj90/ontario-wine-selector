import { MOCK_WINES } from "./mockData";
import type { WineCatalogProvider, WineSignalProvider } from "./providers";
import { PrismaWineCatalogProvider } from "./prismaProvider";
import type { RecommendationFilterInput, RecommendationResponse, RecommendationWine } from "./types";

class MockWineCatalogProvider implements WineCatalogProvider {
  async listCandidates(filters: RecommendationFilterInput): Promise<RecommendationWine[]> {
    void filters;
    return MOCK_WINES;
  }
}

class PassThroughSignalProvider implements WineSignalProvider {
  async hydrateSignals(candidates: RecommendationWine[]): Promise<RecommendationWine[]> {
    return candidates;
  }
}

function createDefaultCatalogProvider(): WineCatalogProvider {
  if (process.env.RECOMMENDATION_PROVIDER === "db") {
    return new PrismaWineCatalogProvider();
  }

  return new MockWineCatalogProvider();
}

export class RecommendationService {
  constructor(
    private readonly catalogProvider: WineCatalogProvider = createDefaultCatalogProvider(),
    private readonly signalProvider: WineSignalProvider = new PassThroughSignalProvider(),
  ) {}

  async recommend(rawFilters: RecommendationFilterInput): Promise<RecommendationResponse> {
    const normalizedFilters: RecommendationFilterInput = {
      ...rawFilters,
      search: rawFilters.search.toLowerCase().trim(),
    };

    let candidates: RecommendationWine[];
    try {
      candidates = await this.catalogProvider.listCandidates(normalizedFilters);
    } catch (error) {
      // Fallback to mock provider so product demo flow stays available.
      console.warn("recommendation provider failed, falling back to mock data", error);
      candidates = await new MockWineCatalogProvider().listCandidates(normalizedFilters);
    }
    const hydrated = await this.signalProvider.hydrateSignals(candidates);

    const typeVarietalCountryPool = hydrated
      .filter((wine) => (normalizedFilters.types.length > 0 ? normalizedFilters.types.includes(wine.type) : true))
      .filter((wine) => {
        if (normalizedFilters.varietals.length === 0) return true;
        // Primary: exact match on the clean varietal value (post-extraction).
        if (normalizedFilters.varietals.includes(wine.varietal)) return true;
        // Belt-and-suspenders: also check if the wine's name or varietal field
        // contains any of the requested varietals (handles legacy data where
        // the varietal field still holds a description string).
        const hay = `${wine.varietal} ${wine.name}`.toLowerCase();
        return normalizedFilters.varietals.some((v) => hay.includes(v.toLowerCase()));
      })
      .filter((wine) => (normalizedFilters.countries.length > 0 ? normalizedFilters.countries.includes(wine.country) : true));

    const availableCountries = Array.from(new Set(typeVarietalCountryPool.map((wine) => wine.country))).sort((a, b) => a.localeCompare(b));
    const availableSubRegions = Array.from(new Set(typeVarietalCountryPool.map((wine) => wine.subRegion))).sort((a, b) => a.localeCompare(b));

    const baseFilteredPool = typeVarietalCountryPool
      .filter((wine) => (normalizedFilters.subRegions.length > 0 ? normalizedFilters.subRegions.includes(wine.subRegion) : true))
      .filter((wine) => wine.price >= normalizedFilters.minPrice && wine.price <= normalizedFilters.maxPrice)
      .filter((wine) => {
        if (!normalizedFilters.search) return true;
        const haystack = `${wine.name} ${wine.producer} ${wine.varietal} ${wine.region}`.toLowerCase();
        return haystack.includes(normalizedFilters.search);
      });

    const minRating = normalizedFilters.minRating ?? 4.0;

    // Three-tier ranking to build user trust:
    //   Tier 1 — Direct Vivino match (highest confidence, shown first)
    //   Tier 2 — Producer average estimate (decent signal, shown second)
    //   Tier 3 — No rating data (search-only fallback, shown last)
    const rankThreeTier = (pool: RecommendationWine[]) => {
      const byStockThenRating = (a: RecommendationWine, b: RecommendationWine) => {
        if (a.stockConfidence !== b.stockConfidence) return a.stockConfidence === "High" ? -1 : 1;
        if (b.rating !== a.rating) return b.rating - a.rating;
        return b.ratingCount - a.ratingCount;
      };

      const tier1 = pool
        .filter((w) => w.ratingSource === "direct" && w.rating >= minRating)
        .sort(byStockThenRating);

      const tier2 = pool
        .filter((w) => w.ratingSource === "producer_avg" && w.rating >= minRating)
        .sort(byStockThenRating);

      const tier3 = pool
        .filter((w) => {
          if (w.ratingSource === "direct" && w.rating >= minRating) return false;
          if (w.ratingSource === "producer_avg" && w.rating >= minRating) return false;
          return true;
        })
        .sort((a, b) => {
          if (a.stockConfidence !== b.stockConfidence) return a.stockConfidence === "High" ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

      return [...tier1, ...tier2, ...tier3];
    };

    const strictStorePool = normalizedFilters.storeId
      ? baseFilteredPool.filter((wine) => wine.storeId === normalizedFilters.storeId && wine.stockConfidence === "High")
      : baseFilteredPool;

    let storeFallbackApplied = false;
    let storeFallbackNote: string | null = null;
    let recommendations = rankThreeTier(strictStorePool);

    if (normalizedFilters.storeId && recommendations.length === 0) {
      storeFallbackApplied = true;
      storeFallbackNote = "No in-stock wines matched at the selected store. Showing nearby LCBO availability instead.";
      recommendations = rankThreeTier(baseFilteredPool.filter((wine) => wine.stockConfidence === "High"));
    }

    return {
      query: normalizedFilters,
      availableCountries,
      availableSubRegions,
      qualityRule: `Tier 1: direct Vivino matches (rating >= ${minRating.toFixed(1)}). Tier 2: producer-average estimates. Tier 3: search-only fallback.`,
      rankingRule: "Direct Vivino-rated wines rank first, then producer averages, then search-only fallback. Each tier sorted by stock confidence then rating.",
      reviewCountNote: "Review counts shown for direct Vivino matches; 'est.' for producer averages; search links for unmatched wines.",
      storeFallbackApplied,
      storeFallbackNote,
      recommendations,
    };
  }
}
