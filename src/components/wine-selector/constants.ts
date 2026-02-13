import type { WineType } from "./types";

export const PRICE_MIN = 10;
export const PRICE_MAX = 500;

export const WINE_TYPE_OPTIONS: WineType[] = ["Red", "White", "Rose", "Bubbly", "Other"];

export const VARIETAL_BY_TYPE: Record<WineType, string[]> = {
  Red: ["Cabernet Sauvignon", "Pinot Noir", "Sangiovese", "Merlot", "Syrah"],
  White: ["Chardonnay", "Sauvignon Blanc", "Riesling", "Pinot Grigio", "Chenin Blanc"],
  Rose: ["Provence Rose", "Grenache Rose", "Sangiovese Rose"],
  Bubbly: ["Champagne", "Prosecco", "Cava", "Cremant"],
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

export const MIN_RATING_OPTIONS = [
  { value: 3.5, label: "3.5+" },
  { value: 3.8, label: "3.8+" },
  { value: 4.0, label: "4.0+" },
  { value: 4.2, label: "4.2+" },
  { value: 4.5, label: "4.5+" },
];

export const DEFAULT_COUNTRY_OPTIONS = ["Italy", "Argentina", "France", "USA", "Canada", "New Zealand", "Germany"];
export const DEFAULT_SUBREGION_OPTIONS = ["Tuscany", "Mendoza", "Napa Valley", "Niagara"];
