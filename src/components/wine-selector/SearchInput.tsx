"use client";

import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

import type { ShellTheme } from "./types";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  shell: ShellTheme;
};

export function SearchInput({ value, onChange, shell }: SearchInputProps) {
  return (
    <label className={cn("flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-all duration-200 focus-within:ring-2", shell.input)}>
      <Search className={cn("h-4 w-4", shell.secondaryText)} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search wine, producer, grape..."
        className="w-full bg-transparent text-sm outline-none"
      />
    </label>
  );
}
