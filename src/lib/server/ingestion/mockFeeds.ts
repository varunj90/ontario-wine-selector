import { MOCK_WINES } from "@/lib/server/recommendations/mockData";

import type { CatalogFeedItem, SignalFeedItem } from "./types";

export function getMockCatalogFeed(): CatalogFeedItem[] {
  return MOCK_WINES.map((wine) => ({
    externalId: wine.id,
    name: wine.name,
    producer: wine.producer,
    type: wine.type,
    varietal: wine.varietal,
    country: wine.country,
    subRegion: wine.subRegion,
    regionLabel: wine.region,
    lcboUrl: wine.lcboUrl,
    vivinoUrl: wine.vivinoUrl,
    storeCode: wine.storeId,
    storeLabel: wine.storeLabel,
    listedPriceCents: Math.round(wine.price * 100),
    inventoryQuantity: wine.stockConfidence === "High" ? 24 : 6,
    inStock: wine.stockConfidence === "High",
    sourceUpdatedAt: new Date(),
  }));
}

export function getMockVivinoFeed(): SignalFeedItem[] {
  return MOCK_WINES.map((wine) => ({
    externalId: wine.id,
    source: "vivino",
    rating: wine.rating,
    ratingCount: wine.ratingCount,
    confidenceScore: 0.85,
    fetchedAt: new Date(),
  }));
}
