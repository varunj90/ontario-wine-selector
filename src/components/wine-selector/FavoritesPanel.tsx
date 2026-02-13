"use client";

import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

import type { ShellTheme, WinePick } from "./types";

type FavoritesPanelProps = {
  wines: WinePick[];
  onSelectWine: (id: string) => void;
  shell: ShellTheme;
  isDark: boolean;
};

export function FavoritesPanel({ wines, onSelectWine, isDark }: FavoritesPanelProps) {
  if (wines.length === 0) return null;

  return (
    <div
      className={cn(
        "animate-fade-up rounded-3xl border p-5",
        isDark
          ? "glass-card border-stone-700/25 bg-stone-900/40"
          : "glass-card-light border-stone-200/50 bg-white/60",
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <Heart className={cn("h-4 w-4", isDark ? "text-stone-400" : "text-stone-500")} />
        <p className={cn("text-[13px] font-semibold", isDark ? "text-[#f5f0eb]" : "text-stone-800")}>
          Your favorites
        </p>
        <span className={cn(
          "ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium",
          isDark ? "bg-stone-800/40 text-stone-400" : "bg-stone-100 text-stone-500",
        )}>
          {wines.length}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {wines.map((wine) => (
          <div
            key={wine.id}
            className={cn(
              "flex items-center justify-between rounded-2xl border px-4 py-3 transition-all duration-200",
              isDark
                ? "border-stone-700/25 bg-stone-800/15 hover:bg-stone-800/25"
                : "border-stone-100 bg-stone-50/50 hover:bg-stone-50",
            )}
          >
            <button type="button" onClick={() => onSelectWine(wine.id)} className="min-w-0 flex-1 text-left">
              <p className={cn(
                "truncate text-[14px] font-semibold tracking-[-0.01em]",
                isDark ? "text-[#f5f0eb]" : "text-stone-800",
              )}>
                {wine.name}
              </p>
              <p className={cn("mt-0.5 text-[11px]", isDark ? "text-stone-500" : "text-stone-400")}>
                {wine.hasVivinoMatch ? `Vivino ${wine.rating.toFixed(1)}` : "Vivino search"} — ${wine.price.toFixed(2)}
              </p>
            </button>
            <a
              href={wine.vivinoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "ml-3 shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all duration-300 hover:scale-[1.03] active:scale-95",
                isDark
                  ? "border-stone-700/40 text-stone-400 hover:border-stone-500"
                  : "border-stone-200 text-stone-500 hover:border-stone-400",
              )}
              style={{ transitionTimingFunction: "var(--spring)" }}
            >
              Vivino
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
