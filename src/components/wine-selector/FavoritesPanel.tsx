"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { ShellTheme, WinePick } from "./types";

type FavoritesPanelProps = {
  wines: WinePick[];
  onSelectWine: (id: string) => void;
  shell: ShellTheme;
  isDark: boolean;
};

export function FavoritesPanel({ wines, onSelectWine, shell, isDark }: FavoritesPanelProps) {
  if (wines.length === 0) return null;

  return (
    <Card className={cn("animate-fade-up border shadow-sm", shell.cardSoft)}>
      <CardContent className="pt-4">
        <div className="mb-2 flex items-center justify-between">
          <p className={cn("text-sm font-medium", isDark ? "text-zinc-100" : "text-zinc-900")}>Your favorites</p>
          <Badge className={shell.badge}>{wines.length}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {wines.map((wine) => (
            <div
              key={wine.id}
              className={cn(
                "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs",
                isDark ? "border-zinc-700 bg-zinc-800/50" : "border-zinc-200 bg-zinc-50",
              )}
            >
              <button type="button" onClick={() => onSelectWine(wine.id)} className="text-left">
                <p className={cn("font-medium", isDark ? "text-zinc-100" : "text-zinc-900")}>{wine.name}</p>
                <p className={shell.textMuted}>
                  {wine.hasVivinoMatch ? `Vivino ${wine.rating.toFixed(1)}` : "Vivino search"} - ${wine.price.toFixed(2)}
                </p>
              </button>
              <a
                href={wine.vivinoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("rounded-md border px-2 py-1", shell.chipIdle)}
              >
                Vivino
              </a>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
