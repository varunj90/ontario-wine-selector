import { useCallback } from "react";

import { trackEvent } from "../analytics";
import { useLocalStorage } from "./useLocalStorage";

export function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useLocalStorage<string[]>("wine-selector-favorites", []);

  const toggleFavorite = useCallback(
    (wineId: string) => {
      setFavoriteIds((prev) => {
        const next = prev.includes(wineId) ? prev.filter((id) => id !== wineId) : [...prev, wineId];
        trackEvent("recommendation_favorited", { wineId, active: next.includes(wineId) ? 1 : 0 });
        return next;
      });
    },
    [setFavoriteIds],
  );

  const isFavorited = useCallback((wineId: string) => favoriteIds.includes(wineId), [favoriteIds]);

  return { favoriteIds, toggleFavorite, isFavorited } as const;
}
