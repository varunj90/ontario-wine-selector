"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StoreFallbackNoteProps = {
  note: string;
  isDark: boolean;
};

export function StoreFallbackNote({ note, isDark }: StoreFallbackNoteProps) {
  return (
    <Card className={cn("border-amber-300 bg-amber-50", isDark && "border-amber-500/40 bg-amber-500/10")}>
      <CardContent className={cn("pt-4 text-sm", isDark ? "text-amber-200" : "text-amber-700")}>{note}</CardContent>
    </Card>
  );
}
