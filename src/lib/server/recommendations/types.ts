export type LinkType = "verified_product" | "search_fallback";

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
  hasVivinoMatch?: boolean;
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
  storeId: string;
};

export type RecommendationResponse = {
  query: RecommendationFilterInput;
  availableCountries: string[];
  availableSubRegions: string[];
  qualityRule: string;
  rankingRule: string;
  reviewCountNote: string;
  recommendations: RecommendationWine[];
};
