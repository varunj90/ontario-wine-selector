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
    ratingSource: overrides.ratingSource ?? "none",
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

test("three-tier ranking: direct Vivino first, producer avg second, unrated last", async () => {
  const wines: RecommendationWine[] = [
    makeWine({
      id: "unrated",
      name: "Aaa Unrated Wine",
      ratingSource: "none",
      hasVivinoMatch: false,
      rating: 0,
      ratingCount: 0,
      storeId: "store-a",
    }),
    makeWine({
      id: "producer-avg",
      name: "Producer Avg Wine",
      ratingSource: "producer_avg",
      hasVivinoMatch: true,
      rating: 4.2,
      ratingCount: 0,
      storeId: "store-a",
    }),
    makeWine({
      id: "direct",
      name: "Direct Match Wine",
      ratingSource: "direct",
      hasVivinoMatch: true,
      vivinoMatchConfidence: 0.82,
      rating: 4.4,
      ratingCount: 150,
      storeId: "store-a",
    }),
    makeWine({
      id: "low-rated-direct",
      name: "Low Rated Direct",
      ratingSource: "direct",
      hasVivinoMatch: true,
      vivinoMatchConfidence: 0.81,
      rating: 3.8,
      ratingCount: 180,
      storeId: "store-a",
    }),
  ];

  const service = new RecommendationService(
    new StaticCatalogProvider(wines),
    new PassThroughSignalProvider(),
  );

  const result = await service.recommend(baseFilters({ storeId: "store-a" }));
  // Direct (4.4) first, producer avg (4.2) second,
  // unrated fallback last. Rated wines below minRating are excluded.
  assert.deepEqual(
    result.recommendations.map((wine) => wine.id),
    ["direct", "producer-avg", "unrated"],
  );
});

test("minRating strictly excludes below-threshold rated wines across direct and producer-avg tiers", async () => {
  const wines: RecommendationWine[] = [
    makeWine({
      id: "direct-high",
      name: "Direct 4.7",
      ratingSource: "direct",
      hasVivinoMatch: true,
      rating: 4.7,
      ratingCount: 220,
      storeId: "store-a",
    }),
    makeWine({
      id: "direct-low",
      name: "Direct 4.3",
      ratingSource: "direct",
      hasVivinoMatch: true,
      rating: 4.3,
      ratingCount: 180,
      storeId: "store-a",
    }),
    makeWine({
      id: "producer-high",
      name: "Producer Avg 4.6",
      ratingSource: "producer_avg",
      hasVivinoMatch: true,
      rating: 4.6,
      ratingCount: 0,
      storeId: "store-a",
    }),
    makeWine({
      id: "producer-low",
      name: "Producer Avg 3.9",
      ratingSource: "producer_avg",
      hasVivinoMatch: true,
      rating: 3.9,
      ratingCount: 0,
      storeId: "store-a",
    }),
    makeWine({
      id: "unrated",
      name: "Unrated fallback",
      ratingSource: "none",
      hasVivinoMatch: false,
      rating: 0,
      ratingCount: 0,
      storeId: "store-a",
    }),
  ];

  const service = new RecommendationService(
    new StaticCatalogProvider(wines),
    new PassThroughSignalProvider(),
  );

  const result = await service.recommend(baseFilters({ storeId: "store-a", minRating: 4.5 }));
  assert.deepEqual(
    result.recommendations.map((wine) => wine.id),
    ["direct-high", "producer-high", "unrated"],
  );
});

test("varietal filter matches wines with exact varietal value", async () => {
  const wines: RecommendationWine[] = [
    makeWine({ id: "chard-exact", name: "Gato Negro Chardonnay", varietal: "Chardonnay" }),
    makeWine({ id: "merlot", name: "Sample Merlot", varietal: "Merlot" }),
  ];

  const service = new RecommendationService(
    new StaticCatalogProvider(wines),
    new PassThroughSignalProvider(),
  );

  const result = await service.recommend(baseFilters({ varietals: ["Chardonnay"] }));
  assert.equal(result.recommendations.length, 1);
  assert.equal(result.recommendations[0]?.id, "chard-exact");
});

test("varietal filter falls back to name-based matching for legacy data", async () => {
  // Simulates a wine whose varietal field still contains description text
  // (legacy data that hasn't been backfilled), but whose name contains the grape.
  const wines: RecommendationWine[] = [
    makeWine({
      id: "chard-legacy",
      name: "Lindemans Bin 65 Chardonnay",
      varietal: "Well-priced and delicious chardonnay from Chile",
    }),
    makeWine({
      id: "merlot",
      name: "Sample Merlot",
      varietal: "A smooth and velvety red wine",
    }),
  ];

  const service = new RecommendationService(
    new StaticCatalogProvider(wines),
    new PassThroughSignalProvider(),
  );

  const result = await service.recommend(baseFilters({ varietals: ["Chardonnay"] }));
  // Should find both: one via varietal description containing "chardonnay",
  // the other via name containing "Chardonnay"
  assert.equal(result.recommendations.length, 1);
  assert.equal(result.recommendations[0]?.id, "chard-legacy");
});

