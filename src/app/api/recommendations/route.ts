import { NextResponse } from "next/server";

import { RecommendationService } from "@/lib/server/recommendations/service";
import type { RecommendationFilterInput } from "@/lib/server/recommendations/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters: RecommendationFilterInput = {
    search: searchParams.get("search") ?? "",
    types: (searchParams.get("types") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    varietals: (searchParams.get("varietals") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    countries: (searchParams.get("countries") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    subRegions: (searchParams.get("subRegions") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    minPrice: Number(searchParams.get("minPrice") ?? "15"),
    maxPrice: Number(searchParams.get("maxPrice") ?? "500"),
    storeId: searchParams.get("storeId") ?? "",
  };

  await new Promise((resolve) => setTimeout(resolve, 250));

  const recommendationService = new RecommendationService();
  const result = await recommendationService.recommend(filters);

  return NextResponse.json(result);
}
