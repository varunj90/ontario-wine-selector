"use client";

import { cn } from "@/lib/utils";

import { PRICE_MAX, PRICE_MIN } from "./constants";
import type { ShellTheme } from "./types";

type PriceRangeSliderProps = {
  minPrice: number;
  maxPrice: number;
  onMinChange: (value: number) => void;
  onMaxChange: (value: number) => void;
  shell: ShellTheme;
  isDark: boolean;
};

export function PriceRangeSlider({ minPrice, maxPrice, onMinChange, onMaxChange, shell, isDark }: PriceRangeSliderProps) {
  const minPercent = ((minPrice - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100;
  const maxPercent = ((maxPrice - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100;

  return (
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
            left: `calc(16px + (${minPercent} * (100% - 32px) / 100))`,
            width: `calc(${maxPercent - minPercent}% * (100% - 32px) / 100)`,
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
          className="price-range pointer-events-none absolute inset-4 z-30"
        />
      </div>
    </div>
  );
}
