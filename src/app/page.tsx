"use client";

import { useCallback, useMemo, useState } from "react";
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
  getAccentForTypes,
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

  // Adaptive accent
  const accent = useMemo(() => getAccentForTypes(selectedTypes), [selectedTypes]);

  // Presentation state
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [selectedWineId, setSelectedWineId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(5);

  const handleResults = useCallback((firstId: string | null) => {
    setExpandedCard(firstId);
    setSelectedWineId(null);
    setVisibleCount(5);
  }, []);

  // Hooks
  const { stores, loading: storeLookupLoading, error: storeLookupError } = useStoreLookup(postalCode);
  const { favoriteIds, toggleFavorite, isFavorited } = useFavorites();

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
  }, handleResults);

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
    minRating,
  });

  // Derived
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

  // Rich background — inline style so the gradient actually renders
  const tint = accent.pageGradientTint;
  const pageBackground = isDark
    ? `radial-gradient(ellipse 80% 50% at 15% -5%, ${tint} 0%, transparent 50%), radial-gradient(ellipse 60% 40% at 85% 110%, ${tint}44 0%, transparent 50%), linear-gradient(to bottom, #0c0a09 0%, #0c0a09 100%)`
    : undefined;

  return (
    <div
      className={cn(
        "relative min-h-screen transition-colors duration-700",
        !isDark && "bg-[#faf8f5] text-stone-900",
        isDark && "text-stone-100",
      )}
      style={isDark ? { background: pageBackground } : undefined}
    >
      <main className="relative z-[1] mx-auto flex w-full max-w-md flex-col gap-7 px-4 pb-36 pt-8">
        {/* ─── Search & Filters Card ─── */}
        <Card
          className={cn(
            "animate-fade-up transition-all duration-500",
            isDark
              ? "border-stone-700/30 bg-stone-900/60"
              : "glass-card-light border-stone-200/70 bg-white/75",
          )}
        >
          <CardHeader className="space-y-4 p-6 pb-3">
            <div className="flex items-center justify-between">
              <Badge className={cn(
                "w-fit text-[10px] uppercase tracking-[0.25em] font-medium",
                isDark
                  ? "border-stone-600/40 bg-stone-800/50 text-stone-400"
                  : "border-stone-300/60 bg-stone-100 text-stone-500",
              )}>
                Premium quick pick
              </Badge>
              <button
                type="button"
                onClick={toggleTheme}
                className={cn(
                  "inline-flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-300 hover:scale-105 active:scale-95",
                  isDark
                    ? "border-stone-700/40 bg-stone-800/40 text-stone-400 hover:text-stone-200"
                    : "border-stone-200 bg-white text-stone-500 hover:text-stone-700",
                )}
                style={{ transitionTimingFunction: "var(--spring)" }}
                aria-label="Toggle theme"
              >
                {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
              </button>
            </div>

            <CardTitle
              className={cn(
                "text-[26px] font-semibold leading-[1.2] tracking-[-0.02em]",
                isDark ? "text-[#f5f0eb]" : "text-stone-900",
              )}
            >
              Search top-rated wine near your LCBO
            </CardTitle>

            <p className={cn("text-[14px] leading-[1.7]", isDark ? "text-stone-400" : "text-stone-500")}>
              Find a bottle you&apos;re excited about. We prioritize highly rated wines that are nearby and in stock.
            </p>
          </CardHeader>

          <CardContent className="space-y-4 p-6 pt-1">
            <SearchInput value={searchTerm} onChange={setSearchTerm} shell={shell} isDark={isDark} />

            <StoreSelector
              postalCode={postalCode}
              onPostalCodeChange={setPostalCode}
              selectedStoreId={effectiveStoreId}
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
              accent={accent}
            />

            <button
              type="button"
              onClick={handleApplyFilters}
              disabled={loading}
              className={cn(
                "flex h-[52px] w-full items-center justify-center rounded-2xl text-[15px] font-semibold tracking-[-0.01em] transition-all duration-300 disabled:opacity-50",
                isDark
                  ? "bg-[#f5f0eb] text-stone-900 hover:bg-white active:scale-[0.98]"
                  : "bg-stone-900 text-white hover:bg-stone-800 active:scale-[0.98]",
              )}
              style={{ transitionTimingFunction: "var(--spring)" }}
            >
              {loading ? "Finding great options…" : "Update picks"}
            </button>
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
          visibleCount={visibleCount}
          onShowMore={() => setVisibleCount((prev) => prev + 5)}
          isFavorited={isFavorited}
          onToggleFavorite={toggleFavorite}
          onClearStore={() => setSelectedStoreId("")}
          alternativeStores={alternativeStores}
          alternativeLoading={alternativeLoading}
          onSelectAlternativeStore={setSelectedStoreId}
          shell={shell}
          isDark={isDark}
          accent={accent}
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
