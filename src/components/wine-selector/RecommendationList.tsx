"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { AlternativeStoreOption, ShellTheme, WinePick } from "./types";
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
  isFavorited: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
  onClearStore: () => void;
  alternativeStores: AlternativeStoreOption[];
  alternativeLoading: boolean;
  onSelectAlternativeStore: (storeId: string) => void;
  shell: ShellTheme;
  isDark: boolean;
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
  isFavorited,
  onToggleFavorite,
  onClearStore,
  alternativeStores,
  alternativeLoading,
  onSelectAlternativeStore,
  shell,
  isDark,
}: RecommendationListProps) {
  const [visibleCount, setVisibleCount] = useState(5);

  return (
    <section className="space-y-3 pb-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recommendations</h2>
        <Badge className={shell.badge}>Vivino matched first</Badge>
      </div>

      {/* Error state */}
      {errorText ? (
        <Card className={cn("border-amber-300 bg-amber-50", isDark && "border-amber-500/40 bg-amber-500/10")}>
          <CardContent className={cn("pt-4 text-sm", isDark ? "text-amber-200" : "text-amber-700")}>{errorText}</CardContent>
        </Card>
      ) : null}

      {/* Loading skeleton */}
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

      {/* Empty state */}
      {!loading && recommendations.length === 0 && !errorText ? (
        <Card className={cn("border p-0", shell.card)}>
          <CardContent className={cn("space-y-3 pt-4 text-sm", shell.textMuted)}>
            <p>No matching wines yet. Try widening your budget, lowering the rating threshold, or clearing selections.</p>
            {selectedStoreId ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={onClearStore}
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
                        onClick={() => onSelectAlternativeStore(store.id)}
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
          animationDelay={index * 40}
        />
      ))}

      {/* Load more */}
      {recommendations.length > visibleCount ? (
        <Button
          type="button"
          onClick={() => setVisibleCount((prev) => prev + 5)}
          className={cn(
            "h-11 w-full rounded-xl",
            isDark ? "border border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700" : "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100",
          )}
        >
          Show more wines
        </Button>
      ) : null}
    </section>
  );
}
