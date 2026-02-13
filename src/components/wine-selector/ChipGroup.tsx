"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import type { AccentTheme } from "./types";

type ChipGroupProps = {
  label: string;
  options: string[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  isDark: boolean;
  accent?: AccentTheme;
  initialVisibleCount?: number;
};

export function ChipGroup({
  label,
  options,
  selectedValues,
  onToggle,
  isDark,
  accent,
  initialVisibleCount = 6,
}: ChipGroupProps) {
  const [showAll, setShowAll] = useState(false);

  const visibleOptions = showAll ? options : options.slice(0, initialVisibleCount);
  const hasHiddenOptions = options.length > initialVisibleCount;

  return (
    <div className="space-y-2">
      <p className={cn(
        "text-[11px] uppercase tracking-[0.06em] font-normal",
        isDark ? "text-stone-500" : "text-stone-400",
      )}>
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {visibleOptions.map((option) => {
          const isSelected = selectedValues.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              className={cn(
                "rounded-full border px-2.5 py-[5px] text-[13px] font-normal transition-all duration-200 active:scale-95",
                /* Unselected */
                !isSelected && isDark && "border-stone-700/50 bg-stone-800/40 text-stone-400 hover:border-stone-600 hover:text-stone-300",
                !isSelected && !isDark && "border-stone-200 bg-stone-50 text-stone-500 hover:border-stone-300 hover:text-stone-600",
                /* Selected with accent */
                isSelected && accent && isDark && accent.chipActive,
                isSelected && accent && !isDark && accent.chipActiveLight,
                /* Selected fallback (no accent) */
                isSelected && !accent && isDark && "border-[#f5f0eb]/40 bg-[#f5f0eb] text-stone-900 font-medium",
                isSelected && !accent && !isDark && "border-stone-800 bg-stone-900 text-white font-medium",
              )}
              style={{ transitionTimingFunction: "var(--spring)" }}
            >
              {option}
            </button>
          );
        })}
        {hasHiddenOptions ? (
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className={cn(
              "rounded-full border px-2.5 py-[5px] text-[13px] font-normal transition-all duration-200 active:scale-95",
              isDark
                ? "border-stone-700/40 bg-transparent text-stone-500 hover:text-stone-300"
                : "border-stone-200 bg-transparent text-stone-400 hover:text-stone-600",
            )}
          >
            {showAll ? "Less" : `+${options.length - initialVisibleCount} more`}
          </button>
        ) : null}
      </div>
    </div>
  );
}
