type RequestOptions = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  retries?: number;
  retryBackoffMs?: number;
  rateLimitMs?: number;
  requestTimeoutMs?: number;
};

let lastRequestAt = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function applyRateLimit(rateLimitMs: number) {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < rateLimitMs) {
    await sleep(rateLimitMs - elapsed);
  }
  lastRequestAt = Date.now();
}

export async function fetchJsonWithRetry<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const retries = options.retries ?? 3;
  const retryBackoffMs = options.retryBackoffMs ?? 500;
  const rateLimitMs = options.rateLimitMs ?? 250;
  const requestTimeoutMs = options.requestTimeoutMs ?? 15000;

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    try {
      await applyRateLimit(rateLimitMs);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
      let response: Response;
      try {
        response = await fetch(url, {
          method: options.method ?? "GET",
          headers: options.headers,
          body: options.body,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;

      const waitMs = retryBackoffMs * (attempt + 1);
      await sleep(waitMs);
      attempt += 1;
    }
  }

  throw lastError ?? new Error(`Failed to fetch JSON from ${url}`);
}
