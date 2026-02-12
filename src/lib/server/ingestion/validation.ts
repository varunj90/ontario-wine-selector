import { z } from "zod";

import type { CatalogFeedItem, SignalFeedItem } from "./types";

export type DeadLetterRecord = {
  source: string;
  stage: "adapter" | "sync";
  reason: string;
  payload: unknown;
  externalId?: string;
};

const catalogItemSchema = z.object({
  externalId: z.string().min(1),
  name: z.string().min(1),
  producer: z.string().min(1),
  type: z.enum(["Red", "White", "Rose", "Bubbly", "Other"]),
  varietal: z.string().min(1),
  country: z.string().min(1),
  subRegion: z.string().min(1),
  regionLabel: z.string().min(1),
  lcboUrl: z.string().url().optional(),
  vivinoUrl: z.string().url().optional(),
  storeCode: z.string().min(1),
  storeLabel: z.string().min(1),
  storeCity: z.string().min(1).optional(),
  storeLatitude: z.number().min(-90).max(90).optional(),
  storeLongitude: z.number().min(-180).max(180).optional(),
  listedPriceCents: z.number().int().nonnegative(),
  inventoryQuantity: z.number().int().nonnegative(),
  inStock: z.boolean(),
  sourceUpdatedAt: z.coerce.date(),
});

const signalItemSchema = z.object({
  externalId: z.string().min(1),
  source: z.literal("vivino"),
  rating: z.number().min(0).max(5),
  ratingCount: z.number().int().nonnegative(),
  confidenceScore: z.number().min(0).max(1),
  fetchedAt: z.coerce.date(),
});

export function validateCatalogFeedItems(items: unknown[], source: string) {
  const validItems: CatalogFeedItem[] = [];
  const deadLetters: DeadLetterRecord[] = [];

  for (const item of items) {
    const parsed = catalogItemSchema.safeParse(item);
    if (!parsed.success) {
      deadLetters.push({
        source,
        stage: "sync",
        reason: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
        payload: item,
      });
      continue;
    }

    validItems.push(parsed.data);
  }

  return { validItems, deadLetters };
}

export function validateSignalFeedItems(items: unknown[], source: string) {
  const validItems: SignalFeedItem[] = [];
  const deadLetters: DeadLetterRecord[] = [];

  for (const item of items) {
    const parsed = signalItemSchema.safeParse(item);
    if (!parsed.success) {
      deadLetters.push({
        source,
        stage: "sync",
        reason: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
        payload: item,
      });
      continue;
    }

    validItems.push(parsed.data);
  }

  return { validItems, deadLetters };
}
