export function buildVivinoSearchUrl(wineName: string, producer: string, country?: string | null): string {
  const query = [producer, wineName, country].filter(Boolean).join(" ");
  return `https://www.vivino.com/search/wines?q=${encodeURIComponent(query)}`;
}

export function isDirectVivinoWineUrl(url?: string | null): boolean {
  if (!url) return false;
  return /\/w\/|\/wines\//.test(url);
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
