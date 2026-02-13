"use client";

import { ChevronRight, Wine } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="fixed bottom-4 left-1/2 z-20 w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
      <Card className={cn("border shadow-lg backdrop-blur-xl transition-all duration-300", shell.card)}>
        <CardContent className="flex items-center justify-between gap-3 pt-4">
          {selectedWine ? (
            <>
              <div>
                <p className={cn("text-xs uppercase tracking-[0.18em]", shell.secondaryText)}>Ready to buy</p>
                <p className={cn("mt-0.5 line-clamp-1 text-sm font-medium", isDark ? "text-zinc-100" : "text-zinc-900")}>{selectedWine.name}</p>
              </div>
              <a
                href={selectedWine.lcboUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium",
                  isDark ? "border-zinc-200 bg-zinc-100 text-zinc-900 hover:bg-white" : "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800",
                )}
              >
                Open LCBO
                <ChevronRight className="h-3.5 w-3.5" />
              </a>
            </>
          ) : (
            <>
              <div className={cn("flex items-center gap-2", shell.textMuted)}>
                <Wine className={cn("h-4 w-4", isDark ? "text-zinc-100" : "text-zinc-700")} />
                <p className="text-sm">Pick a bottle to continue</p>
              </div>
              <Badge className={shell.badge}>{recommendationCount} shown</Badge>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
