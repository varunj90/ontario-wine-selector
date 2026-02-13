import { fetchJsonWithRetry } from "../httpClient";
import { extractVarietal } from "../extractVarietal";
import { extractProducer } from "../extractProducer";
import type { DeadLetterRecord } from "../validation";
import { buildVivinoSearchUrl } from "@/lib/server/recommendations/vivinoTrust";

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
          externalId?: string | null;
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
const CATALOG_ONLY_STORE_CODE = "lcbo-catalog-only";
const CATALOG_ONLY_STORE_LABEL = "LCBO Catalog (inventory unavailable)";

function inferWineType(primaryCategory?: string | null): CatalogItem["type"] {
  const value = (primaryCategory ?? "").toLowerCase();
  if (value.includes("red")) return "Red";
  if (value.includes("white")) return "White";
  if (value.includes("ros")) return "Rose";
  if (value.includes("sparkling")) return "Bubbly";
  return "Other";
}


/**
 * Extracts the real LCBO product URL from the `externalId` field.
 *
 * The LCBO API `externalId` format is:
 *   `42.6601$https://www.lcbo.com/en/<real-slug>-<sku>`
 *
 * The slug in `externalId` is the Magento-managed URL key and often differs
 * from a naive slugification of the product name (~75% mismatch rate).
 * When `externalId` is not available, falls back to slug generation.
 */
function toLcboUrl(productExternalId: string | null | undefined, name: string, sku: string): string {
  if (productExternalId) {
    const match = productExternalId.match(/\$(https:\/\/www\.lcbo\.com\/[^\s]+)/);
    if (match) return match[1];
  }
  // Fallback: generate slug from name (unreliable ~25% accuracy)
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
            externalId
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
            externalId
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
        const subRegion = node.regionName?.trim() || "Unspecified";
        const country = node.countryOfManufacture?.trim() || "Unknown";
        const type = inferWineType(node.primaryCategory);
        const wineName = node.name.trim();
        const varietal = extractVarietal(wineName, node.shortDescription);
        const producer = node.producerName?.trim() || extractProducer(wineName, varietal);
        items.push({
          externalId: node.sku,
          name: wineName,
          producer,
          type,
          varietal,
          country,
          subRegion,
          regionLabel: `${country} - ${subRegion}`,
          lcboUrl: toLcboUrl(node.externalId, node.name, node.sku),
          vivinoUrl: buildVivinoSearchUrl(wineName, producer !== "Unknown Producer" ? producer : "", country),
          storeCode: CATALOG_ONLY_STORE_CODE,
          storeLabel: CATALOG_ONLY_STORE_LABEL,
          listedPriceCents: Math.round(node.priceInCents),
          inventoryQuantity: 0,
          inStock: false,
          sourceUpdatedAt: node.updatedAt ? new Date(node.updatedAt) : new Date(),
        });
        continue;
      }

      const subRegion = node.regionName?.trim() || "Unspecified";
      const country = node.countryOfManufacture?.trim() || "Unknown";
      const type = inferWineType(node.primaryCategory);
      const wineName = node.name.trim();
      const varietal = extractVarietal(wineName, node.shortDescription);
      const producer = node.producerName?.trim() || extractProducer(wineName, varietal);
      const lcboUrl = toLcboUrl(node.externalId, node.name, node.sku);
      const vivinoUrl = buildVivinoSearchUrl(wineName, producer !== "Unknown Producer" ? producer : "", country);

      for (const inv of inventories) {
        if (!inv) continue;
        const store = inv.store;
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
        items.push({
          externalId: node.sku,
          name: wineName,
          producer,
          type,
          varietal,
          country,
          subRegion,
          regionLabel: `${country} - ${subRegion}`,
          lcboUrl,
          vivinoUrl,
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