test("varietal filter matches grape in description-varietal even if not in name", async () => {
  // Wine name is "Louis Jadot Chablis" — no grape in name
  // But the varietal field (legacy) might contain "chardonnay" in the description
  const wines: RecommendationWine[] = [
    makeWine({
      id: "chablis",
      name: "Louis Jadot Chablis",
      varietal: "A classic Chardonnay from Burgundy",
    }),
    makeWine({
      id: "other",
      name: "Random Wine",
      varietal: "Something else",
    }),
  ];

  const service = new RecommendationService(
    new StaticCatalogProvider(wines),
    new PassThroughSignalProvider(),
  );

  const result = await service.recommend(baseFilters({ varietals: ["Chardonnay"] }));
  assert.equal(result.recommendations.length, 1);
  assert.equal(result.recommendations[0]?.id, "chablis");
});

// ── Integration-style test: simulates the full ingest→query data path ──────

test("end-to-end: ingested wines with mixed varietal quality are all findable via varietal filter", async () => {
  // Simulates 6 wines as they would appear after ingestion + live enrichment:
  // - 2 with clean varietal (post-extraction)
  // - 1 with legacy description-as-varietal but grape in name
  // - 1 with legacy description-as-varietal and grape only in description
  // - 1 completely different varietal (should be excluded)
  // - 1 with "Blend" varietal but "Chardonnay" in name
  const catalog: RecommendationWine[] = [
    makeWine({ id: "clean-chard-1", name: "Gato Negro Chardonnay", varietal: "Chardonnay", type: "White", storeId: "534", stockConfidence: "High" }),
    makeWine({ id: "clean-chard-2", name: "Cave Spring Chardonnay VQA", varietal: "Chardonnay", type: "White", storeId: "534", stockConfidence: "High" }),
    makeWine({ id: "legacy-name", name: "Lindemans Bin 65 Chardonnay", varietal: "Well-priced and delicious chardonnay", type: "White", storeId: "534", stockConfidence: "High" }),
    makeWine({ id: "legacy-desc", name: "Louis Jadot Chablis", varietal: "A classic Chardonnay from Burgundy", type: "White", storeId: "534", stockConfidence: "High" }),
    makeWine({ id: "merlot", name: "Duckhorn Merlot", varietal: "Merlot", type: "Red", storeId: "534", stockConfidence: "High" }),
    makeWine({ id: "blend-with-name", name: "Naked Grape Chardonnay Reserve", varietal: "Blend", type: "White", storeId: "534", stockConfidence: "High" }),
  ];

  const service = new RecommendationService(
    new StaticCatalogProvider(catalog),
    new PassThroughSignalProvider(),
  );

  const result = await service.recommend(baseFilters({
    types: ["White"],
    varietals: ["Chardonnay"],
    storeId: "534",
    minPrice: 1,
    maxPrice: 999,
  }));

  const ids = result.recommendations.map((w) => w.id).sort();
  // All 5 Chardonnay-related wines should appear; the Merlot should not.
  assert.deepEqual(ids, ["blend-with-name", "clean-chard-1", "clean-chard-2", "legacy-desc", "legacy-name"]);
  assert.equal(result.storeFallbackApplied, false);
});

test("end-to-end: multi-varietal filter returns union of matching wines", async () => {
  const catalog: RecommendationWine[] = [
    makeWine({ id: "chard", name: "Chardonnay Reserve", varietal: "Chardonnay", type: "White" }),
    makeWine({ id: "riesling", name: "Dr. Loosen Riesling", varietal: "Riesling", type: "White" }),
    makeWine({ id: "sb", name: "Kim Crawford Sauvignon Blanc", varietal: "Sauvignon Blanc", type: "White" }),
    makeWine({ id: "merlot", name: "Red Merlot", varietal: "Merlot", type: "Red" }),
  ];

  const service = new RecommendationService(
    new StaticCatalogProvider(catalog),
    new PassThroughSignalProvider(),
  );

  const result = await service.recommend(baseFilters({
    varietals: ["Chardonnay", "Riesling"],
  }));

  const ids = result.recommendations.map((w) => w.id).sort();
  assert.deepEqual(ids, ["chard", "riesling"]);
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
