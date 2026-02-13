import type { WineType } from "./types";

// Varietal chip labels and region mappings are defined in the shared domain
// module so that the UI, extraction engine, and DB queries all agree on the
// same canonical grape names.  Re-exported here for component convenience.
export { VARIETAL_BY_TYPE, REGIONS_BY_VARIETAL } from "@/lib/domain/varietals";

export const PRICE_MIN = 10;
export const PRICE_MAX = 500;

export const WINE_TYPE_OPTIONS: WineType[] = ["Red", "White", "Rose", "Bubbly", "Other"];

export const MIN_RATING_OPTIONS = [
  { value: 3.5, label: "3.5+" },
  { value: 3.8, label: "3.8+" },
  { value: 4.0, label: "4.0+" },
  { value: 4.2, label: "4.2+" },
  { value: 4.5, label: "4.5+" },
];

export const DEFAULT_COUNTRY_OPTIONS = ["Italy", "Argentina", "France", "USA", "Canada", "New Zealand", "Germany"];
export const DEFAULT_SUBREGION_OPTIONS = ["Tuscany", "Mendoza", "Napa Valley", "Niagara"];
