"use client";

import { cn } from "@/lib/utils";

import { MIN_RATING_OPTIONS } from "./constants";
import type { AccentTheme, ShellTheme } from "./types";

type MinRatingSelectorProps = {
  value: number;
  onChange: (value: number) => void;
  shell: ShellTheme;
  isDark: boolean;
  accent?: AccentTheme;
};

export function MinRatingSelector({ value, onChange, isDark, accent }: MinRatingSelectorProps) {
  return (
    <div className="space-y-2">
      <p className={cn(
        "text-[11px] uppercase tracking-[0.06em] font-normal",
        isDark ? "text-stone-500" : "text-stone-400",
      )}>
        Minimum Vivino rating
      </p>
      <div className="flex flex-wrap gap-1.5">
        {MIN_RATING_OPTIONS.map((option) => {
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-full border px-2.5 py-[5px] text-[13px] font-normal transition-all duration-200 active:scale-95",
                !isSelected && isDark && "border-stone-700/50 bg-stone-800/40 text-stone-400 hover:border-stone-600 hover:text-stone-300",
                !isSelected && !isDark && "border-stone-200 bg-stone-50 text-stone-500 hover:border-stone-300 hover:text-stone-600",
                isSelected && accent && isDark && accent.chipActive,
                isSelected && accent && !isDark && accent.chipActiveLight,
                isSelected && !accent && isDark && "border-[#f5f0eb]/40 bg-[#f5f0eb] text-stone-900 font-medium",
                isSelected && !accent && !isDark && "border-stone-800 bg-stone-900 text-white font-medium",
              )}
              style={{ transitionTimingFunction: "var(--spring)" }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className={cn("text-[11px] leading-relaxed", isDark ? "text-stone-600" : "text-stone-400")}>
        Wines without a trusted Vivino match are always shown as search-only fallback.
      </p>
    </div>
  );
}
