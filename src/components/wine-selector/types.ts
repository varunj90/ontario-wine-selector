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

/** Accent colors that shift based on the selected wine type. */
export type AccentTheme = {
  /** Vivino rating box background (e.g. "bg-amber-500/10") */
  glow: string;
  /** Vivino rating box border (e.g. "border-amber-500/30") */
  glowBorder: string;
  /** Rating label color */
  glowText: string;
  /** Star fill color */
  starFill: string;
  /** Selected chip treatment */
  chipActive: string;
  /** Selected chip treatment (light mode) */
  chipActiveLight: string;
  /** Price slider active track */
  sliderTrack: string;
  /** Price slider active track (light mode) */
  sliderTrackLight: string;
  /** Rank badge background */
  rankBg: string;
  /** Subtle page gradient tint color (hex) for dark mode */
  pageGradientTint: string;
  /** Whether to show bubbly decoration */
  hasBubbles?: boolean;
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
