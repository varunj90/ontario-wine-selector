export function buildVivinoSearchUrl(wineName: string, producer: string, country?: string | null): string {
  // Avoid duplicating the producer when it's already in the wine name
  // (e.g., producer "Cloudy Bay" + name "Cloudy Bay Sauvignon Blanc" → search "Cloudy Bay Sauvignon Blanc")
  const nameAlreadyIncludesProducer =
    producer && wineName.toLowerCase().includes(producer.toLowerCase());
  const parts = nameAlreadyIncludesProducer
    ? [wineName, country]
    : [producer, wineName, country];
  const query = parts.filter(Boolean).join(" ");
  return `https://www.vivino.com/search/wines?q=${encodeURIComponent(query)}`;
}

export function isDirectVivinoWineUrl(url?: string | null): boolean {
  if (!url) return false;
  // Direct Vivino URLs use patterns like:
  //   /w/12345  or  /wines/...  or  /{producer-slug}/{wine-slug}
  // Search fallback URLs always contain /search/wines
  if (url.includes("/search/wines")) return false;
  return url.startsWith("https://www.vivino.com/");
}

export function resolveVivinoUrl(storedVivinoUrl: string | null, wineName: string, producer: string, country: string): string {
  if (isDirectVivinoWineUrl(storedVivinoUrl)) {
    return storedVivinoUrl as string;
  }
  return buildVivinoSearchUrl(wineName, producer, country);
}

export function isTrustedVivinoSignal(confidenceScore: number | undefined, minConfidence: number): boolean {
  if (typeof confidenceScore !== "number" || !Number.isFinite(confidenceScore)) return false;
  return confidenceScore >= minConfidence;
}
