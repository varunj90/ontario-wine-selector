/**
 * Extracts a canonical grape-variety name from a wine's name and description.
 *
 * The LCBO GraphQL API does not provide a structured varietal field, so we
 * pattern-match against a curated list of ~80 grape varieties sorted from
 * longest to shortest so multi-word names ("Cabernet Sauvignon") are matched
 * before substrings ("Sauvignon").
 *
 * The function intentionally checks the **name first** (most reliable), then
 * the description, and returns "Blend" as a fallback.
 *
 * Grape list and canonical aliases are defined in the shared domain module
 * `src/lib/domain/varietals.ts` — consumed by both this extraction engine
 * and the UI chip labels so that the two never drift.
 */

import { CANONICAL_MAP, RAW_VARIETALS } from "@/lib/domain/varietals";

type VarietalPattern = { canonical: string; lower: string; re: RegExp };

/** Sorted longest-first so multi-word patterns match before substrings. */
const VARIETAL_PATTERNS: VarietalPattern[] = RAW_VARIETALS.map((raw) => {
  const lower = raw.toLowerCase();
  const canonical = CANONICAL_MAP[lower] ?? raw;
  // Word-boundary match so "Montepulciano" doesn't match inside a region name
  // like "Vino Nobile di Montepulciano" incorrectly when it's the grape.
  // We use a liberal boundary (\b) since wine names are typically space-separated.
  const re = new RegExp(`\\b${escapeRegex(lower)}\\b`, "i");
  return { canonical, lower, re };
}).sort((a, b) => b.lower.length - a.lower.length);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Returns a canonical grape-variety name extracted from the wine's name and
 * description. Falls back to `"Blend"` when no known variety is detected.
 */
export function extractVarietal(name: string, shortDescription?: string | null): string {
  // Check name first — most reliable signal because producers almost always
  // include the grape in the product name.
  for (const { canonical, re } of VARIETAL_PATTERNS) {
    if (re.test(name)) return canonical;
  }

  // Fall back to short description (marketing text that often mentions grape).
  if (shortDescription) {
    for (const { canonical, re } of VARIETAL_PATTERNS) {
      if (re.test(shortDescription)) return canonical;
    }
  }

  return "Blend";
}

/** Exposed for testing only. */
export const _VARIETAL_PATTERNS = VARIETAL_PATTERNS;
