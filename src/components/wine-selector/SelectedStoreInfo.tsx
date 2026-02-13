"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { ShellTheme, StoreOption } from "./types";

type SelectedStoreInfoProps = {
  store: StoreOption;
  shell: ShellTheme;
  isDark: boolean;
};

export function SelectedStoreInfo({ store, shell, isDark }: SelectedStoreInfoProps) {
  return (
    <Card className={cn("animate-fade-up shadow-sm transition-all duration-300", shell.cardSoft)}>
      <CardContent className="flex items-center justify-between gap-3 pt-4">
        <div className="text-sm">
          <p className={shell.secondaryText}>Selected LCBO</p>
          <p className={cn("max-w-[220px] truncate font-semibold", isDark ? "text-zinc-100" : "text-zinc-900")} title={store.label}>
            {store.label}
          </p>
        </div>
        <Badge className={shell.badge}>{store.distanceKm.toFixed(1)} km</Badge>
      </CardContent>
    </Card>
  );
}
