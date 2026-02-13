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
  shell,
  isDark,
}: StoreSelectorProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          value={postalCode}
          onChange={(e) => onPostalCodeChange(e.target.value.toUpperCase())}
          maxLength={3}
          placeholder="Area code (e.g., M5V)"
          className={cn("rounded-xl border px-3 py-2.5 text-sm outline-none transition-all", shell.input)}
        />
        <select
          value={selectedStoreId}
          onChange={(e) => onStoreChange(e.target.value)}
          className={cn("w-full min-w-0 rounded-xl border px-3 py-2.5 text-sm outline-none transition-all", shell.input)}
        >
          <option value="">Any LCBO</option>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.label.split(" - ")[0]} ({store.distanceKm.toFixed(1)} km)
            </option>
          ))}
        </select>
      </div>
      <p className={cn("text-xs", shell.secondaryText)}>Store filter is optional. Leave as &quot;Any LCBO&quot; for wider results.</p>
      {loading ? <p className={cn("text-xs", shell.secondaryText)}>Looking up nearby LCBO stores...</p> : null}
      {error ? <p className={cn("text-xs", isDark ? "text-amber-300" : "text-amber-700")}>{error}</p> : null}
    </div>
  );
}
