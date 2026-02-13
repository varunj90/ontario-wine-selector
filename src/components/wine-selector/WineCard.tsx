"use client";

import { Check, ExternalLink, Heart, MapPin, Star, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { trackEvent } from "./analytics";
import type { ShellTheme, WinePick } from "./types";

type WineCardProps = {
  wine: WinePick;
  rank: number;
  isExpanded: boolean;
  isFavorited: boolean;
  isChosen: boolean;
  selectedStoreId: string;
  onToggleExpand: () => void;
  onToggleFavorite: () => void;
  onSelect: () => void;
  shell: ShellTheme;
  isDark: boolean;
  animationDelay: number;
};

export function WineCard({
  wine,
  rank,
  isExpanded,
  isFavorited,
  isChosen,
  selectedStoreId,
  onToggleExpand,
  onToggleFavorite,
  onSelect,
  shell,
  isDark,
  animationDelay,
}: WineCardProps) {
  const hasDirectVivinoUrl = /\/w\/|\/wines\//.test(wine.vivinoUrl);

  return (
    <Card
      className={cn(
        "animate-fade-up space-y-3 border p-4 shadow-sm transition-all duration-300 hover:-translate-y-[2px] hover:shadow-lg",
        shell.card,
        isChosen && (isDark ? "border-zinc-200" : "border-zinc-900"),
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Header: rank, name, price */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={cn("text-xs uppercase tracking-wide", shell.secondaryText)}>Rank #{rank}</p>
          <h3 className="mt-0.5 text-[17px] font-semibold leading-tight">{wine.name}</h3>
          <p className={cn("mt-1 text-sm", shell.textMuted)}>
            {wine.producer} - {wine.region}
          </p>
        </div>
        <Badge className={shell.badge}>${wine.price.toFixed(2)}</Badge>
      </div>

      {/* Stats grid: Vivino rating, varietal, reviews */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className={cn("rounded-lg px-2 py-1.5", isDark ? "bg-zinc-800/70" : "bg-zinc-100")}>
          <p className={shell.secondaryText}>Vivino</p>
          <p className="flex items-center gap-1 font-semibold">
            <Star className={cn("h-3 w-3", wine.hasVivinoMatch ? "fill-amber-400 text-amber-400" : "")} />
            {wine.hasVivinoMatch ? `${wine.rating.toFixed(1)}/5` : "Search"}
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
            {wine.hasVivinoMatch ? wine.ratingCount.toLocaleString() : "-"}
          </p>
        </div>
      </div>

      {/* Stock and store info */}
      <div className="flex items-center justify-between text-xs">
        <p className={cn("flex items-center gap-1", shell.textMuted)}>
          <MapPin className={cn("h-3.5 w-3.5", shell.secondaryText)} />
          <span className="max-w-[180px] truncate">{wine.storeLabel}</span>
        </p>
        <Badge className={cn(
          "text-[10px]",
          wine.stockConfidence === "High"
            ? isDark ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-emerald-600/30 bg-emerald-50 text-emerald-700"
            : shell.badge,
        )}>
          {wine.stockConfidence === "High" ? "In stock" : "Limited"}
        </Badge>
      </div>

      {/* Vivino match and LCBO link info */}
      <div className="flex items-center gap-2">
        <Badge className={shell.badge}>{wine.lcboLinkType === "verified_product" ? "Verified LCBO" : "LCBO search"}</Badge>
        <span className={cn("text-xs", shell.secondaryText)}>
          {wine.hasVivinoMatch
            ? `Vivino match (${Math.round((wine.vivinoMatchConfidence ?? 0) * 100)}%)`
            : "Vivino search-only"}
        </span>
      </div>

      {/* Why this pick toggle + favorite */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onToggleExpand}
          className={cn("text-sm font-medium transition-opacity hover:opacity-80", isDark ? "text-zinc-200" : "text-zinc-700")}
        >
          {isExpanded ? "Hide why this pick" : "Why this pick"}
        </button>
        <button
          type="button"
          onClick={onToggleFavorite}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150 hover:scale-[1.02] active:scale-95",
            isFavorited
              ? isDark ? "border-zinc-200 bg-zinc-100 text-zinc-900" : "border-zinc-900 bg-zinc-900 text-white"
              : shell.chipIdle,
          )}
        >
          <Heart className={cn("h-3 w-3", isFavorited && "fill-current")} />
          {isFavorited ? "Saved" : "Save"}
        </button>
      </div>

      {/* Expanded reasons */}
      {isExpanded ? (
        <ul className={cn("space-y-2 text-sm animate-fade-up", isDark ? "text-zinc-200" : "text-zinc-700")}>
          {wine.why.map((reason) => (
            <li key={reason} className={cn("flex items-start gap-2 rounded-lg border px-2.5 py-2", isDark ? "border-zinc-700 bg-zinc-800/50" : "border-zinc-200 bg-zinc-50")}>
              <Check className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", isDark ? "text-zinc-100" : "text-zinc-700")} />
              <span className="leading-snug">{reason}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Action buttons */}
      <a
        href={wine.lcboUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          onSelect();
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
        {hasDirectVivinoUrl ? "View on Vivino" : "Search on Vivino"}
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </Card>
  );
}
