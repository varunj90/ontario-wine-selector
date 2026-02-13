/**
 * Single source of truth for grape-variety names, aliases, and UI labels.
 *
 * Consumed by:
 *   - `extractVarietal.ts`  (ingestion: name → canonical grape)
 *   - `constants.ts`        (UI: chip labels by wine type)
 *   - `scrapeLcboVarietal`  (future: validate scraped values)
 *
 * Add new grapes here and both extraction + UI stay in sync.
 */

import type { WineType } from "@/components/wine-selector/types";

// ── Raw grape list ─────────────────────────────────────────────────────────
// Multi-word entries are listed first within each group so that the extraction
// regex sorts longest-first and matches "Cabernet Sauvignon" before "Sauvignon".

export const RAW_VARIETALS: readonly string[] = [
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

// ── Canonical alias map ────────────────────────────────────────────────────
// Maps each lowercase variant to its preferred display label so that both the
// extraction engine and the UI chips always use the same canonical name.
export const CANONICAL_MAP: Record<string, string> = {
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

// ── UI chip labels by wine type ────────────────────────────────────────────
// These are the varietal options shown in the filter panel.  Every label here
// MUST be a canonical name (i.e. what `extractVarietal` produces) so that
// chip selection → API filter → DB query all agree on the same string.
export const VARIETAL_BY_TYPE: Record<WineType, string[]> = {
  Red: ["Cabernet Sauvignon", "Pinot Noir", "Sangiovese", "Merlot", "Syrah"],
  White: ["Chardonnay", "Sauvignon Blanc", "Riesling", "Pinot Grigio", "Chenin Blanc"],
  Rose: ["Provence Rose", "Grenache Rose", "Sangiovese Rose"],
  Bubbly: ["Champagne", "Prosecco", "Cava", "Crémant"],
  Other: ["Orange Wine", "Fortified", "Natural"],
};

export const REGIONS_BY_VARIETAL: Record<string, string[]> = {
  Chardonnay: ["Burgundy", "Napa Valley", "Sonoma", "Niagara", "Yarra Valley"],
  "Sauvignon Blanc": ["Marlborough", "Loire Valley", "Napa Valley", "Niagara"],
  "Cabernet Sauvignon": ["Napa Valley", "Bordeaux", "Coonawarra", "Maipo Valley"],
  "Pinot Noir": ["Burgundy", "Willamette Valley", "Sonoma Coast", "Central Otago"],
  Sangiovese: ["Tuscany", "Montalcino", "Chianti Classico", "Montepulciano"],
  Riesling: ["Mosel", "Clare Valley", "Alsace", "Finger Lakes"],
  Prosecco: ["Veneto", "Conegliano Valdobbiadene"],
};
