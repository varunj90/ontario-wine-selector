import assert from "node:assert/strict";
import test from "node:test";

import type { WineCatalogProvider, WineSignalProvider } from "./providers";
import { RecommendationService } from "./service";
import type { RecommendationFilterInput, RecommendationWine } from "./types";

class StaticCatalogProvider implements WineCatalogProvider {
  constructor(private readonly wines: RecommendationWine[]) {}

  async listCandidates(): Promise<RecommendationWine[]> {
    return this.wines;
  }
}

class PassThroughSignalProvider implements WineSignalProvider {
  async hydrateSignals(candidates: RecommendationWine[]): Promise<RecommendationWine[]> {
    return candidates;
  }
}

function baseFilters(overrides?: Partial<RecommendationFilterInput>): RecommendationFilterInput {
  return {
    search: "",
    types: [],
    varietals: [],
    countries: [],
    subRegions: [],
    minPrice: 10,
    maxPrice: 100,
    minRating: 4.0,
    storeId: "",
    ...overrides,
  };
}

function makeWine(overrides: Partial<RecommendationWine>): RecommendationWine {
  return {
    id: overrides.id ?? "wine-1",
    name: overrides.name ?? "Sample Wine",
    producer: overrides.producer ?? "Sample Producer",
    type: overrides.type ?? "Red",
    varietal: overrides.varietal ?? "Blend",
    country: overrides.country ?? "Canada",
    subRegion: overrides.subRegion ?? "Ontario",
    region: overrides.region ?? "Canada - Ontario",
    price: overrides.price ?? 30,
    rating: overrides.rating ?? 0,
    ratingCount: overrides.ratingCount ?? 0,
    hasVivinoMatch: overrides.hasVivinoMatch ?? false,
    vivinoMatchConfidence: overrides.vivinoMatchConfidence,
    matchScore: overrides.matchScore ?? 3.3,
    stockConfidence: overrides.stockConfidence ?? "High",
    why: overrides.why ?? [],
    storeId: overrides.storeId ?? "store-a",
    storeLabel: overrides.storeLabel ?? "Store A",
    lcboUrl: overrides.lcboUrl ?? "https://www.lcbo.com/en/catalogsearch/result/?q=sample",
    lcboLinkType: overrides.lcboLinkType ?? "search_fallback",
    vivinoUrl: overrides.vivinoUrl ?? "https://www.vivino.com/search/wines?q=sample",
  };
}

test("recommendation ranking prioritizes trusted Vivino matches and keeps search-only fallback", async () => {
  const wines: RecommendationWine[] = [
    makeWine({
      id: "trusted",
      name: "Trusted Match",
      hasVivinoMatch: true,
      vivinoMatchConfidence: 0.82,
      rating: 4.4,
      ratingCount: 150,
      matchScore: 4.5,
      storeId: "store-a",
    }),
    makeWine({
      id: "low-rated-trusted",
      name: "Low Rated Trusted",
      hasVivinoMatch: true,
      vivinoMatchConfidence: 0.81,
      rating: 3.8,
      ratingCount: 180,
      matchScore: 4.0,
      storeId: "store-a",
    }),
    makeWine({
      id: "fallback",
      name: "Fallback Search",
      hasVivinoMatch: false,
      rating: 0,
      ratingCount: 0,
      matchScore: 3.4,
      storeId: "store-a",
    }),
  ];

  const service = new RecommendationService(
    new StaticCatalogProvider(wines),
    new PassThroughSignalProvider(),
  );

  const result = await service.recommend(baseFilters({ storeId: "store-a" }));
  assert.deepEqual(
    result.recommendations.map((wine) => wine.id),
    ["trusted", "fallback"],
  );
});

test("store fallback activates when selected store has no in-stock candidates", async () => {
  const wines: RecommendationWine[] = [
    makeWine({
      id: "other-store-trusted",
      storeId: "store-b",
      hasVivinoMatch: true,
      rating: 4.2,
      ratingCount: 210,
      matchScore: 4.3,
      stockConfidence: "High",
    }),
  ];

  const service = new RecommendationService(
    new StaticCatalogProvider(wines),
    new PassThroughSignalProvider(),
  );

  const result = await service.recommend(baseFilters({ storeId: "store-a" }));
  assert.equal(result.storeFallbackApplied, true);
  assert.equal(result.recommendations.length, 1);
  assert.equal(result.recommendations[0]?.id, "other-store-trusted");
});
