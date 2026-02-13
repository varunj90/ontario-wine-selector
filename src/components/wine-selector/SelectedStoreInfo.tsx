"use client";

import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

import type { ShellTheme, StoreOption } from "./types";

type SelectedStoreInfoProps = {
  store: StoreOption;
  shell: ShellTheme;
  isDark: boolean;
};

export function SelectedStoreInfo({ store, isDark }: SelectedStoreInfoProps) {
  return (
    <div
      className={cn(
        "animate-fade-up flex items-center justify-between gap-3 rounded-2xl border px-5 py-4 transition-all duration-500",
        isDark
          ? "border-stone-700/25 bg-stone-900/40"
          : "border-stone-200/50 bg-white/60",
      )}
    >
      <div className="flex items-center gap-3 text-[13px]">
        <MapPin className={cn("h-4 w-4 shrink-0", isDark ? "text-stone-500" : "text-stone-400")} />
        <div>
          <p className={cn("text-[11px]", isDark ? "text-stone-500" : "text-stone-400")}>Selected LCBO</p>
          <p className={cn("max-w-[220px] truncate font-medium", isDark ? "text-[#f5f0eb]" : "text-stone-800")} title={store.label}>
            {store.label}
          </p>
        </div>
      </div>
      <span className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium tabular-nums",
        isDark ? "bg-stone-800/40 text-stone-400" : "bg-stone-100 text-stone-500",
      )}>
        {store.distanceKm.toFixed(1)} km
      </span>
    </div>
  );
}
