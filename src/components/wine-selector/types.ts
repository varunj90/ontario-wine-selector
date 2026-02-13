export type WinePick = {
  id: string;
  name: string;
  producer: string;
  type: WineType;
  varietal: string;
  country: string;
  subRegion: string;
  price: number;
  region: string;
  rating: number;
  ratingCount: number;
  hasVivinoMatch?: boolean;
  vivinoMatchConfidence?: number;
  matchScore: number;
  stockConfidence: "High" | "Medium";
  why: string[];
  storeId: string;
  storeLabel: string;
  lcboUrl: string;
  lcboLinkType: "verified_product" | "search_fallback";
  vivinoUrl: string;
};

export type WineType = "Red" | "White" | "Rose" | "Bubbly" | "Other";

export type StoreOption = {
  id: string;
  label: string;
  distanceKm: number;
};

export type AlternativeStoreOption = StoreOption & {
  availableCount: number;
};

export type ShellTheme = {
  page: string;
  card: string;
  cardSoft: string;
  textMuted: string;
  input: string;
  chipIdle: string;
  chipActive: string;
  badge: string;
  sliderWrap: string;
  secondaryText: string;
};
