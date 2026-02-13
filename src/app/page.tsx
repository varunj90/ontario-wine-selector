"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, ExternalLink, Heart, MapPin, Moon, Search, ShieldCheck, Sparkles, Star, Sun, Wine } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type WinePick = {
  id: string;
  name: string;
  producer: string;
  type: "Red" | "White" | "Rose" | "Bubbly" | "Other";
  varietal: string;
  country: string;
  subRegion: string;
  price: number;
  region: string;
  rating: number;
  ratingCount: number;
  hasVivinoMatch?: boolean;
  matchScore: number;
  stockConfidence: "High" | "Medium";
  why: string[];
  storeId: string;
  storeLabel: string;
  lcboUrl: string;
  lcboLinkType: "verified_product" | "search_fallback";
  vivinoUrl: string;
};

type WineType = "Red" | "White" | "Rose" | "Bubbly" | "Other";
type StoreOption = { id: string; label: string; distanceKm: number };
type AlternativeStoreOption = StoreOption & { availableCount: number };

const wineTypeOptions: WineType[] = ["Red", "White", "Rose", "Bubbly", "Other"];

const varietalByType: Record<WineType, string[]> = {
  Red: ["Cabernet Sauvignon", "Pinot Noir", "Sangiovese", "Merlot", "Syrah"],
  White: ["Chardonnay", "Sauvignon Blanc", "Riesling", "Pinot Grigio", "Chenin Blanc"],
  Rose: ["Provence Rose", "Grenache Rose", "Sangiovese Rose"],
  Bubbly: ["Champagne", "Prosecco", "Cava", "Cremant"],
  Other: ["Orange Wine", "Fortified", "Natural"],
};

const regionsByVarietal: Record<string, string[]> = {
  Chardonnay: ["Burgundy", "Napa Valley", "Sonoma", "Niagara", "Yarra Valley"],
  "Sauvignon Blanc": ["Marlborough", "Loire Valley", "Napa Valley", "Niagara"],
  "Cabernet Sauvignon": ["Napa Valley", "Bordeaux", "Coonawarra", "Maipo Valley"],
  "Pinot Noir": ["Burgundy", "Willamette Valley", "Sonoma Coast", "Central Otago"],
  Sangiovese: ["Tuscany", "Montalcino", "Chianti Classico", "Montepulciano"],
  Riesling: ["Mosel", "Clare Valley", "Alsace", "Finger Lakes"],
  Prosecco: ["Veneto", "Conegliano Valdobbiadene"],
};

function trackEvent(eventName: string, payload: Record<string, string | number>) {
  console.log("[event]", eventName, payload);
}

