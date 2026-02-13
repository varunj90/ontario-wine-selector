import { useCallback, useEffect, useRef, useState } from "react";

type OnResultsCallback = (firstId: string | null) => void;

import { trackEvent } from "../analytics";
import type { WinePick, WineType } from "../types";

type RecommendationFilters = {
  searchTerm: string;
  selectedTypes: WineType[];
  selectedVarietals: string[];
  selectedCountries: string[];
  selectedSubRegions: string[];
  minPrice: number;
  maxPrice: number;
  minRating: number;
  selectedStoreId: string;
};

type RecommendationsState = {
  recommendations: WinePick[];
  countryOptionsFromApi: string[];
  subRegionOptionsFromApi: string[];
  loading: boolean;
  errorText: string | null;
  storeFallbackNote: string | null;
};

export function useRecommendations(filters: RecommendationFilters, onResults?: OnResultsCallback) {
  const [state, setState] = useState<RecommendationsState>({
    recommendations: [],
    countryOptionsFromApi: [],
    subRegionOptionsFromApi: [],
    loading: false,
    errorText: null,
    storeFallbackNote: null,
  });

  const onResultsRef = useRef(onResults);
  onResultsRef.current = onResults;

  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const fetchRecommendations = useCallback(async () => {
    const f = filtersRef.current;
    setState((prev) => ({ ...prev, loading: true, errorText: null }));
    try {
      const params = new URLSearchParams({
        search: f.searchTerm,
        types: f.selectedTypes.join(","),
        varietals: f.selectedVarietals.join(","),
        countries: f.selectedCountries.join(","),
        subRegions: f.selectedSubRegions.join(","),
        minPrice: String(f.minPrice),
        maxPrice: String(f.maxPrice),
        minRating: String(f.minRating),
        storeId: f.selectedStoreId,
      });
      const response = await fetch(`/api/recommendations?${params.toString()}`);
      if (!response.ok) throw new Error("Request failed");
      const data = (await response.json()) as {
        recommendations: WinePick[];
        availableCountries?: string[];
        availableSubRegions?: string[];
        storeFallbackApplied?: boolean;
        storeFallbackNote?: string | null;
      };
      setState({
        recommendations: data.recommendations,
        countryOptionsFromApi: data.availableCountries ?? [],
        subRegionOptionsFromApi: data.availableSubRegions ?? [],
        loading: false,
        errorText: null,
        storeFallbackNote: data.storeFallbackApplied ? (data.storeFallbackNote ?? "Showing nearby LCBO availability.") : null,
      });
      onResultsRef.current?.(data.recommendations[0]?.id ?? null);
      trackEvent("recommendations_viewed", { count: data.recommendations.length });
    } catch {
      setState((prev) => ({
        ...prev,
        loading: false,
        errorText: "Could not fetch recommendations right now. Try again in a few seconds.",
      }));
    }
  }, []);

  // Auto-fetch on filter change with debounce
  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchRecommendations();
    }, 250);
    return () => clearTimeout(timeout);
  }, [
    filters.searchTerm,
    filters.selectedTypes,
    filters.selectedVarietals,
    filters.selectedCountries,
    filters.selectedSubRegions,
    filters.minPrice,
    filters.maxPrice,
    filters.minRating,
    filters.selectedStoreId,
    fetchRecommendations,
  ]);

  return {
    ...state,
    fetchRecommendations,
  } as const;
}
