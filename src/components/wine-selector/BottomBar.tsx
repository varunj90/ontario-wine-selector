"use client";

import { ChevronRight, Wine } from "lucide-react";

import { cn } from "@/lib/utils";

import type { ShellTheme, WinePick } from "./types";

type BottomBarProps = {
  selectedWine: WinePick | null;
  recommendationCount: number;
  shell: ShellTheme;
  isDark: boolean;
};

export function BottomBar({ selectedWine, recommendationCount, shell, isDark }: BottomBarProps) {
  return (
    <div className="fixed bottom-5 left-1/2 z-20 -translate-x-1/2">
      <div
        className={cn(
          "flex items-center gap-3 border transition-all duration-500",
          /* Morph sizing */
          selectedWine
            ? "w-[calc(100vw-2rem)] max-w-md justify-between rounded-2xl px-5 py-3.5"
            : "w-auto rounded-full px-5 py-3",
          /* Glass surface */
          isDark
            ? "border-stone-700/30 bg-stone-900/85 backdrop-blur-2xl"
            : "border-stone-200/70 bg-white/90 backdrop-blur-2xl",
        )}
        style={{
          transitionTimingFunction: "var(--spring)",
          boxShadow: isDark
            ? "0 4px 24px rgba(0,0,0,0.5), 0 12px 48px rgba(0,0,0,0.3)"
            : "0 4px 24px rgba(0,0,0,0.08), 0 12px 48px rgba(0,0,0,0.06)",
        }}
      >
        {selectedWine ? (
          <>
            <div className="min-w-0 flex-1">
              <p className={cn("text-[10px] font-medium uppercase tracking-[0.2em]", isDark ? "text-stone-500" : "text-stone-400")}>
                Ready to buy
              </p>
              <p className={cn(
                "mt-0.5 truncate text-[14px] font-semibold tracking-[-0.01em]",
                isDark ? "text-[#f5f0eb]" : "text-stone-900",
              )}>
                {selectedWine.name}
              </p>
            </div>
            <a
              href={selectedWine.lcboUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-all duration-300 hover:scale-[1.03] active:scale-95",
                isDark
                  ? "bg-[#f5f0eb] text-stone-900 hover:bg-white"
                  : "bg-stone-900 text-white hover:bg-stone-800",
              )}
              style={{ transitionTimingFunction: "var(--spring)" }}
            >
              Open LCBO
              <ChevronRight className="h-3.5 w-3.5" />
            </a>
          </>
        ) : (
          <div className={cn("flex items-center gap-2.5 whitespace-nowrap", isDark ? "text-stone-400" : "text-stone-500")}>
            <Wine className="h-4 w-4" />
            <span className="text-[13px]">
              {recommendationCount > 0
                ? `Pick a bottle · ${recommendationCount} shown`
                : "Pick a bottle to continue"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
