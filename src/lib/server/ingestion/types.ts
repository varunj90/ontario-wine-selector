export type CatalogFeedItem = {
  externalId: string;
  name: string;
  producer: string;
  type: "Red" | "White" | "Rose" | "Bubbly" | "Other";
  varietal: string;
  country: string;
  subRegion: string;
  regionLabel: string;
  lcboUrl?: string;
  vivinoUrl?: string;
  storeCode: string;
  storeLabel: string;
  storeCity?: string;
  storeLatitude?: number;
  storeLongitude?: number;
  listedPriceCents: number;
  inventoryQuantity: number;
  inStock: boolean;
  sourceUpdatedAt: Date;
};

export type SignalFeedItem = {
  externalId: string;
  source: "vivino";
  rating: number;
  ratingCount: number;
  confidenceScore: number;
  fetchedAt: Date;
};
