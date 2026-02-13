"use client";

import { cn } from "@/lib/utils";

import { PRICE_MAX, PRICE_MIN } from "./constants";
import type { AccentTheme, ShellTheme } from "./types";

type PriceRangeSliderProps = {
  minPrice: number;
  maxPrice: number;
  onMinChange: (value: number) => void;
  onMaxChange: (value: number) => void;
  shell: ShellTheme;
  isDark: boolean;
  accent?: AccentTheme;
};

export function PriceRangeSlider({ minPrice, maxPrice, onMinChange, onMaxChange, isDark, accent }: PriceRangeSliderProps) {
  const minPercent = ((minPrice - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100;
  const maxPercent = ((maxPrice - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100;

  const trackColor = accent
    ? isDark ? accent.sliderTrack : accent.sliderTrackLight
    : isDark ? "bg-[#f5f0eb]" : "bg-stone-800";

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className={cn(
          "text-[11px] uppercase tracking-[0.06em] font-normal",
          isDark ? "text-stone-500" : "text-stone-400",
        )}>
          Budget range
        </p>
        <p className={cn("text-[14px] font-semibold tabular-nums", isDark ? "text-stone-200" : "text-stone-700")}>
          ${minPrice} – ${maxPrice}
        </p>
      </div>
      {/* Seamless slider — no border container */}
      <div className="relative py-3">
        {/* Track bg */}
        <div className={cn(
          "absolute left-0 right-0 top-1/2 h-[5px] -translate-y-1/2 rounded-full",
          isDark ? "bg-stone-800" : "bg-stone-200",
        )} />
        {/* Active track */}
        <div
          className={cn("absolute top-1/2 h-[5px] -translate-y-1/2 rounded-full transition-all duration-150", trackColor)}
          style={{
            left: `${minPercent}%`,
            width: `${maxPercent - minPercent}%`,
          }}
        />
        <input
          type="range"
          min={PRICE_MIN}
          max={PRICE_MAX}
          value={minPrice}
          onChange={(e) => onMinChange(Math.min(Number(e.target.value), maxPrice - 1))}
          className="price-range relative z-20"
        />
        <input
          type="range"
          min={PRICE_MIN}
          max={PRICE_MAX}
          value={maxPrice}
          onChange={(e) => onMaxChange(Math.max(Number(e.target.value), minPrice + 1))}
          className="price-range pointer-events-none absolute inset-0 z-30"
        />
      </div>
    </div>
  );
}
