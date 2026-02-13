"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

type ChipGroupProps = {
  label: string;
  options: string[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  isDark: boolean;
  initialVisibleCount?: number;
};

export function ChipGroup({
  label,
  options,
  selectedValues,
  onToggle,
  isDark,
  initialVisibleCount = 6,
}: ChipGroupProps) {
  const [showAll, setShowAll] = useState(false);

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
              selectedValues.includes(option) && (isDark ? "border-zinc-100 bg-zinc-100 text-zinc-900" : "border-zinc-900 bg-zinc-900 text-white"),
            )}
          >
            {option}
          </button>
        ))}
        {hasHiddenOptions ? (
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
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
