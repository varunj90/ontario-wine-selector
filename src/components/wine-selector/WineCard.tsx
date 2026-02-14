"use client";

import { ExternalLink, Heart, MapPin, Star, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { trackEvent } from "./analytics";
import type { AccentTheme, ShellTheme, WinePick } from "./types";

type WineCardProps = {
  wine: WinePick;
  rank: number;
  isFavorited: boolean;
  isChosen: boolean;
  selectedStoreId: string;
  onToggleFavorite: () => void;
  onSelect: () => void;
  shell: ShellTheme;
  isDark: boolean;
  accent: AccentTheme;
  animationDelay: number;
};

export function WineCard({
  wine,
  rank,
  isFavorited,
  isChosen,
  selectedStoreId,
  onToggleFavorite,
  onSelect,
  shell,
  isDark,
  accent,
  animationDelay,
}: WineCardProps) {
  const hasDirectVivinoUrl = wine.vivinoUrl.startsWith("https://www.vivino.com/") && !wine.vivinoUrl.includes("/search/wines");

  return (
    <div
      className={cn(
        "animate-fade-up relative space-y-4 rounded-3xl border p-5 transition-all duration-[400ms] hover:-translate-y-[3px]",
        isDark
          ? "glass-card border-stone-700/30 bg-stone-900/55"
          : "glass-card-light border-stone-200/70 bg-white/80",
        isChosen && (isDark ? "border-stone-400/40 ring-1 ring-stone-400/20" : "border-stone-700 ring-1 ring-stone-900/10"),
      )}
      style={{
        animationDelay: `${animationDelay}ms`,
        transitionTimingFunction: "var(--spring)",
      }}
    >
      {/* Bubbly decoration */}
      {accent.hasBubbles ? (
        <>
          <span className="bubble-dot absolute right-5 top-4 h-2.5 w-2.5 bg-yellow-300/20" style={{ animationDelay: "0s" }} />
          <span className="bubble-dot absolute right-9 top-8 h-1.5 w-1.5 bg-yellow-300/15" style={{ animationDelay: "1s" }} />
          <span className="bubble-dot absolute right-3 top-10 h-1 w-1 bg-yellow-300/25" style={{ animationDelay: "2s" }} />
        </>
      ) : null}

      {/* Header: rank circle + name + price */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white shadow-lg",
              accent.rankBg,
            )}
          >
            #{rank}
          </div>
          <div className="pt-0.5">
            <h3 className={cn(
              "text-[16px] font-semibold leading-snug tracking-[-0.01em]",
              isDark ? "text-[#f5f0eb]" : "text-stone-900",
            )}>
              {wine.name}
            </h3>
            <p className={cn("mt-1 text-[13px]", isDark ? "text-stone-400" : "text-stone-500")}>
              {wine.producer} — {wine.region}
            </p>
          </div>
        </div>
        <Badge className={cn(
          "shrink-0 text-[13px] font-semibold tabular-nums",
          isDark
            ? "border-stone-600/40 bg-stone-800/50 text-stone-200"
            : "border-stone-200 bg-stone-100 text-stone-700",
        )}>
          ${wine.price.toFixed(2)}
        </Badge>
      </div>

      {/* Stats: Vivino (accent glow), varietal, reviews */}
      <div className="grid grid-cols-3 gap-2">
        {/* Vivino — accent highlight */}
        <div className={cn(
          "rounded-2xl border px-3 py-2.5",
          accent.glow, accent.glowBorder,
        )}>
          <p className={cn("text-[10px] font-medium uppercase tracking-[0.06em]", accent.glowText)}>
            {wine.ratingSource === "direct" ? "Vivino" : wine.ratingSource === "producer_avg" ? "Producer Avg" : "Rating"}
          </p>
          <p className={cn("mt-1 flex items-center gap-1 text-[16px] font-bold leading-none", isDark ? "text-[#f5f0eb]" : "text-stone-900")}>
            <Star className={cn("h-3.5 w-3.5", wine.rating > 0 ? accent.starFill : "text-stone-500")} />
            {wine.rating > 0 ? `${wine.rating.toFixed(1)}` : "—"}
          </p>
        </div>
        <div className={cn("rounded-2xl px-3 py-2.5 overflow-hidden", isDark ? "bg-stone-800/40" : "bg-stone-50")}>
          <p className={cn("text-[10px] font-medium uppercase tracking-[0.06em]", isDark ? "text-stone-500" : "text-stone-400")}>Varietal</p>
          <p className={cn("mt-1 text-[13px] font-semibold leading-tight line-clamp-2", isDark ? "text-stone-200" : "text-stone-700")}>{wine.varietal}</p>
        </div>
        <div className={cn("rounded-2xl px-3 py-2.5", isDark ? "bg-stone-800/40" : "bg-stone-50")}>
          <p className={cn("text-[10px] font-medium uppercase tracking-[0.06em]", isDark ? "text-stone-500" : "text-stone-400")}>Reviews</p>
          <p className={cn("mt-1 flex items-center gap-1 text-[13px] font-semibold leading-none", isDark ? "text-stone-200" : "text-stone-700")}>
            <Sparkles className="h-3 w-3" />
            {wine.ratingSource === "direct" && wine.ratingCount > 0 ? wine.ratingCount.toLocaleString() : wine.ratingSource === "producer_avg" ? "est." : "—"}
          </p>
        </div>
      </div>

      {/* Store + stock */}
      <div className="flex items-center justify-between text-[12px]">
        <p className={cn("flex items-center gap-1.5", isDark ? "text-stone-400" : "text-stone-500")}>
          <MapPin className="h-3.5 w-3.5" />
          <span className="max-w-[180px] truncate">{wine.storeLabel}</span>
        </p>
        <span className={cn(
          "rounded-full px-2 py-0.5 text-[10px] font-medium",
          wine.stockConfidence === "High"
            ? isDark
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-emerald-50 text-emerald-700"
            : isDark
              ? "bg-stone-800/50 text-stone-400"
              : "bg-stone-100 text-stone-500",
        )}>
          {wine.stockConfidence === "High" ? "In stock" : "Limited"}
        </span>
      </div>

      {/* Match info */}
      <div className="flex items-center gap-2 text-[11px]">
        <span className={cn(
          "rounded-full border px-2 py-0.5",
          isDark ? "border-stone-700/40 text-stone-400" : "border-stone-200 text-stone-500",
        )}>
          {wine.lcboLinkType === "verified_product" ? "Verified LCBO" : "LCBO search"}
        </span>
        <span className={isDark ? "text-stone-500" : "text-stone-400"}>
          {wine.ratingSource === "direct"
            ? `Vivino match (${Math.round((wine.vivinoMatchConfidence ?? 0) * 100)}%)`
            : wine.ratingSource === "producer_avg"
              ? "Producer avg rating"
              : "Search on Vivino"}
        </span>
      </div>

      {/* Save button */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onToggleFavorite}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all duration-300 hover:scale-[1.04] active:scale-95",
            isFavorited
              ? isDark ? "border-stone-300/30 bg-[#f5f0eb] text-stone-900" : "border-stone-800 bg-stone-900 text-white"
              : isDark ? "border-stone-700/40 bg-stone-800/30 text-stone-400 hover:border-stone-500" : "border-stone-200 bg-white text-stone-500 hover:border-stone-400",
          )}
          style={{ transitionTimingFunction: "var(--spring)" }}
        >
          <Heart className={cn("h-3 w-3", isFavorited && "fill-current")} />
          {isFavorited ? "Saved" : "Save"}
        </button>
      </div>

      {/* Action buttons */}
      <div className="space-y-2.5">
        <a
          href={wine.lcboUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            onSelect();
            trackEvent("view_in_lcbo_clicked", { wineId: wine.id, storeId: selectedStoreId || "any" });
          }}
          className={cn(
            "flex h-[48px] w-full items-center justify-center rounded-2xl text-[15px] font-semibold transition-all duration-300 hover:scale-[1.01] active:scale-[0.98]",
            isDark
              ? "bg-[#f5f0eb] text-stone-900 hover:bg-white"
              : "bg-stone-900 text-white hover:bg-stone-800",
          )}
          style={{ transitionTimingFunction: "var(--spring)" }}
        >
          View at LCBO
        </a>
        <a
          href={wine.vivinoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex h-[44px] w-full items-center justify-center gap-1.5 rounded-2xl border text-[13px] font-medium transition-all duration-300 hover:scale-[1.01] active:scale-[0.98]",
            isDark
              ? "border-stone-700/30 bg-stone-800/20 text-stone-300 hover:bg-stone-700/30"
              : "border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100",
          )}
          style={{ transitionTimingFunction: "var(--spring)" }}
        >
          {hasDirectVivinoUrl ? "View on Vivino" : "Search on Vivino"}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
