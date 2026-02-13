/**
 * Extracts a producer/brand name from a wine's product name.
 *
 * Because the LCBO GraphQL API returns `producerName: null` for virtually
 * every product, we infer the producer by locating the grape varietal within
 * the name and treating everything *before* it as the producer.
 *
 * Examples:
 *   "Alamos Chardonnay"                        → "Alamos"
 *   "Pierre Sparr Gewurztraminer"               → "Pierre Sparr"
 *   "Cloudy Bay Sauvignon Blanc"                → "Cloudy Bay"
 *   "Galil Mountain Syrah KP"                   → "Galil Mountain"
 *   "13th Street Gamay"                         → "13th Street"
 *   "Nozzole Riserva Chianti Classico 2021"     → "Nozzole" (varietal not in name → fallback)
 */

import { RAW_VARIETALS, CANONICAL_MAP } from "@/lib/domain/varietals";

/**
 * Common wine label terms that can appear between the producer name and the
 * varietal.  These should be stripped when they trail the producer portion.
 */
const TRAILING_WINE_TERMS =
  /\b(Riserva|Reserva|Reserve|Gran Reserva|Grand Cru|Premier Cru|Crianza|Roble|Superiore|Classico|Estate|Winery|Vineyards?|Cellars?|Wines?)\s*$/i;

/** Vintage year pattern */
const VINTAGE_RE = /\b(19|20)\d{2}\b/g;

/** LCBO product suffixes (KP = Kosher Passover, KPM = Kosher, etc.) */
const LCBO_SUFFIXES_RE = /\s+\b(KP|KPM|VQA|DOC|DOCG|IGT|IGP|AOC|AOP|DO|DOC)\b\s*/gi;

/**
 * Build a sorted list of varietal patterns (longest-first) for producer extraction.
 * We include both canonical forms and raw entries to maximise hit rate.
 */
const VARIETAL_LOWER_SORTED = Array.from(
  new Set([
    ...RAW_VARIETALS.map((v) => v.toLowerCase()),
    ...Object.values(CANONICAL_MAP).map((v) => v.toLowerCase()),
  ]),
).sort((a, b) => b.length - a.length);

/**
 * Attempts to extract the producer / brand from a wine product name.
 *
 * @param name     Full product name as returned by the LCBO API.
 * @param varietal The already-extracted canonical varietal for this wine (optional).
 *                 When provided, it's checked first for a faster path.
 * @returns The inferred producer, or `"Unknown Producer"` when extraction fails.
 */
export function extractProducer(name: string, varietal?: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "Unknown Producer";

  // Fast path: if we know the varietal, check if it appears in the name.
  if (varietal && varietal !== "Blend") {
    const result = extractBeforeVarietal(trimmed, varietal.toLowerCase());
    if (result) return result;
  }

  // Slow path: try every known varietal pattern.
  for (const v of VARIETAL_LOWER_SORTED) {
    const result = extractBeforeVarietal(trimmed, v);
    if (result) return result;
  }

  // Last resort: when varietal is known and not "Blend", take the first word(s)
  // as a heuristic. When varietal is "Blend" or absent, we have no reliable
  // signal to split the name, so give up rather than guessing wrong.
  if (varietal && varietal !== "Blend") {
    return fallbackFirstWords(trimmed);
  }

  return "Unknown Producer";
}

/**
 * Given a wine name and a lowercase varietal string, finds the varietal in the
 * name and returns the cleaned portion before it as the producer.
 */
function extractBeforeVarietal(name: string, varietalLower: string): string | null {
  const idx = name.toLowerCase().indexOf(varietalLower);
  if (idx <= 0) return null;

  let before = name.substring(0, idx).trim();

  // Strip vintage years
  before = before.replace(VINTAGE_RE, " ").trim();

  // Strip trailing wine label terms
  before = before.replace(TRAILING_WINE_TERMS, "").trim();

  // Strip LCBO suffixes
  before = before.replace(LCBO_SUFFIXES_RE, " ").trim();

  // Strip trailing hyphens, commas, apostrophes that become dangling
  before = before.replace(/[-,]+$/, "").trim();

  // Must be at least 2 characters to be a plausible producer
  if (before.length < 2) return null;

  return before;
}

/**
 * Fallback: take the first 1-3 words as a rough producer guess.
 * Only used when no varietal is found in the name at all.
 */
function fallbackFirstWords(name: string): string {
  // Remove vintage, suffixes, and common wine terms
  const cleaned = name
    .replace(VINTAGE_RE, " ")
    .replace(LCBO_SUFFIXES_RE, " ")
    .replace(TRAILING_WINE_TERMS, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = cleaned.split(" ");

  // If the name is very short (1-2 words), it's probably just the wine name
  if (words.length <= 2) return "Unknown Producer";

  // Take the first 2 words as a rough guess (covers "Cloudy Bay", "13th Street")
  // but cap at first word if it's very long (likely a single-word brand)
  const candidate = words.length >= 4 ? words.slice(0, 2).join(" ") : words[0];

  if (candidate.length < 2) return "Unknown Producer";
  return candidate;
}
