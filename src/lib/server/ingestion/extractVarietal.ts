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
 */

// ── canonical grape list (multi-word entries first within each group) ────────
const RAW_VARIETALS: readonly string[] = [
  // — Red (multi-word first) —
  "Cabernet Sauvignon",
  "Pinot Noir",
  "Cabernet Franc",
  "Petit Verdot",
  "Petite Sirah",
  "Pinot Meunier",
  "Touriga Nacional",
  "Nero d'Avola",

  // — Red (single-word) —
  "Merlot",
  "Syrah",
  "Shiraz",
  "Sangiovese",
  "Tempranillo",
  "Grenache",
  "Garnacha",
  "Malbec",
  "Zinfandel",
  "Nebbiolo",
  "Barbera",
  "Mourvèdre",
  "Monastrell",
  "Carménère",
  "Pinotage",
  "Gamay",
  "Primitivo",
  "Dolcetto",
  "Montepulciano",
  "Aglianico",
  "Corvina",
  "Tannat",
  "Bonarda",
  "Zweigelt",
  "Blaufränkisch",
  "Mencía",

  // — White (multi-word first) —
  "Sauvignon Blanc",
  "Pinot Grigio",
  "Pinot Gris",
  "Pinot Blanc",
  "Chenin Blanc",
  "Grüner Veltliner",
  "Gruner Veltliner",

  // — White (single-word) —
  "Chardonnay",
  "Riesling",
  "Viognier",
  "Gewürztraminer",
  "Gewurztraminer",
  "Albariño",
  "Albarino",
  "Torrontés",
  "Torrontes",
  "Muscat",
  "Moscato",
  "Moscatel",
  "Sémillon",
  "Semillon",
  "Marsanne",
  "Roussanne",
  "Verdejo",
  "Vermentino",
  "Trebbiano",
  "Garganega",
  "Fiano",
  "Falanghina",
  "Cortese",
  "Pecorino",
  "Soave",

  // — Sparkling designations —
  "Prosecco",
  "Champagne",
  "Cava",
  "Crémant",
  "Cremant",

  // — Other designations —
  "Meritage",
  "Vidal",
  "Baco Noir",
] as const;

// Canonical-name map: maps each lowercase variant to its preferred label.
// "pinot gris" → "Pinot Grigio", "garnacha" → "Grenache", etc.
const CANONICAL_MAP: Record<string, string> = {
  "pinot gris": "Pinot Grigio",
  garnacha: "Grenache",
  monastrell: "Mourvèdre",
  "gruner veltliner": "Grüner Veltliner",
  gewurztraminer: "Gewürztraminer",
  albarino: "Albariño",
  torrontes: "Torrontés",
  semillon: "Sémillon",
  cremant: "Crémant",
};

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
