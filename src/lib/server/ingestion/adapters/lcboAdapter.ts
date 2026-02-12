import { fetchJsonWithRetry } from "../httpClient";
import type { DeadLetterRecord } from "../validation";

type LcboGraphQLResponse = {
  data?: {
    products?: {
      pageInfo?: {
        hasNextPage: boolean;
        endCursor?: string | null;
      };
      edges?: Array<{
        node?: {
          sku?: string;
          name?: string;
          producerName?: string | null;
          primaryCategory?: string | null;
          shortDescription?: string | null;
          countryOfManufacture?: string | null;
          regionName?: string | null;
          updatedAt?: string;
          inventories?: {
            edges?: Array<{
              node?: {
                quantity?: number | null;
                store?: {
                  externalId?: string;
                  name?: string;
                  city?: string | null;
                  latitude?: number | null;
                  longitude?: number | null;
                } | null;
              } | null;
            }> | null;
          } | null;
          priceInCents?: number;
        } | null;
      }> | null;
    };
  };
};

type CatalogItem = {
  externalId: string;
  name: string;
  producer: string;
  type: "Red" | "White" | "Rose" | "Bubbly" | "Other";
  varietal: string;
  country: string;
  subRegion: string;
  regionLabel: string;
  lcboUrl?: string;
  vivinoUrl?: string;
  storeCode: string;
  storeLabel: string;
  storeCity?: string;
  storeLatitude?: number;
  storeLongitude?: number;
  listedPriceCents: number;
  inventoryQuantity: number;
  inStock: boolean;
  sourceUpdatedAt: Date;
};

const DEFAULT_ENDPOINT = "https://api.lcbo.dev/graphql";

function inferWineType(primaryCategory?: string | null): CatalogItem["type"] {
  const value = (primaryCategory ?? "").toLowerCase();
  if (value.includes("red")) return "Red";
  if (value.includes("white")) return "White";
  if (value.includes("ros")) return "Rose";
  if (value.includes("sparkling")) return "Bubbly";
  return "Other";
}

function inferVarietal(shortDescription?: string | null): string {
  if (!shortDescription) return "Blend";
  const sentence = shortDescription.split(".")[0]?.trim();
  return sentence && sentence.length > 2 ? sentence.slice(0, 64) : "Blend";
}

function toLcboUrl(name: string, sku: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `https://www.lcbo.com/en/${slug}-${sku}`;
}

