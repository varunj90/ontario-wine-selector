"use client";

import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

import type { ShellTheme } from "./types";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  shell: ShellTheme;
  isDark?: boolean;
};

export function SearchInput({ value, onChange, isDark }: SearchInputProps) {
  return (
    <label
      className={cn(
        "flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all duration-200",
        "focus-within:ring-2",
        isDark
          ? "border-stone-600/50 bg-stone-800/50 focus-within:border-stone-500 focus-within:ring-stone-500/10"
          : "border-stone-300 bg-white focus-within:border-stone-400 focus-within:ring-stone-400/10",
      )}
    >
      <Search className={cn("h-[18px] w-[18px] shrink-0", isDark ? "text-stone-500" : "text-stone-400")} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search wine, producer, grape…"
        className={cn(
          "w-full bg-transparent text-[14px] outline-none",
          isDark ? "text-stone-100 placeholder:text-stone-500" : "text-stone-900 placeholder:text-stone-400",
        )}
      />
    </label>
  );
}
