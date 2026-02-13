import type { ShellTheme } from "./types";

export const darkTheme: ShellTheme = {
  page: "bg-[radial-gradient(circle_at_18%_0%,#45316a_0%,#12131b_36%,#08090d_70%)] text-zinc-100",
  card: "border-zinc-700/80 bg-zinc-900/70",
  cardSoft: "border-zinc-700/70 bg-zinc-900/55",
  textMuted: "text-zinc-300",
  input: "border-zinc-700 bg-zinc-800/70 text-zinc-100 placeholder:text-zinc-500",
  chipIdle: "border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500",
  chipActive: "border-zinc-200 bg-zinc-100 text-zinc-900",
  badge: "border-zinc-700 bg-zinc-800 text-zinc-200",
  sliderWrap: "border-zinc-700 bg-zinc-800/60",
  secondaryText: "text-zinc-400",
};

export const lightTheme: ShellTheme = {
  page: "bg-zinc-50 text-zinc-900",
  card: "border-zinc-200 bg-white",
  cardSoft: "border-zinc-200 bg-white",
  textMuted: "text-zinc-600",
  input: "border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400",
  chipIdle: "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500",
  chipActive: "border-zinc-900 bg-zinc-900 text-white",
  badge: "border-zinc-300 bg-zinc-100 text-zinc-700",
  sliderWrap: "border-zinc-300 bg-zinc-100",
  secondaryText: "text-zinc-500",
};
