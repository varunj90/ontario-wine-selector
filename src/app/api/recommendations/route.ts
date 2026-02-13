import { NextResponse } from "next/server";

import { RecommendationService } from "@/lib/server/recommendations/service";
import type { RecommendationFilterInput } from "@/lib/server/recommendations/types";

function parseCommaSeparated(raw: string | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function clampNumber(raw: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const minPrice = clampNumber(searchParams.get("minPrice"), 15, 0, 10000);
  const maxPrice = clampNumber(searchParams.get("maxPrice"), 500, 0, 10000);
  const minRating = clampNumber(searchParams.get("minRating"), 4.0, 0, 5);

  const filters: RecommendationFilterInput = {
    types: parseCommaSeparated(searchParams.get("types")),
    varietals: parseCommaSeparated(searchParams.get("varietals")),
    countries: parseCommaSeparated(searchParams.get("countries")),
    subRegions: parseCommaSeparated(searchParams.get("subRegions")),
    minPrice: Math.min(minPrice, maxPrice),
    maxPrice: Math.max(minPrice, maxPrice),
    minRating,
    storeId: searchParams.get("storeId") ?? "",
  };

  const recommendationService = new RecommendationService();
  const result = await recommendationService.recommend(filters);

  return NextResponse.json(result);
}
