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

    const qualityPool = hydrated.filter((wine) => wine.rating >= 4.0);
    const typeVarietalCountryPool = qualityPool
      .filter((wine) => (normalizedFilters.types.length > 0 ? normalizedFilters.types.includes(wine.type) : true))
      .filter((wine) => (normalizedFilters.varietals.length > 0 ? normalizedFilters.varietals.includes(wine.varietal) : true))
      .filter((wine) => (normalizedFilters.countries.length > 0 ? normalizedFilters.countries.includes(wine.country) : true));

    const availableCountries = Array.from(new Set(typeVarietalCountryPool.map((wine) => wine.country))).sort((a, b) => a.localeCompare(b));
    const availableSubRegions = Array.from(new Set(typeVarietalCountryPool.map((wine) => wine.subRegion))).sort((a, b) => a.localeCompare(b));

    const recommendations = typeVarietalCountryPool
      .filter((wine) => (normalizedFilters.subRegions.length > 0 ? normalizedFilters.subRegions.includes(wine.subRegion) : true))
      .filter((wine) => (normalizedFilters.storeId ? wine.storeId === normalizedFilters.storeId : true))
      .filter((wine) => (normalizedFilters.storeId ? wine.stockConfidence === "High" : true))
      .filter((wine) => wine.price >= normalizedFilters.minPrice && wine.price <= normalizedFilters.maxPrice)
      .filter((wine) => {
        if (!normalizedFilters.search) return true;
        const haystack = `${wine.name} ${wine.producer} ${wine.varietal} ${wine.region}`.toLowerCase();
        return haystack.includes(normalizedFilters.search);
      })
      .sort((a, b) => {
        if (a.stockConfidence !== b.stockConfidence) {
          return a.stockConfidence === "High" ? -1 : 1;
        }
        if (b.rating !== a.rating) return b.rating - a.rating;
        return b.ratingCount - a.ratingCount;
      });

    return {
      query: normalizedFilters,
      availableCountries,
      availableSubRegions,
      qualityRule: "Only wines with Vivino rating >= 4.0 are shown.",
      rankingRule: "In-stock wines are prioritized, then results are ordered by Vivino rating (desc), then review count.",
      reviewCountNote: "Review counts come from our latest Vivino ingestion source (API or public snapshot match).",
      recommendations,
    };
  }
}