type ChipGroupProps = {
  label: string;
  options: string[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  activeVariant?: "accent" | "info" | "success";
  isDark: boolean;
  initialVisibleCount?: number;
};

function ChipGroup({
  label,
  options,
  selectedValues,
  onToggle,
  activeVariant = "accent",
  isDark,
  initialVisibleCount = 6,
}: ChipGroupProps) {
  const [showAll, setShowAll] = useState(false);

  const activeClassMap = {
    accent: isDark ? "border-zinc-100 bg-zinc-100 text-zinc-900" : "border-zinc-900 bg-zinc-900 text-white",
    info: isDark ? "border-zinc-100 bg-zinc-100 text-zinc-900" : "border-zinc-900 bg-zinc-900 text-white",
    success: isDark ? "border-zinc-100 bg-zinc-100 text-zinc-900" : "border-zinc-900 bg-zinc-900 text-white",
  } as const;

  const visibleOptions = showAll ? options : options.slice(0, initialVisibleCount);
  const hasHiddenOptions = options.length > initialVisibleCount;

  return (
    <div className="space-y-2">
      <p className={cn("text-sm font-medium", isDark ? "text-zinc-200" : "text-zinc-700")}>{label}</p>
      <div className="flex flex-wrap gap-2">
        {visibleOptions.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition hover:scale-[1.01] active:scale-95",
              isDark ? "border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500" : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500",
              selectedValues.includes(option) && activeClassMap[activeVariant],
            )}
          >
            {option}
          </button>
        ))}
        {hasHiddenOptions ? (
          <button
            type="button"
            onClick={() => setShowAll((previous) => !previous)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition hover:scale-[1.01] active:scale-95",
              isDark ? "border-zinc-600 bg-zinc-800/50 text-zinc-300" : "border-zinc-300 bg-zinc-100 text-zinc-700",
            )}
          >
            {showAll ? "Show less" : `+${options.length - initialVisibleCount} more`}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function confidenceToPercent(score: number) {
  return Math.round((score / 5) * 100);
}

export default function Home() {
  const PRICE_MIN = 10;
  const PRICE_MAX = 500;

  const [isDark, setIsDark] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<WineType[]>([]);
  const [selectedVarietals, setSelectedVarietals] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedSubRegions, setSelectedSubRegions] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState(15);
  const [maxPrice, setMaxPrice] = useState(120);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<WinePick[]>([]);
  const [countryOptionsFromApi, setCountryOptionsFromApi] = useState<string[]>([]);
  const [subRegionOptionsFromApi, setSubRegionOptionsFromApi] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [selectedWineId, setSelectedWineId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(5);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [storeLookupLoading, setStoreLookupLoading] = useState(false);
  const [storeLookupError, setStoreLookupError] = useState<string | null>(null);
  const [alternativeStores, setAlternativeStores] = useState<AlternativeStoreOption[]>([]);
  const [alternativeLoading, setAlternativeLoading] = useState(false);
  const lastAlternativeLookupKeyRef = useRef("");

  const varietalOptions = useMemo(() => {
    const sourceTypes = selectedTypes.length > 0 ? selectedTypes : wineTypeOptions;
    const all = sourceTypes.flatMap((type) => varietalByType[type]);
    return Array.from(new Set(all));
  }, [selectedTypes]);

  const countryOptions = useMemo(() => {
    if (countryOptionsFromApi.length > 0) return countryOptionsFromApi;
    return ["Italy", "Argentina", "France", "USA", "Canada", "New Zealand", "Germany"];
  }, [countryOptionsFromApi]);

  const subRegionOptions = useMemo(() => {
    if (subRegionOptionsFromApi.length > 0) return subRegionOptionsFromApi;
    const sourceVarietals = selectedVarietals.length > 0 ? selectedVarietals : varietalOptions;
    const all = sourceVarietals.flatMap((varietal) => regionsByVarietal[varietal] ?? []);
    return Array.from(new Set(all.length > 0 ? all : ["Tuscany", "Mendoza", "Napa Valley", "Niagara"]));
  }, [selectedVarietals, varietalOptions, subRegionOptionsFromApi]);

  const selectedWine = useMemo(
    () => recommendations.find((wine) => wine.id === selectedWineId) ?? null,
    [recommendations, selectedWineId],
  );
  const favoriteWines = useMemo(() => recommendations.filter((wine) => favoriteIds.includes(wine.id)), [recommendations, favoriteIds]);

  useEffect(() => {
    if (selectedStoreId && !stores.some((store) => store.id === selectedStoreId)) {
      setSelectedStoreId("");
    }
  }, [selectedStoreId, stores]);

  useEffect(() => {
    const normalized = postalCode.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
    if (normalized.length < 3) {
      setStores([]);
      setSelectedStoreId("");
      setStoreLookupError(null);
      return;
    }

    const timeout = setTimeout(() => {
      void (async () => {
        setStoreLookupLoading(true);
        setStoreLookupError(null);
        try {
          const response = await fetch(`/api/stores?postalCode=${encodeURIComponent(normalized)}`);
          if (!response.ok) throw new Error("Store lookup failed");
          const data = (await response.json()) as { stores?: StoreOption[] };
          setStores(data.stores ?? []);
        } catch {
          setStores([]);
          setStoreLookupError("Could not load nearby LCBO stores right now.");
        } finally {
          setStoreLookupLoading(false);
        }
      })();
    }, 250);

    return () => clearTimeout(timeout);
  }, [postalCode]);

  useEffect(() => {
    if (!selectedStoreId || loading || recommendations.length > 0 || stores.length <= 1) {
      setAlternativeStores([]);
      setAlternativeLoading(false);
      lastAlternativeLookupKeyRef.current = "";
      return;
    }

    const lookupCandidates = stores.filter((store) => store.id !== selectedStoreId).slice(0, 4);
    if (lookupCandidates.length === 0) {
      setAlternativeStores([]);
      return;
    }

    const lookupKey = JSON.stringify({
      selectedStoreId,
      lookupCandidates: lookupCandidates.map((store) => store.id),
      searchTerm,
      selectedTypes,
      selectedVarietals,
      selectedCountries,
      selectedSubRegions,
      minPrice,
      maxPrice,
    });

    if (lastAlternativeLookupKeyRef.current === lookupKey) return;
    lastAlternativeLookupKeyRef.current = lookupKey;

    let cancelled = false;
    setAlternativeLoading(true);

    const buildParams = (storeId: string) =>
      new URLSearchParams({
        search: searchTerm,
        types: selectedTypes.join(","),
        varietals: selectedVarietals.join(","),
        countries: selectedCountries.join(","),
        subRegions: selectedSubRegions.join(","),
        minPrice: String(minPrice),
        maxPrice: String(maxPrice),
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
    selectedStoreId,
    stores,
    loading,
    recommendations.length,
    searchTerm,
    selectedTypes,
    selectedVarietals,
    selectedCountries,
    selectedSubRegions,
    minPrice,
    maxPrice,
  ]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchRecommendations();
    }, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, selectedTypes, selectedVarietals, selectedCountries, selectedSubRegions, minPrice, maxPrice, selectedStoreId]);

  async function fetchRecommendations() {
    setLoading(true);
    setErrorText(null);
    setSelectedWineId(null);
    try {
      const params = new URLSearchParams({
        search: searchTerm,
        types: selectedTypes.join(","),
        varietals: selectedVarietals.join(","),
        countries: selectedCountries.join(","),
        subRegions: selectedSubRegions.join(","),
        minPrice: String(minPrice),
        maxPrice: String(maxPrice),
        storeId: selectedStoreId,
      });
      const response = await fetch(`/api/recommendations?${params.toString()}`);
      if (!response.ok) throw new Error("Request failed");
      const data = (await response.json()) as {
        recommendations: WinePick[];
        availableCountries?: string[];
        availableSubRegions?: string[];
      };
      setRecommendations(data.recommendations);
      setCountryOptionsFromApi(data.availableCountries ?? []);
      setSubRegionOptionsFromApi(data.availableSubRegions ?? []);
      setExpandedCard(data.recommendations[0]?.id ?? null);
      setVisibleCount(5);
      trackEvent("recommendations_viewed", { count: data.recommendations.length });
    } catch {
      setErrorText("Could not fetch recommendations right now. Try again in a few seconds.");
    } finally {
      setLoading(false);
    }
  }

  const selectedStore = stores.find((store) => store.id === selectedStoreId);

  const onApplyFilters = () => {
    trackEvent("intent_submitted", { searchLength: searchTerm.length, minPrice, maxPrice });
    void fetchRecommendations();
  };

  const minPricePercent = ((minPrice - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100;
  const maxPricePercent = ((maxPrice - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100;

  const toggleMulti = <T extends string>(value: T, current: T[], setter: (next: T[]) => void) => {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const toggleFavorite = (wineId: string) => {
    setFavoriteIds((previous) => {
      const next = previous.includes(wineId) ? previous.filter((id) => id !== wineId) : [...previous, wineId];
      trackEvent("recommendation_favorited", { wineId, active: next.includes(wineId) ? 1 : 0 });
      return next;
    });
  };

  const shell = isDark
    ? {
        page: "bg-[radial-gradient(circle_at_18%_0%,#45316a_0%,#12131b_36%,#08090d_70%)] text-zinc-100",
        card: "border-zinc-700/80 bg-zinc-900/70",
        cardSoft: "border-zinc-700/70 bg-zinc-900/55",
        textMuted: "text-zinc-300",
        input: "border-zinc-700 bg-zinc-800/70 text-zinc-100 placeholder:text-zinc-500",
        chipIdle: "border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500",
        chipActive: "border-zinc-200 bg-zinc-100 text-zinc-900",
        badge: "border-zinc-700 bg-zinc-800 text-zinc-200",
        sliderWrap: "border-zinc-700 bg-zinc-800/60",
        secondaryText: "text-zinc-400",
      }
    : {
        page: "bg-zinc-50 text-zinc-900",
        card: "border-zinc-200 bg-white",
        cardSoft: "border-zinc-200 bg-white",
        textMuted: "text-zinc-600",
        input: "border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400",
        chipIdle: "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500",
        chipActive: "border-zinc-900 bg-zinc-900 text-white",
        badge: "border-zinc-300 bg-zinc-100 text-zinc-700",
        sliderWrap: "border-zinc-300 bg-zinc-100",
        secondaryText: "text-zinc-500",
      };

  return (
    <div className={cn("min-h-screen transition-colors duration-500", shell.page)}>
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pb-28 pt-6">
        <Card className={cn("animate-fade-up shadow-sm backdrop-blur-xl transition-all duration-300", shell.card)}>
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <Badge className={cn("w-fit uppercase tracking-[0.22em]", shell.badge)}>Premium quick pick</Badge>
              <button
                type="button"
                onClick={() => setIsDark((previous) => !previous)}
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
            <label className={cn("flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-all duration-200 focus-within:ring-2", shell.input)}>
              <Search className={cn("h-4 w-4", shell.secondaryText)} />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search wine, producer, grape..."
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <input
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value.toUpperCase())}
                maxLength={3}
                placeholder="Area code (e.g., M5V)"
                className={cn("rounded-xl border px-3 py-2.5 text-sm outline-none transition-all", shell.input)}
              />
              <select
                value={selectedStoreId}
                onChange={(event) => setSelectedStoreId(event.target.value)}
                className={cn("w-full min-w-0 rounded-xl border px-3 py-2.5 text-sm outline-none transition-all", shell.input)}
              >
                <option value="">Any LCBO</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.label.split(" - ")[0]} ({store.distanceKm.toFixed(1)} km)
                  </option>
                ))}
              </select>
            </div>
            <p className={cn("text-xs", shell.secondaryText)}>Store filter is optional. Leave as "Any LCBO" for wider results.</p>
            {storeLookupLoading ? <p className={cn("text-xs", shell.secondaryText)}>Looking up nearby LCBO stores...</p> : null}
            {storeLookupError ? <p className={cn("text-xs text-amber-500", isDark ? "text-amber-300" : "text-amber-700")}>{storeLookupError}</p> : null}

            <ChipGroup
              label="Wine style"
              options={wineTypeOptions}
              selectedValues={selectedTypes}
              onToggle={(value) => toggleMulti(value as WineType, selectedTypes, setSelectedTypes)}
              activeVariant="accent"
              isDark={isDark}
              initialVisibleCount={5}
            />
            <ChipGroup
              label="Grape you like"
              options={varietalOptions}
              selectedValues={selectedVarietals}
              onToggle={(value) => toggleMulti(value, selectedVarietals, setSelectedVarietals)}
              activeVariant="info"
              isDark={isDark}
              initialVisibleCount={6}
            />
            <ChipGroup
              label="Country"
              options={countryOptions}
              selectedValues={selectedCountries}
              onToggle={(value) => toggleMulti(value, selectedCountries, setSelectedCountries)}
              activeVariant="success"
              isDark={isDark}
              initialVisibleCount={6}
            />
            <ChipGroup
              label="Sub-region"
              options={subRegionOptions}
              selectedValues={selectedSubRegions}
              onToggle={(value) => toggleMulti(value, selectedSubRegions, setSelectedSubRegions)}
              activeVariant="success"
              isDark={isDark}
              initialVisibleCount={6}
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <p className={cn("font-medium", isDark ? "text-zinc-200" : "text-zinc-700")}>Budget range</p>
                <p className={shell.textMuted}>
                  ${minPrice} - ${maxPrice}
                </p>
              </div>
              <div className={cn("relative rounded-xl border p-4", shell.sliderWrap)}>
                <div className={cn("absolute left-4 right-4 top-1/2 h-1.5 -translate-y-1/2 rounded-full", isDark ? "bg-zinc-700" : "bg-zinc-200")} />
                <div
                  className={cn("absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full transition-all duration-150", isDark ? "bg-zinc-100" : "bg-zinc-800")}
                  style={{
                    left: `calc(16px + (${minPricePercent} * (100% - 32px) / 100))`,
                    width: `calc(${maxPricePercent - minPricePercent}% * (100% - 32px) / 100)`,
                  }}
                />
                <input
                  type="range"
                  min={PRICE_MIN}
                  max={PRICE_MAX}
                  value={minPrice}
                  onChange={(event) => setMinPrice(Math.min(Number(event.target.value), maxPrice - 1))}
                  className="price-range relative z-20"
                />
                <input
                  type="range"
                  min={PRICE_MIN}
                  max={PRICE_MAX}
                  value={maxPrice}
                  onChange={(event) => setMaxPrice(Math.max(Number(event.target.value), minPrice + 1))}
                  className="price-range pointer-events-none absolute inset-4 z-30"
                />
              </div>
            </div>

            <Button
              type="button"
              size="lg"
              onClick={onApplyFilters}
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

        {selectedStore ? (
          <Card className={cn("animate-fade-up shadow-sm transition-all duration-300", shell.cardSoft)}>
            <CardContent className="flex items-center justify-between gap-3 pt-4">
              <div className="text-sm">
                <p className={shell.secondaryText}>Selected LCBO</p>
                <p className={cn("max-w-[220px] truncate font-semibold", isDark ? "text-zinc-100" : "text-zinc-900")} title={selectedStore.label}>
                  {selectedStore.label}
                </p>
              </div>
              <Badge className={shell.badge}>{selectedStore.distanceKm.toFixed(1)} km</Badge>
            </CardContent>
          </Card>
        ) : null}

        {favoriteWines.length > 0 ? (
          <Card className={cn("animate-fade-up border shadow-sm", shell.cardSoft)}>
            <CardContent className="pt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className={cn("text-sm font-medium", isDark ? "text-zinc-100" : "text-zinc-900")}>Your favorites</p>
                <Badge className={shell.badge}>{favoriteWines.length}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {favoriteWines.map((wine) => (
                  <div
                    key={wine.id}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs",
                      isDark ? "border-zinc-700 bg-zinc-800/50" : "border-zinc-200 bg-zinc-50",
                    )}
                  >
                    <button type="button" onClick={() => setSelectedWineId(wine.id)} className="text-left">
                      <p className={cn("font-medium", isDark ? "text-zinc-100" : "text-zinc-900")}>{wine.name}</p>
                      <p className={shell.textMuted}>
                        Vivino {wine.rating.toFixed(1)} - ${wine.price.toFixed(2)}
                      </p>
                    </button>
                    <a
                      href={wine.vivinoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn("rounded-md border px-2 py-1", shell.chipIdle)}
                    >
                      Vivino
                    </a>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <section className="space-y-3 pb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recommendations</h2>
            <Badge className={shell.badge}>Vivino matched first</Badge>
          </div>
          {errorText ? (
            <Card className={cn("border-amber-300 bg-amber-50", isDark && "border-amber-500/40 bg-amber-500/10")}>
              <CardContent className={cn("pt-4 text-sm", isDark ? "text-amber-200" : "text-amber-700")}>{errorText}</CardContent>
            </Card>
          ) : null}
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((item) => (
                <Card key={item} className={cn("overflow-hidden border p-4", shell.card)}>
                  <div className="space-y-2">
                    <div className="shimmer h-4 w-2/3 rounded-md" />
                    <div className="shimmer h-3 w-1/2 rounded-md" />
                    <div className="shimmer h-8 w-full rounded-lg" />
                  </div>
                </Card>
              ))}
            </div>
          ) : null}
          {!loading && recommendations.length === 0 && !errorText ? (
            <Card className={cn("border p-0", shell.card)}>
              <CardContent className={cn("space-y-3 pt-4 text-sm", shell.textMuted)}>
                <p>No matching wines yet. Try widening your budget or clearing selections.</p>
                {selectedStoreId ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setSelectedStoreId("")}
                      className={cn(
                        "inline-flex rounded-lg border px-3 py-1.5 text-xs font-medium transition-all hover:scale-[1.01] active:scale-95",
                        shell.chipIdle,
                      )}
                    >
                      No stock at this store right now - try all stores
                    </button>
                    {alternativeLoading ? <p className={cn("text-xs", shell.secondaryText)}>Checking nearby stores with stock...</p> : null}
                    {!alternativeLoading && alternativeStores.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {alternativeStores.slice(0, 3).map((store) => (
                          <button
                            key={store.id}
                            type="button"
                            onClick={() => setSelectedStoreId(store.id)}
                            className={cn(
                              "inline-flex rounded-full border px-3 py-1.5 text-xs font-medium transition-all hover:scale-[1.01] active:scale-95",
                              shell.chipIdle,
                            )}
                          >
                            {store.label} ({store.availableCount})
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {recommendations.slice(0, visibleCount).map((wine, index) => {
            const isExpanded = expandedCard === wine.id;
            const isFavorited = favoriteIds.includes(wine.id);
            const isChosen = selectedWineId === wine.id;
            const confidencePercent = confidenceToPercent(wine.matchScore);
            return (
              <Card
                key={wine.id}
                className={cn(
                  "animate-fade-up space-y-3 border p-4 shadow-sm transition-all duration-300 hover:-translate-y-[2px] hover:shadow-lg",
                  shell.card,
                  isChosen && (isDark ? "border-zinc-200" : "border-zinc-900"),
                )}
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={cn("text-xs uppercase tracking-wide", shell.secondaryText)}>Rank #{index + 1}</p>
                    <h3 className="mt-0.5 text-[17px] font-semibold leading-tight">{wine.name}</h3>
                    <p className={cn("mt-1 text-sm", shell.textMuted)}>
                      {wine.producer} - {wine.region}
                    </p>
                  </div>
                  <Badge className={shell.badge}>${wine.price.toFixed(2)}</Badge>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <p className={cn("flex items-center gap-1", shell.textMuted)}>
                      <ShieldCheck className={cn("h-3.5 w-3.5", isDark ? "text-zinc-200" : "text-zinc-700")} />
                      Match confidence
                    </p>
                    <p className={cn("font-medium", isDark ? "text-zinc-200" : "text-zinc-700")}>{confidencePercent}%</p>
                  </div>
                  <div className={cn("h-2 overflow-hidden rounded-full", isDark ? "bg-zinc-700" : "bg-zinc-200")}>
                    <div className={cn("h-full rounded-full transition-all duration-500", isDark ? "bg-zinc-100" : "bg-zinc-800")} style={{ width: `${confidencePercent}%` }} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className={cn("rounded-lg px-2 py-1.5", isDark ? "bg-zinc-800/70" : "bg-zinc-100")}>
                    <p className={shell.secondaryText}>Vivino</p>
                    <p className="flex items-center gap-1 font-semibold">
                      <Star className="h-3 w-3" />
                      {wine.hasVivinoMatch ? wine.rating.toFixed(1) : "Search"}
                    </p>
                  </div>
                  <div className={cn("rounded-lg px-2 py-1.5", isDark ? "bg-zinc-800/70" : "bg-zinc-100")}>
                    <p className={shell.secondaryText}>Varietal</p>
                    <p className="font-semibold">{wine.varietal}</p>
                  </div>
                  <div className={cn("rounded-lg px-2 py-1.5", isDark ? "bg-zinc-800/70" : "bg-zinc-100")}>
                    <p className={shell.secondaryText}>Reviews</p>
                    <p className="flex items-center gap-1 font-semibold">
                      <Sparkles className="h-3 w-3" />
                      {wine.hasVivinoMatch ? wine.ratingCount : "-"}
                    </p>
                  </div>
                </div>

                <p className={cn("flex items-center gap-1 text-sm", shell.textMuted)}>
                  <MapPin className={cn("h-3.5 w-3.5", shell.secondaryText)} />
                  {wine.storeLabel} - {wine.country}, {wine.subRegion}
                </p>

                <div className="flex items-center gap-2">
                  <Badge className={shell.badge}>{wine.lcboLinkType === "verified_product" ? "Verified LCBO product" : "LCBO search result"}</Badge>
                  <span className={cn("text-xs", shell.secondaryText)}>
                    {wine.hasVivinoMatch ? "Vivino matched rating" : "Vivino search-only fallback"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setExpandedCard(isExpanded ? null : wine.id)}
                    className={cn("text-sm font-medium transition-opacity hover:opacity-80", isDark ? "text-zinc-200" : "text-zinc-700")}
                  >
                    {isExpanded ? "Hide why this pick" : "Why this pick"}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(wine.id)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150 hover:scale-[1.02] active:scale-95",
                      isFavorited
                        ? isDark
                          ? "border-zinc-200 bg-zinc-100 text-zinc-900"
                          : "border-zinc-900 bg-zinc-900 text-white"
                        : shell.chipIdle,
                    )}
                  >
                    <Heart className={cn("h-3 w-3", isFavorited && "fill-current")} />
                    {isFavorited ? "Saved" : "Save"}
                  </button>
                </div>

                {isExpanded ? (
                  <ul className={cn("space-y-2 text-sm animate-fade-up", isDark ? "text-zinc-200" : "text-zinc-700")}>
                    {wine.why.map((reason) => (
                      <li key={reason} className={cn("flex items-start gap-2 rounded-lg border px-2.5 py-2", isDark ? "border-zinc-700 bg-zinc-800/50" : "border-zinc-200 bg-zinc-50")}>
                        <Check className={cn("mt-0.5 h-3.5 w-3.5", isDark ? "text-zinc-100" : "text-zinc-700")} />
                        <span className="leading-snug">{reason}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <a
                  href={wine.lcboUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    setSelectedWineId(wine.id);
                    trackEvent("view_in_lcbo_clicked", { wineId: wine.id, storeId: selectedStoreId || "any" });
                  }}
                  className={cn(
                    "inline-flex h-11 w-full items-center justify-center rounded-xl border text-sm font-medium transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]",
                    isDark ? "border-zinc-200 bg-zinc-100 text-zinc-900 hover:bg-white" : "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800",
                  )}
                >
                  View at LCBO
                </a>
                <a
                  href={wine.vivinoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex h-10 w-full items-center justify-center gap-1 rounded-xl border text-sm font-medium transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]",
                    isDark ? "border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700" : "border-zinc-300 bg-zinc-100 text-zinc-900 hover:bg-zinc-200",
                  )}
                >
                  View on Vivino
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Card>
            );
          })}

          {recommendations.length > visibleCount ? (
            <Button
              type="button"
              onClick={() => setVisibleCount((previous) => previous + 5)}
              className={cn(
                "h-11 w-full rounded-xl",
                isDark ? "border border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700" : "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100",
              )}
            >
              Show more wines
            </Button>
          ) : null}
        </section>
      </main>

      <div className="fixed bottom-4 left-1/2 z-20 w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
        <Card className={cn("border shadow-lg backdrop-blur-xl transition-all duration-300", shell.card)}>
          <CardContent className="flex items-center justify-between gap-3 pt-4">
            {selectedWine ? (
              <>
                <div>
                  <p className={cn("text-xs uppercase tracking-[0.18em]", shell.secondaryText)}>Ready to buy</p>
                  <p className={cn("mt-0.5 line-clamp-1 text-sm font-medium", isDark ? "text-zinc-100" : "text-zinc-900")}>{selectedWine.name}</p>
                </div>
                <a
                  href={selectedWine.lcboUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium",
                    isDark ? "border-zinc-200 bg-zinc-100 text-zinc-900 hover:bg-white" : "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800",
                  )}
                >
                  Open LCBO
                  <ChevronRight className="h-3.5 w-3.5" />
                </a>
              </>
            ) : (
              <>
                <div className={cn("flex items-center gap-2", shell.textMuted)}>
                  <Wine className={cn("h-4 w-4", isDark ? "text-zinc-100" : "text-zinc-700")} />
                  <p className="text-sm">Pick a bottle to continue</p>
                </div>
                <Badge className={shell.badge}>{recommendations.length} shown</Badge>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
