/**
 * Scrapes the authoritative varietal name from an LCBO product detail page.
 *
 * The LCBO GraphQL API (api.lcbo.dev) does not expose a structured varietal
 * field, but the server-rendered product pages always include it in the
 * "More Details" section:
 *
 *     <div class="label">Varietal</div>
 *     <div class="value">Chardonnay</div>
 *
 * We extract this from the HTML rather than guessing from product names.
 */

const LABEL_VALUE_RE =
  /<div class="label">\s*Varietal\s*<\/div>\s*<div class="value">\s*([^<]+?)\s*<\/div>/i;

/** In-memory cache to avoid redundant scrapes within a process lifetime. */
const varietalCache = new Map<string, string | null>();

/**
 * Given an LCBO product page URL (e.g. https://www.lcbo.com/en/gato-negro-chardonnay-11928),
 * fetches the page and extracts the varietal name.
 *
 * Returns the varietal string (e.g. "Chardonnay") or `null` if the page
 * cannot be fetched or the varietal label is not present.
 */
export async function scrapeLcboVarietal(lcboUrl: string): Promise<string | null> {
  if (!lcboUrl || lcboUrl.includes("catalogsearch")) return null;

  const cached = varietalCache.get(lcboUrl);
  if (cached !== undefined) return cached;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const resp = await fetch(lcboUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120",
        Accept: "text/html",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      varietalCache.set(lcboUrl, null);
      return null;
    }

    const html = await resp.text();
    const match = LABEL_VALUE_RE.exec(html);
    const varietal = match?.[1]?.trim() || null;

    varietalCache.set(lcboUrl, varietal);
    return varietal;
  } catch {
    varietalCache.set(lcboUrl, null);
    return null;
  }
}

/**
 * Constructs the canonical LCBO product page URL for a given product.
 */
export function buildLcboProductUrl(name: string, sku: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `https://www.lcbo.com/en/${slug}-${sku}`;
}

/** Clear the in-memory cache (useful for tests). */
export function clearVarietalCache(): void {
  varietalCache.clear();
}
