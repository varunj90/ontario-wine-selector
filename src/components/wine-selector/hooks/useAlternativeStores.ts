import { useEffect, useRef, useState } from "react";

import type { AlternativeStoreOption, StoreOption, WinePick, WineType } from "../types";

type AlternativeStoreFilters = {
  selectedStoreId: string;
  stores: StoreOption[];
  loading: boolean;
  recommendationCount: number;
  selectedTypes: WineType[];
  selectedVarietals: string[];
  selectedCountries: string[];
  selectedSubRegions: string[];
  minPrice: number;
  maxPrice: number;
  minRating: number;
};

export function useAlternativeStores(filters: AlternativeStoreFilters) {
  const [alternativeStores, setAlternativeStores] = useState<AlternativeStoreOption[]>([]);
  const [alternativeLoading, setAlternativeLoading] = useState(false);
  const lastLookupKeyRef = useRef("");

  useEffect(() => {
    if (!filters.selectedStoreId || filters.loading || filters.recommendationCount > 0 || filters.stores.length <= 1) {
      // Resetting state when external conditions invalidate current results.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAlternativeStores([]);
      setAlternativeLoading(false);
      lastLookupKeyRef.current = "";
      return;
    }

    const lookupCandidates = filters.stores.filter((store) => store.id !== filters.selectedStoreId).slice(0, 4);
    if (lookupCandidates.length === 0) {
      setAlternativeStores([]);
      return;
    }

    const lookupKey = JSON.stringify({
      selectedStoreId: filters.selectedStoreId,
      lookupCandidates: lookupCandidates.map((store) => store.id),
      selectedTypes: filters.selectedTypes,
      selectedVarietals: filters.selectedVarietals,
      selectedCountries: filters.selectedCountries,
      selectedSubRegions: filters.selectedSubRegions,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      minRating: filters.minRating,
    });

    if (lastLookupKeyRef.current === lookupKey) return;
    lastLookupKeyRef.current = lookupKey;

    let cancelled = false;
    setAlternativeLoading(true);

    const buildParams = (storeId: string) =>
      new URLSearchParams({
        types: filters.selectedTypes.join(","),
        varietals: filters.selectedVarietals.join(","),
        countries: filters.selectedCountries.join(","),
        subRegions: filters.selectedSubRegions.join(","),
        minPrice: String(filters.minPrice),
        maxPrice: String(filters.maxPrice),
        minRating: String(filters.minRating),
        storeId,
      });

    void Promise.all(
      lookupCandidates.map(async (store) => {
        try {
          const response = await fetch(`/api/recommendations?${buildParams(store.id).toString()}`);
          if (!response.ok) return null;
          const data = (await response.json()) as { recommendations?: WinePick[] };
          return {
            ...store,
            availableCount: data.recommendations?.length ?? 0,
          } satisfies AlternativeStoreOption;
        } catch {
          return null;
        }
      }),
    )
      .then((results) => {
        if (cancelled) return;
        const ranked = results
          .filter((entry): entry is AlternativeStoreOption => Boolean(entry))
          .filter((entry) => entry.availableCount > 0)
          .sort((a, b) => b.availableCount - a.availableCount || a.distanceKm - b.distanceKm);
        setAlternativeStores(ranked);
      })
      .finally(() => {
        if (!cancelled) setAlternativeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    filters.selectedStoreId,
    filters.stores,
    filters.loading,
    filters.recommendationCount,
    filters.selectedTypes,
    filters.selectedVarietals,
    filters.selectedCountries,
    filters.selectedSubRegions,
    filters.minPrice,
    filters.maxPrice,
    filters.minRating,
  ]);

  return { alternativeStores, alternativeLoading } as const;
}
