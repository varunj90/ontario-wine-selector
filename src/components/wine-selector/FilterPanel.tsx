"use client";

import { useMemo } from "react";
import { RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";

import { ChipGroup } from "./ChipGroup";
import {
  DEFAULT_COUNTRY_OPTIONS,
  DEFAULT_SUBREGION_OPTIONS,
  REGIONS_BY_VARIETAL,
  VARIETAL_BY_TYPE,
  WINE_TYPE_OPTIONS,
} from "./constants";
import { MinRatingSelector } from "./MinRatingSelector";
import { PriceRangeSlider } from "./PriceRangeSlider";
import type { AccentTheme, ShellTheme, WineType } from "./types";

type FilterPanelProps = {
  selectedTypes: WineType[];
  onTypesChange: (types: WineType[]) => void;
  selectedVarietals: string[];
  onVarietalsChange: (varietals: string[]) => void;
  selectedCountries: string[];
  onCountriesChange: (countries: string[]) => void;
  selectedSubRegions: string[];
  onSubRegionsChange: (subRegions: string[]) => void;
  minPrice: number;
  maxPrice: number;
  onMinPriceChange: (value: number) => void;
  onMaxPriceChange: (value: number) => void;
  minRating: number;
  onMinRatingChange: (value: number) => void;
  countryOptionsFromApi: string[];
  subRegionOptionsFromApi: string[];
  shell: ShellTheme;
  isDark: boolean;
  accent: AccentTheme;
};

function toggleMulti<T extends string>(value: T, current: T[], setter: (next: T[]) => void) {
  setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
}

export function FilterPanel({
  selectedTypes,
  onTypesChange,
  selectedVarietals,
  onVarietalsChange,
  selectedCountries,
  onCountriesChange,
  selectedSubRegions,
  onSubRegionsChange,
  minPrice,
  maxPrice,
  onMinPriceChange,
  onMaxPriceChange,
  minRating,
  onMinRatingChange,
  countryOptionsFromApi,
  subRegionOptionsFromApi,
  shell,
  isDark,
  accent,
}: FilterPanelProps) {
  const varietalOptions = useMemo(() => {
    const sourceTypes = selectedTypes.length > 0 ? selectedTypes : WINE_TYPE_OPTIONS;
    const all = sourceTypes.flatMap((type) => VARIETAL_BY_TYPE[type]);
    return Array.from(new Set(all));
  }, [selectedTypes]);

  const countryOptions = useMemo(() => {
    if (countryOptionsFromApi.length > 0) return countryOptionsFromApi;
    return DEFAULT_COUNTRY_OPTIONS;
  }, [countryOptionsFromApi]);

  const subRegionOptions = useMemo(() => {
    if (subRegionOptionsFromApi.length > 0) return subRegionOptionsFromApi;
    const sourceVarietals = selectedVarietals.length > 0 ? selectedVarietals : varietalOptions;
    const all = sourceVarietals.flatMap((varietal) => REGIONS_BY_VARIETAL[varietal] ?? []);
    return Array.from(new Set(all.length > 0 ? all : DEFAULT_SUBREGION_OPTIONS));
  }, [selectedVarietals, varietalOptions, subRegionOptionsFromApi]);

  const hasActiveFilters =
    selectedTypes.length > 0 ||
    selectedVarietals.length > 0 ||
    selectedCountries.length > 0 ||
    selectedSubRegions.length > 0 ||
    minPrice !== 15 ||
    maxPrice !== 120 ||
    minRating !== 4.0;

  const clearAll = () => {
    onTypesChange([]);
    onVarietalsChange([]);
    onCountriesChange([]);
    onSubRegionsChange([]);
    onMinPriceChange(15);
    onMaxPriceChange(120);
    onMinRatingChange(4.0);
  };

  return (
    <div className="space-y-5">
      {hasActiveFilters ? (
        <button
          type="button"
          onClick={clearAll}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-normal transition-all duration-200 active:scale-95",
            isDark
              ? "border-stone-700/40 text-stone-500 hover:text-stone-300"
              : "border-stone-200 text-stone-400 hover:text-stone-600",
          )}
          style={{ transitionTimingFunction: "var(--spring)" }}
        >
          <RotateCcw className="h-3 w-3" />
          Clear all filters
        </button>
      ) : null}

      <ChipGroup
        label="Wine style"
        options={WINE_TYPE_OPTIONS}
        selectedValues={selectedTypes}
        onToggle={(value) => toggleMulti(value as WineType, selectedTypes, onTypesChange)}
        isDark={isDark}
        accent={accent}
        initialVisibleCount={5}
      />
      <ChipGroup
        label="Grape you like"
        options={varietalOptions}
        selectedValues={selectedVarietals}
        onToggle={(value) => toggleMulti(value, selectedVarietals, onVarietalsChange)}
        isDark={isDark}
        accent={accent}
        initialVisibleCount={6}
      />
      <ChipGroup
        label="Country"
        options={countryOptions}
        selectedValues={selectedCountries}
        onToggle={(value) => toggleMulti(value, selectedCountries, onCountriesChange)}
        isDark={isDark}
        accent={accent}
        initialVisibleCount={6}
      />
      <ChipGroup
        label="Sub-region"
        options={subRegionOptions}
        selectedValues={selectedSubRegions}
        onToggle={(value) => toggleMulti(value, selectedSubRegions, onSubRegionsChange)}
        isDark={isDark}
        accent={accent}
        initialVisibleCount={6}
      />

      <PriceRangeSlider
        minPrice={minPrice}
        maxPrice={maxPrice}
        onMinChange={onMinPriceChange}
        onMaxChange={onMaxPriceChange}
        shell={shell}
        isDark={isDark}
        accent={accent}
      />

      <MinRatingSelector
        value={minRating}
        onChange={onMinRatingChange}
        shell={shell}
        isDark={isDark}
        accent={accent}
      />
    </div>
  );
}
