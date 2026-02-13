import { fetchJsonWithRetry } from "@/lib/server/ingestion/httpClient";

type StoreInventoryResponse = {
  data?: {
    store?: {
      externalId?: string;
      name?: string;
      city?: string | null;
      inventories?: {
        edges?: Array<{
          node?: {
            quantity?: number | null;
            product?: {
              sku?: string;
              primaryCategory?: string | null;
              priceInCents?: number | null;
            } | null;
          } | null;
        }> | null;
        pageInfo?: {
          hasNextPage?: boolean;
          endCursor?: string | null;
        } | null;
      } | null;
    } | null;
  };
};

type StoreInventorySnapshot = {
  storeCode: string;
  storeLabel: string;
  fetchedAtMs: number;
  inStockWineSkus: Set<string>;
  priceBySku: Map<string, number>;
};

const LCBO_GRAPHQL_ENDPOINT = "https://api.lcbo.dev/graphql";
const CACHE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MAX_PAGES = 25;
const DEFAULT_PAGE_SIZE = 150;
const cache = new Map<string, StoreInventorySnapshot>();

function isWineCategory(primaryCategory?: string | null) {
  return (primaryCategory ?? "").toLowerCase().includes("wine");
}

function toStoreLabel(name?: string, city?: string | null) {
  return [name, city].filter(Boolean).join(" - ");
}

export async function getLiveStoreInventory(storeCode: string): Promise<StoreInventorySnapshot | null> {
  const normalizedStoreCode = storeCode.trim();
  if (!/^\d+$/.test(normalizedStoreCode)) return null;

  const cached = cache.get(normalizedStoreCode);
  if (cached && Date.now() - cached.fetchedAtMs < CACHE_TTL_MS) {
    return cached;
  }

  const maxPages = Math.max(1, Number(process.env.LCBO_STORE_INVENTORY_MAX_PAGES ?? String(DEFAULT_MAX_PAGES)));
  const pageSize = Math.max(50, Math.min(250, Number(process.env.LCBO_STORE_INVENTORY_PAGE_SIZE ?? String(DEFAULT_PAGE_SIZE))));
  const inStockWineSkus = new Set<string>();
  const priceBySku = new Map<string, number>();

  let cursor: string | null = null;
  let pageCount = 0;
  let storeLabel = `LCBO Store ${normalizedStoreCode}`;

  while (pageCount < maxPages) {
    const query = `
      query StoreInventories($storeId: String!, $after: String, $first: Int!) {
        store(id: $storeId) {
          externalId
          name
          city
          inventories(
            filters: { minQuantity: 1 }
            pagination: { first: $first, after: $after }
          ) {
            edges {
              node {
                quantity
                product {
                  sku
                  primaryCategory
                  priceInCents
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `;

    const payload: StoreInventoryResponse = await fetchJsonWithRetry(LCBO_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query,
        variables: {
          storeId: normalizedStoreCode,
          after: cursor,
          first: pageSize,
        },
      }),
      retries: 1,
      retryBackoffMs: 500,
      rateLimitMs: 200,
      requestTimeoutMs: 20000,
    });

    const store = payload.data?.store;
    if (!store?.inventories?.edges) break;
    storeLabel = toStoreLabel(store.name, store.city) || storeLabel;

    for (const edge of store.inventories.edges) {
      const node = edge?.node;
      const sku = node?.product?.sku?.trim();
      if (!sku) continue;
      if (!isWineCategory(node?.product?.primaryCategory)) continue;

      inStockWineSkus.add(sku);
      if (typeof node?.product?.priceInCents === "number") {
        priceBySku.set(sku, Math.round(node.product.priceInCents));
      }
    }

    const hasNext = Boolean(store.inventories.pageInfo?.hasNextPage);
    cursor = store.inventories.pageInfo?.endCursor ?? null;
    pageCount += 1;
    if (!hasNext) break;
  }

  const snapshot: StoreInventorySnapshot = {
    storeCode: normalizedStoreCode,
    storeLabel,
    fetchedAtMs: Date.now(),
    inStockWineSkus,
    priceBySku,
  };
  cache.set(normalizedStoreCode, snapshot);
  return snapshot;
}