async function fetchProductsPage(
  endpoint: string,
  afterCursor: string | null | undefined,
  inventoryPerProduct: number,
  focusLatitude: number,
  focusLongitude: number,
  focusRadiusKm: number,
  useTorontoFocus: boolean,
) {
  const queryWithTorontoFocus = `
    query ProductsPage($after: String, $inventoryPerProduct: Int!, $focusLatitude: Float!, $focusLongitude: Float!, $focusRadiusKm: Float!) {
      products(
        filters: { categorySlug: "wine", isBuyable: true }
        pagination: { first: 20, after: $after }
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            sku
            name
            producerName
            primaryCategory
            shortDescription
            countryOfManufacture
            regionName
            priceInCents
            updatedAt
            inventories(
              filters: { latitude: $focusLatitude, longitude: $focusLongitude, radiusKm: $focusRadiusKm }
              pagination: { first: $inventoryPerProduct }
            ) {
              edges {
                node {
                  quantity
                  store {
                    externalId
                    name
                    city
                    latitude
                    longitude
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const queryWithoutFocus = `
    query ProductsPage($after: String, $inventoryPerProduct: Int!) {
      products(
        filters: { categorySlug: "wine", isBuyable: true }
        pagination: { first: 20, after: $after }
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            sku
            name
            producerName
            primaryCategory
            shortDescription
            countryOfManufacture
            regionName
            priceInCents
            updatedAt
            inventories(pagination: { first: $inventoryPerProduct }) {
              edges {
                node {
                  quantity
                  store {
                    externalId
                    name
                    city
                    latitude
                    longitude
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
  return fetchJsonWithRetry<LcboGraphQLResponse>(endpoint, {
    headers: { "content-type": "application/json" },
    retries: 2,
    retryBackoffMs: 700,
    rateLimitMs: 350,
    method: "POST",
    body: JSON.stringify({
      query: useTorontoFocus ? queryWithTorontoFocus : queryWithoutFocus,
      variables: {
        after: afterCursor ?? null,
        inventoryPerProduct,
        ...(useTorontoFocus
          ? {
              focusLatitude,
              focusLongitude,
              focusRadiusKm,
            }
          : {}),
      },
    }),
  });
}

export async function fetchLcboFeedFromSource(): Promise<{ items: unknown[]; deadLetters: DeadLetterRecord[] } | null> {
  const endpoint = process.env.LCBO_API_BASE_URL?.trim() || DEFAULT_ENDPOINT;
  const configuredMaxProducts = Number(process.env.LCBO_SYNC_MAX_PRODUCTS ?? "0");
  const maxProducts = Number.isFinite(configuredMaxProducts) && configuredMaxProducts > 0 ? configuredMaxProducts : Number.POSITIVE_INFINITY;
  const inventoryPerProduct = Math.max(1, Number(process.env.LCBO_INVENTORY_PER_PRODUCT ?? "1"));
  const focusLatitude = Number(process.env.LCBO_INVENTORY_FOCUS_LAT ?? "43.6532");
  const focusLongitude = Number(process.env.LCBO_INVENTORY_FOCUS_LNG ?? "-79.3832");
  const focusRadiusKm = Math.max(1, Number(process.env.LCBO_INVENTORY_RADIUS_KM ?? "35"));
  const deadLetters: DeadLetterRecord[] = [];
  const items: CatalogItem[] = [];
  let hasNextPage = true;
  let cursor: string | null | undefined = null;

  while (hasNextPage && items.length < maxProducts) {
    let payload = await fetchProductsPage(endpoint, cursor, inventoryPerProduct, focusLatitude, focusLongitude, focusRadiusKm, true);
    let products = payload.data?.products;
    if (!products?.edges) {
      payload = await fetchProductsPage(endpoint, cursor, inventoryPerProduct, focusLatitude, focusLongitude, focusRadiusKm, false);
      products = payload.data?.products;
    }
    if (!products?.edges) {
      deadLetters.push({
        source: "lcbo_catalog",
        stage: "adapter",
        reason: "Expected data.products.edges to exist in LCBO response",
        payload,
      });
      break;
    }

    for (const edge of products.edges) {
      if (items.length >= maxProducts) break;
      const node = edge?.node;
      if (!node?.sku || !node.name || typeof node.priceInCents !== "number") {
        deadLetters.push({
          source: "lcbo_catalog",
          stage: "adapter",
          reason: "Missing required fields (sku/name/priceInCents) on LCBO product node",
          payload: node,
        });
        continue;
      }

      const inventories = node.inventories?.edges?.map((entry) => entry?.node).filter(Boolean) ?? [];
      if (inventories.length === 0) {
        deadLetters.push({
          source: "lcbo_catalog",
          stage: "adapter",
          reason: "No inventory records returned for product",
          externalId: node.sku,
          payload: node,
        });
        continue;
      }

      for (const inv of inventories) {
        const store = inv?.store;
        if (!store?.externalId || !store.name) {
          deadLetters.push({
            source: "lcbo_catalog",
            stage: "adapter",
            reason: "Inventory entry missing store metadata",
            externalId: node.sku,
            payload: inv,
          });
          continue;
        }

        const quantity = Math.max(0, Number(inv.quantity ?? 0));
        const subRegion = node.regionName?.trim() || "Unspecified";
        const country = node.countryOfManufacture?.trim() || "Unknown";
        const type = inferWineType(node.primaryCategory);
        items.push({
          externalId: node.sku,
          name: node.name.trim(),
          producer: node.producerName?.trim() || "Unknown Producer",
          type,
          varietal: inferVarietal(node.shortDescription),
          country,
          subRegion,
          regionLabel: `${country} - ${subRegion}`,
          lcboUrl: toLcboUrl(node.name, node.sku),
          vivinoUrl: `https://www.vivino.com/search/wines?q=${encodeURIComponent(node.name)}`,
          storeCode: store.externalId,
          storeLabel: [store.name, store.city].filter(Boolean).join(" - "),
          storeCity: store.city ?? undefined,
          storeLatitude: typeof store.latitude === "number" ? store.latitude : undefined,
          storeLongitude: typeof store.longitude === "number" ? store.longitude : undefined,
          listedPriceCents: Math.round(node.priceInCents),
          inventoryQuantity: quantity,
          inStock: quantity > 0,
          sourceUpdatedAt: node.updatedAt ? new Date(node.updatedAt) : new Date(),
        });
      }
    }

    hasNextPage = Boolean(products.pageInfo?.hasNextPage);
    cursor = products.pageInfo?.endCursor ?? null;
  }

  return { items, deadLetters };
}
