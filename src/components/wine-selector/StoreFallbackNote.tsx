"use client";

import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type StoreFallbackNoteProps = {
  note: string;
  isDark: boolean;
};

export function StoreFallbackNote({ note, isDark }: StoreFallbackNoteProps) {
  return (
    <div
      className={cn(
        "animate-fade-up flex items-start gap-3 rounded-2xl border px-5 py-4 text-[13px]",
        isDark
          ? "border-amber-500/15 bg-amber-500/5 text-amber-200/80"
          : "border-amber-200 bg-amber-50 text-amber-700",
      )}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="leading-relaxed">{note}</span>
    </div>
  );
}
