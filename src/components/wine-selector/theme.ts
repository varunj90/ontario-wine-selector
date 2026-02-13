import type { AccentTheme, ShellTheme, WineType } from "./types";

/* ─── Shell themes (stone-based warm palette) ─── */

export const darkTheme: ShellTheme = {
  page: "bg-[radial-gradient(circle_at_18%_0%,var(--page-tint,#2a1f3d)_0%,#12100e_36%,#0c0a09_70%)] text-stone-100",
  card: "border-stone-700/40 bg-stone-900/70",
  cardSoft: "border-stone-700/30 bg-stone-900/55",
  textMuted: "text-stone-400",
  input: "border-stone-700/60 bg-stone-800/50 text-stone-100 placeholder:text-stone-500",
  chipIdle: "border-stone-700/50 bg-stone-800/40 text-stone-400 hover:border-stone-500",
  chipActive: "border-stone-200 bg-stone-100 text-stone-900",
  badge: "border-stone-700/50 bg-stone-800/60 text-stone-300",
  sliderWrap: "border-stone-700/50 bg-stone-800/40",
  secondaryText: "text-stone-500",
};

export const lightTheme: ShellTheme = {
  page: "bg-[#faf8f5] text-stone-900",
  card: "border-stone-200/80 bg-white/80",
  cardSoft: "border-stone-200/60 bg-white/60",
  textMuted: "text-stone-500",
  input: "border-stone-200 bg-white text-stone-900 placeholder:text-stone-400",
  chipIdle: "border-stone-200 bg-white text-stone-600 hover:border-stone-400",
  chipActive: "border-stone-900 bg-stone-900 text-white",
  badge: "border-stone-200 bg-stone-100 text-stone-600",
  sliderWrap: "border-stone-200 bg-stone-100",
  secondaryText: "text-stone-400",
};

/* ─── Adaptive accent themes by wine type ─── */

const redAccent: AccentTheme = {
  glow: "bg-red-950/30",
  glowBorder: "border-red-500/30",
  glowText: "text-red-300",
  starFill: "fill-red-400 text-red-400",
  chipActive: "border-red-500/40 bg-red-950/40 text-red-200",
  chipActiveLight: "border-red-800 bg-red-900 text-white",
  sliderTrack: "bg-gradient-to-r from-red-900 to-red-600",
  sliderTrackLight: "bg-gradient-to-r from-red-800 to-red-500",
  rankBg: "bg-red-800",
  pageGradientTint: "#2d1520",
};

const whiteAccent: AccentTheme = {
  glow: "bg-amber-500/10",
  glowBorder: "border-amber-500/25",
  glowText: "text-amber-300",
  starFill: "fill-amber-400 text-amber-400",
  chipActive: "border-amber-500/40 bg-amber-950/40 text-amber-200",
  chipActiveLight: "border-amber-700 bg-amber-700 text-white",
  sliderTrack: "bg-gradient-to-r from-amber-800 to-amber-500",
  sliderTrackLight: "bg-gradient-to-r from-amber-600 to-amber-400",
  rankBg: "bg-amber-700",
  pageGradientTint: "#1a1708",
};

const roseAccent: AccentTheme = {
  glow: "bg-pink-500/10",
  glowBorder: "border-pink-400/25",
  glowText: "text-pink-300",
  starFill: "fill-pink-400 text-pink-400",
  chipActive: "border-pink-400/40 bg-pink-950/40 text-pink-200",
  chipActiveLight: "border-pink-600 bg-pink-600 text-white",
  sliderTrack: "bg-gradient-to-r from-pink-800 to-pink-500",
  sliderTrackLight: "bg-gradient-to-r from-pink-600 to-pink-400",
  rankBg: "bg-pink-700",
  pageGradientTint: "#2d1525",
};

const bubblyAccent: AccentTheme = {
  glow: "bg-yellow-500/10",
  glowBorder: "border-yellow-400/20",
  glowText: "text-yellow-300",
  starFill: "fill-yellow-300 text-yellow-300",
  chipActive: "border-yellow-400/30 bg-yellow-950/30 text-yellow-200",
  chipActiveLight: "border-yellow-700 bg-yellow-700 text-white",
  sliderTrack: "bg-gradient-to-r from-yellow-800 to-yellow-500",
  sliderTrackLight: "bg-gradient-to-r from-yellow-600 to-yellow-400",
  rankBg: "bg-yellow-700",
  pageGradientTint: "#1a1808",
  hasBubbles: true,
};

const ACCENT_MAP: Record<WineType, AccentTheme> = {
  Red: redAccent,
  White: whiteAccent,
  Rose: roseAccent,
  Bubbly: bubblyAccent,
  Other: whiteAccent,
};

/** Default accent (amber/gold) used when no wine type or mixed types selected. */
export const defaultAccent: AccentTheme = whiteAccent;

/** Derive the active accent from the user's selected wine types. */
export function getAccentForTypes(types: WineType[]): AccentTheme {
  if (types.length === 1) return ACCENT_MAP[types[0]];
  return defaultAccent;
}
