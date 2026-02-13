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

// ── Observability counters ────────────────────────────────────────────────
export type ScrapeStats = {
  attempted: number;
  success: number;
  nullResult: number;
  errors: number;
  skipped: number;
  /** First N failed URLs for quick debugging. */
  sampleFailedUrls: string[];
};

const MAX_FAILED_SAMPLES = 10;

const stats: ScrapeStats = {
  attempted: 0,
  success: 0,
  nullResult: 0,
  errors: 0,
  skipped: 0,
  sampleFailedUrls: [],
};

/** Returns a snapshot of the current scrape statistics. */
export function getScrapeStats(): Readonly<ScrapeStats> {
  return { ...stats, sampleFailedUrls: [...stats.sampleFailedUrls] };
}

/** Resets all counters (useful between test runs or script restarts). */
export function resetScrapeStats(): void {
  stats.attempted = 0;
  stats.success = 0;
  stats.nullResult = 0;
  stats.errors = 0;
  stats.skipped = 0;
  stats.sampleFailedUrls = [];
}

/**
 * Returns the scrape success rate as a number between 0 and 1.
 * Returns 1 when nothing has been attempted yet (no data = no alarm).
 */
export function scrapeSuccessRate(): number {
  if (stats.attempted === 0) return 1;
  return stats.success / stats.attempted;
}

const DEFAULT_SUCCESS_THRESHOLD = 0.7;

/**
 * Throws if the success rate drops below `threshold` (default 70%).
 * Call after a scrape batch to halt early if LCBO's HTML changed.
 */
export function assertScrapeHealth(threshold = DEFAULT_SUCCESS_THRESHOLD): void {
  const rate = scrapeSuccessRate();
  if (stats.attempted >= 10 && rate < threshold) {
    throw new Error(
      `Scrape success rate ${(rate * 100).toFixed(1)}% is below threshold ${(threshold * 100).toFixed(0)}%. ` +
        `Stats: ${JSON.stringify(getScrapeStats())}. ` +
        `LCBO's HTML structure may have changed — check sample failed URLs.`,
    );
  }
}

function trackFailed(url: string): void {
  stats.nullResult += 1;
  if (stats.sampleFailedUrls.length < MAX_FAILED_SAMPLES) {
    stats.sampleFailedUrls.push(url);
  }
}

// ── Core scraper ──────────────────────────────────────────────────────────

/**
 * Given an LCBO product page URL (e.g. https://www.lcbo.com/en/gato-negro-chardonnay-11928),
 * fetches the page and extracts the varietal name.
 *
 * Returns the varietal string (e.g. "Chardonnay") or `null` if the page
 * cannot be fetched or the varietal label is not present.
 */
export async function scrapeLcboVarietal(lcboUrl: string): Promise<string | null> {
  if (!lcboUrl || lcboUrl.includes("catalogsearch")) {
    stats.skipped += 1;
    return null;
  }

  const cached = varietalCache.get(lcboUrl);
  if (cached !== undefined) return cached;

  stats.attempted += 1;

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
      trackFailed(lcboUrl);
      return null;
    }

    const html = await resp.text();
    const match = LABEL_VALUE_RE.exec(html);
    const varietal = match?.[1]?.trim() || null;

    varietalCache.set(lcboUrl, varietal);

    if (varietal) {
      stats.success += 1;
    } else {
      trackFailed(lcboUrl);
    }

    return varietal;
  } catch {
    varietalCache.set(lcboUrl, null);
    stats.errors += 1;
    if (stats.sampleFailedUrls.length < MAX_FAILED_SAMPLES) {
      stats.sampleFailedUrls.push(lcboUrl);
    }
    return null;
  }
}

/**
 * Constructs the canonical LCBO product page URL for a given product.
 * Prefers the real URL from `externalId` when available.
 */
export function buildLcboProductUrl(name: string, sku: string, externalId?: string | null): string {
  if (externalId) {
    const match = externalId.match(/\$(https:\/\/www\.lcbo\.com\/[^\s]+)/);
    if (match) return match[1];
  }
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
