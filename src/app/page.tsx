"use client";

import { useMemo, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BottomBar,
  ErrorBoundary,
  FavoritesPanel,
  FilterPanel,
  RecommendationList,
  SearchInput,
  SelectedStoreInfo,
  StoreFallbackNote,
  StoreSelector,
  darkTheme,
  lightTheme,
  trackEvent,
  useAlternativeStores,
  useFavorites,
  useRecommendations,
  useStoreLookup,
  useTheme,
} from "@/components/wine-selector";
import type { WineType } from "@/components/wine-selector";
import { cn } from "@/lib/utils";

function WineSelectorApp() {
  const { isDark, toggle: toggleTheme } = useTheme();
  const shell = isDark ? darkTheme : lightTheme;

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<WineType[]>([]);
  const [selectedVarietals, setSelectedVarietals] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedSubRegions, setSelectedSubRegions] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState(15);
  const [maxPrice, setMaxPrice] = useState(120);
  const [minRating, setMinRating] = useState(4.0);
  const [selectedStoreId, setSelectedStoreId] = useState("");

  // Hooks
  const { stores, loading: storeLookupLoading, error: storeLookupError } = useStoreLookup(postalCode);
  const { favoriteIds, toggleFavorite, isFavorited } = useFavorites();

  // Derive the effective store ID: if the selected store is no longer in the list, treat as cleared
  const effectiveStoreId = useMemo(() => {
    if (!selectedStoreId) return "";
    return stores.some((store) => store.id === selectedStoreId) ? selectedStoreId : "";
  }, [selectedStoreId, stores]);

  const {
    recommendations,
    countryOptionsFromApi,
    subRegionOptionsFromApi,
    loading,
    errorText,
    storeFallbackNote,
    expandedCard,
    setExpandedCard,
    selectedWineId,
    setSelectedWineId,
    fetchRecommendations,
  } = useRecommendations({
    searchTerm,
    selectedTypes,
    selectedVarietals,
    selectedCountries,
    selectedSubRegions,
    minPrice,
    maxPrice,
    minRating,
    selectedStoreId: effectiveStoreId,
  });

  const { alternativeStores, alternativeLoading } = useAlternativeStores({
    selectedStoreId: effectiveStoreId,
    stores,
    loading,
    recommendationCount: recommendations.length,
    searchTerm,
    selectedTypes,
    selectedVarietals,
    selectedCountries,
    selectedSubRegions,
    minPrice,
    maxPrice,
  });

  // Derived state
  const selectedStore = stores.find((store) => store.id === effectiveStoreId);
  const selectedWine = useMemo(
    () => recommendations.find((wine) => wine.id === selectedWineId) ?? null,
    [recommendations, selectedWineId],
  );
  const favoriteWines = useMemo(
    () => recommendations.filter((wine) => favoriteIds.includes(wine.id)),
    [recommendations, favoriteIds],
  );

  const handleApplyFilters = () => {
    trackEvent("intent_submitted", { searchLength: searchTerm.length, minPrice, maxPrice });
    void fetchRecommendations();
  };

  return (
    <div className={cn("min-h-screen transition-colors duration-500", shell.page)}>
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pb-28 pt-6">
        {/* Search and filters card */}
        <Card className={cn("animate-fade-up shadow-sm backdrop-blur-xl transition-all duration-300", shell.card)}>
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <Badge className={cn("w-fit uppercase tracking-[0.22em]", shell.badge)}>Premium quick pick</Badge>
              <button
                type="button"
                onClick={toggleTheme}
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-200 hover:scale-[1.03] active:scale-95",
                  shell.input,
                )}
                aria-label="Toggle theme"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
            <CardTitle className={cn("text-[28px] leading-[1.12] transition-colors", isDark ? "text-zinc-50" : "text-zinc-900")}>
              Search top-rated wine near your LCBO
            </CardTitle>
            <p className={cn("text-sm transition-colors", shell.textMuted)}>
              Find a bottle you are excited about. We always prioritize highly rated wines and show what is nearby.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <SearchInput value={searchTerm} onChange={setSearchTerm} shell={shell} />

            <StoreSelector
              postalCode={postalCode}
              onPostalCodeChange={setPostalCode}
              selectedStoreId={selectedStoreId}
              onStoreChange={setSelectedStoreId}
              stores={stores}
              loading={storeLookupLoading}
              error={storeLookupError}
              shell={shell}
              isDark={isDark}
            />

            <FilterPanel
              selectedTypes={selectedTypes}
              onTypesChange={setSelectedTypes}
              selectedVarietals={selectedVarietals}
              onVarietalsChange={setSelectedVarietals}
              selectedCountries={selectedCountries}
              onCountriesChange={setSelectedCountries}
              selectedSubRegions={selectedSubRegions}
              onSubRegionsChange={setSelectedSubRegions}
              minPrice={minPrice}
              maxPrice={maxPrice}
              onMinPriceChange={setMinPrice}
              onMaxPriceChange={setMaxPrice}
              minRating={minRating}
              onMinRatingChange={setMinRating}
              countryOptionsFromApi={countryOptionsFromApi}
              subRegionOptionsFromApi={subRegionOptionsFromApi}
              shell={shell}
              isDark={isDark}
            />

            <Button
              type="button"
              size="lg"
              onClick={handleApplyFilters}
              disabled={loading}
              className={cn(
                "h-12 w-full rounded-xl transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]",
                isDark ? "border border-zinc-200 bg-zinc-100 text-zinc-900 hover:bg-white" : "border border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800",
              )}
            >
              {loading ? "Finding great options..." : "Update picks"}
            </Button>
          </CardContent>
        </Card>

        {/* Selected store info */}
        {selectedStore ? (
          <SelectedStoreInfo store={selectedStore} shell={shell} isDark={isDark} />
        ) : null}

        {/* Store fallback note */}
        {storeFallbackNote ? (
          <StoreFallbackNote note={storeFallbackNote} isDark={isDark} />
        ) : null}

        {/* Favorites */}
        <FavoritesPanel
          wines={favoriteWines}
          onSelectWine={setSelectedWineId}
          shell={shell}
          isDark={isDark}
        />

        {/* Recommendations */}
        <RecommendationList
          recommendations={recommendations}
          loading={loading}
          errorText={errorText}
          selectedStoreId={effectiveStoreId}
          expandedCard={expandedCard}
          onExpandCard={setExpandedCard}
          selectedWineId={selectedWineId}
          onSelectWine={setSelectedWineId}
          isFavorited={isFavorited}
          onToggleFavorite={toggleFavorite}
          onClearStore={() => setSelectedStoreId("")}
          alternativeStores={alternativeStores}
          alternativeLoading={alternativeLoading}
          onSelectAlternativeStore={setSelectedStoreId}
          shell={shell}
          isDark={isDark}
        />
      </main>

      {/* Bottom sticky bar */}
      <BottomBar
        selectedWine={selectedWine}
        recommendationCount={recommendations.length}
        shell={shell}
        isDark={isDark}
      />
    </div>
  );
}

export default function Home() {
  return (
    <ErrorBoundary>
      <WineSelectorApp />
    </ErrorBoundary>
  );
}
