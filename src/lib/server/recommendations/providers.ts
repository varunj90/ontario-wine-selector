import type { RecommendationFilterInput, RecommendationWine } from "./types";

export interface WineCatalogProvider {
  listCandidates(filters: RecommendationFilterInput): Promise<RecommendationWine[]>;
}

export interface WineSignalProvider {
  // Future: hydrate with live Vivino or internal quality signals.
  hydrateSignals(candidates: RecommendationWine[]): Promise<RecommendationWine[]>;
}
