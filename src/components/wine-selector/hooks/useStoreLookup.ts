import { useEffect, useState } from "react";

import type { StoreOption } from "../types";

export function useStoreLookup(postalCode: string) {
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const normalized = postalCode.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
    if (normalized.length < 3) {
      setStores([]);
      setError(null);
      return;
    }

    const timeout = setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError(null);
        try {
          const response = await fetch(`/api/stores?postalCode=${encodeURIComponent(normalized)}`);
          if (!response.ok) throw new Error("Store lookup failed");
          const data = (await response.json()) as { stores?: StoreOption[] };
          setStores(data.stores ?? []);
        } catch {
          setStores([]);
          setError("Could not load nearby LCBO stores right now.");
        } finally {
          setLoading(false);
        }
      })();
    }, 250);

    return () => clearTimeout(timeout);
  }, [postalCode]);

  return { stores, loading, error } as const;
}
