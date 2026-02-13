"use client";

import { cn } from "@/lib/utils";

import type { ShellTheme, StoreOption } from "./types";

type StoreSelectorProps = {
  postalCode: string;
  onPostalCodeChange: (value: string) => void;
  selectedStoreId: string;
  onStoreChange: (storeId: string) => void;
  stores: StoreOption[];
  loading: boolean;
  error: string | null;
  shell: ShellTheme;
  isDark: boolean;
};

export function StoreSelector({
  postalCode,
  onPostalCodeChange,
  selectedStoreId,
  onStoreChange,
  stores,
  loading,
  error,
  isDark,
}: StoreSelectorProps) {
  const inputClass = cn(
    "h-[44px] rounded-2xl border px-4 text-[14px] outline-none transition-all duration-200",
    "focus:ring-2",
    isDark
      ? "border-stone-600/50 bg-stone-800/50 text-stone-100 placeholder:text-stone-500 focus:border-stone-500 focus:ring-stone-500/10"
      : "border-stone-300 bg-white text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:ring-stone-400/10",
  );

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          value={postalCode}
          onChange={(e) => onPostalCodeChange(e.target.value.toUpperCase())}
          maxLength={3}
          placeholder="Area code"
          className={inputClass}
        />
        <select
          value={selectedStoreId}
          onChange={(e) => onStoreChange(e.target.value)}
          className={cn(inputClass, "w-full min-w-0")}
        >
          <option value="">Any LCBO</option>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.label.split(" - ")[0]} ({store.distanceKm.toFixed(1)} km)
            </option>
          ))}
        </select>
      </div>
      <p className={cn("text-[11px]", isDark ? "text-stone-600" : "text-stone-400")}>
        Optional — leave blank for wider results.
      </p>
      {loading ? <p className={cn("text-[11px]", isDark ? "text-stone-500" : "text-stone-400")}>Looking up nearby stores…</p> : null}
      {error ? <p className={cn("text-[11px]", isDark ? "text-amber-400" : "text-amber-700")}>{error}</p> : null}
    </div>
  );
}
