"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { AccentTheme, AlternativeStoreOption, ShellTheme, WinePick } from "./types";
import { WineCard } from "./WineCard";

type RecommendationListProps = {
  recommendations: WinePick[];
  loading: boolean;
  errorText: string | null;
  selectedStoreId: string;
  expandedCard: string | null;
  onExpandCard: (id: string | null) => void;
  selectedWineId: string | null;
  onSelectWine: (id: string) => void;
  visibleCount: number;
  onShowMore: () => void;
  isFavorited: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
  onClearStore: () => void;
  alternativeStores: AlternativeStoreOption[];
  alternativeLoading: boolean;
  onSelectAlternativeStore: (storeId: string) => void;
  shell: ShellTheme;
  isDark: boolean;
  accent: AccentTheme;
};

export function RecommendationList({
  recommendations,
  loading,
  errorText,
  selectedStoreId,
  expandedCard,
  onExpandCard,
  selectedWineId,
  onSelectWine,
  visibleCount,
  onShowMore,
  isFavorited,
  onToggleFavorite,
  onClearStore,
  alternativeStores,
  alternativeLoading,
  onSelectAlternativeStore,
  shell,
  isDark,
  accent,
}: RecommendationListProps) {

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={cn(
          "text-[20px] font-semibold tracking-[-0.02em]",
          isDark ? "text-[#f5f0eb]" : "text-stone-900",
        )}>
          Recommendations
        </h2>
        <Badge className={cn(
          "text-[10px]",
          isDark
            ? "border-stone-700/40 bg-stone-800/40 text-stone-400"
            : "border-stone-200 bg-stone-100 text-stone-500",
        )}>
          Vivino matched first
        </Badge>
      </div>

      {/* Error */}
      {errorText ? (
        <div className={cn(
          "rounded-2xl border p-4 text-[13px]",
          isDark
            ? "border-amber-500/20 bg-amber-500/5 text-amber-200"
            : "border-amber-300 bg-amber-50 text-amber-700",
        )}>
          {errorText}
        </div>
      ) : null}

      {/* Loading skeleton */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className={cn(
                "rounded-3xl border p-5",
                isDark ? "border-stone-700/20 bg-stone-900/30" : "border-stone-200/50 bg-white/50",
              )}
            >
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className={cn("h-10 w-10 rounded-full animate-pulse-soft", isDark ? "bg-stone-800/50" : "bg-stone-200/60")} />
                  <div className="flex-1 space-y-2.5">
                    <div className={cn("h-5 w-4/5 rounded-lg animate-pulse-soft", isDark ? "bg-stone-800/40" : "bg-stone-200/50")} />
                    <div className={cn("h-3.5 w-1/2 rounded-md animate-pulse-soft", isDark ? "bg-stone-800/30" : "bg-stone-200/40")} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((s) => (
                    <div
                      key={s}
                      className={cn("h-14 rounded-2xl animate-pulse-soft", isDark ? "bg-stone-800/25" : "bg-stone-100/60")}
                      style={{ animationDelay: `${s * 200}ms` }}
                    />
                  ))}
                </div>
                <div className={cn("h-12 rounded-2xl animate-pulse-soft", isDark ? "bg-stone-800/20" : "bg-stone-100/40")} />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Empty */}
      {!loading && recommendations.length === 0 && !errorText ? (
        <div className={cn(
          "rounded-3xl border p-5",
          isDark ? "border-stone-700/20 bg-stone-900/30" : "border-stone-200/50 bg-white/50",
        )}>
          <div className={cn("space-y-3 text-[13px]", isDark ? "text-stone-400" : "text-stone-500")}>
            <p>No matching wines yet. Try widening your budget, lowering the rating threshold, or clearing selections.</p>
            {selectedStoreId ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={onClearStore}
                  className={cn(
                    "rounded-xl border px-3.5 py-2 text-[12px] font-medium transition-all duration-300 active:scale-95",
                    isDark
                      ? "border-stone-700/40 bg-stone-800/30 text-stone-300 hover:border-stone-500"
                      : "border-stone-200 bg-white text-stone-600 hover:border-stone-400",
                  )}
                  style={{ transitionTimingFunction: "var(--spring)" }}
                >
                  No stock at this store — try all stores
                </button>
                {alternativeLoading ? <p className={cn("text-[11px]", isDark ? "text-stone-500" : "text-stone-400")}>Checking nearby stores…</p> : null}
                {!alternativeLoading && alternativeStores.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {alternativeStores.slice(0, 3).map((store) => (
                      <button
                        key={store.id}
                        type="button"
                        onClick={() => onSelectAlternativeStore(store.id)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all duration-300 active:scale-95",
                          isDark
                            ? "border-stone-700/40 bg-stone-800/30 text-stone-300 hover:border-stone-500"
                            : "border-stone-200 bg-white text-stone-600 hover:border-stone-400",
                        )}
                        style={{ transitionTimingFunction: "var(--spring)" }}
                      >
                        {store.label} ({store.availableCount})
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Wine cards */}
      {recommendations.slice(0, visibleCount).map((wine, index) => (
        <WineCard
          key={wine.id}
          wine={wine}
          rank={index + 1}
          isExpanded={expandedCard === wine.id}
          isFavorited={isFavorited(wine.id)}
          isChosen={selectedWineId === wine.id}
          selectedStoreId={selectedStoreId}
          onToggleExpand={() => onExpandCard(expandedCard === wine.id ? null : wine.id)}
          onToggleFavorite={() => onToggleFavorite(wine.id)}
          onSelect={() => onSelectWine(wine.id)}
          shell={shell}
          isDark={isDark}
          accent={accent}
          animationDelay={index * 60}
        />
      ))}

      {/* Load more */}
      {recommendations.length > visibleCount ? (
        <button
          type="button"
          onClick={onShowMore}
          className={cn(
            "flex h-[48px] w-full items-center justify-center rounded-2xl border text-[14px] font-medium transition-all duration-300 active:scale-[0.98]",
            isDark
              ? "border-stone-700/30 bg-stone-800/20 text-stone-300 hover:bg-stone-700/30"
              : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50",
          )}
          style={{ transitionTimingFunction: "var(--spring)" }}
        >
          Show more wines
        </button>
      ) : null}
    </section>
  );
}
