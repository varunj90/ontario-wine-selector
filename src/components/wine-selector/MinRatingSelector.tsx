"use client";

import { cn } from "@/lib/utils";

import { MIN_RATING_OPTIONS } from "./constants";
import type { ShellTheme } from "./types";

type MinRatingSelectorProps = {
  value: number;
  onChange: (value: number) => void;
  shell: ShellTheme;
  isDark: boolean;
};

export function MinRatingSelector({ value, onChange, shell, isDark }: MinRatingSelectorProps) {
  return (
    <div className="space-y-2">
      <p className={cn("text-sm font-medium", isDark ? "text-zinc-200" : "text-zinc-700")}>Minimum Vivino rating</p>
      <div className="flex flex-wrap gap-2">
        {MIN_RATING_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition hover:scale-[1.01] active:scale-95",
              isDark ? "border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500" : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500",
              value === option.value && (isDark ? "border-zinc-100 bg-zinc-100 text-zinc-900" : "border-zinc-900 bg-zinc-900 text-white"),
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className={cn("text-xs", shell.secondaryText)}>
        Wines without a trusted Vivino match are always shown as search-only fallback.
      </p>
    </div>
  );
}
