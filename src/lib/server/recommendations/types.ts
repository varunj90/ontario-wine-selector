export type LinkType = "verified_product" | "search_fallback";

/**
 * How the rating was derived:
 * - "direct"          – direct Vivino match (highest trust)
 * - "producer_avg"    – averaged from other wines by the same producer
 * - "none"            – no rating data available
 */
export type RatingSource = "direct" | "producer_avg" | "none";

export type RecommendationWine = {
  id: string;
  name: string;
  producer: string;
  type: "Red" | "White" | "Rose" | "Bubbly" | "Other";
  varietal: string;
  country: string;
  subRegion: string;
  region: string;
  price: number;
  rating: number;
  ratingCount: number;
  ratingSource: RatingSource;
  hasVivinoMatch?: boolean;
  vivinoMatchConfidence?: number;
  matchScore: number;
  stockConfidence: "High" | "Medium";
  why: string[];
  storeId: string;
  storeLabel: string;
  lcboUrl: string;
  lcboLinkType: LinkType;
  vivinoUrl: string;
};

export type RecommendationFilterInput = {
  search: string;
  types: string[];
  varietals: string[];
  countries: string[];
  subRegions: string[];
  minPrice: number;
  maxPrice: number;
  minRating: number;
  storeId: string;
};

export type RecommendationResponse = {
  query: RecommendationFilterInput;
  availableCountries: string[];
  availableSubRegions: string[];
  qualityRule: string;
  rankingRule: string;
  reviewCountNote: string;
  storeFallbackApplied?: boolean;
  storeFallbackNote?: string | null;
  recommendations: RecommendationWine[];
};
