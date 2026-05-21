// ============================================================
// Shared FMP HTTP fetcher with retry + rate-limit backoff
// Single source of truth for all FMP API calls
// ============================================================

import { FMP_STABLE_URL, getApiKey } from "./fmp-config";

export interface FmpFetchOptions {
  /** Max retry attempts (default: 3) */
  retries?: number;
  /** Base delay in ms for rate-limit backoff (default: 3000) */
  backoffBaseMs?: number;
  /** Next.js revalidate interval in seconds (0 = no cache) */
  revalidate?: number;
}

const DEFAULT_OPTIONS: Required<FmpFetchOptions> = {
  retries: 3,
  backoffBaseMs: 3000,
  revalidate: 0,
};

/**
 * Sleep helper — extracted to be shared across modules.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Unified FMP API fetcher with retry + 429 backoff.
 * 
 * @param endpoint — FMP stable endpoint path (e.g. "/quote")
 * @param params — query parameters (excluding apikey)
 * @param options — retry/backoff configuration
 */
export async function fmpFetch<T>(
  endpoint: string,
  params: Record<string, string> = {},
  options: FmpFetchOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const url = new URL(`${FMP_STABLE_URL}${endpoint}`);
  url.searchParams.set("apikey", getApiKey());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const fetchOptions: RequestInit = {};
  if (opts.revalidate > 0) {
    // Next.js fetch cache hint
    (fetchOptions as Record<string, unknown>).next = { revalidate: opts.revalidate };
  }

  for (let attempt = 0; attempt < opts.retries; attempt++) {
    const res = await fetch(url.toString(), fetchOptions);

    if (res.ok) {
      return res.json() as Promise<T>;
    }

    if (res.status === 429) {
      const wait = (attempt + 1) * opts.backoffBaseMs;
      console.log(
        `[FMP] Rate limited on ${endpoint}, retrying in ${wait / 1000}s (attempt ${attempt + 1}/${opts.retries})...`
      );
      await sleep(wait);
      continue;
    }

    throw new Error(`FMP API error: ${res.status} ${res.statusText}`);
  }

  throw new Error(`FMP 429: Rate Limited (after ${opts.retries} retries)`);
}

/**
 * Run an async operation on items in parallel batches.
 * Returns collected results as a Map, collecting errors separately.
 */
export async function parallelBatchFetch<T>(
  items: string[],
  fetcher: (item: string) => Promise<{ key: string; value: T } | null>,
  options: { batchSize?: number; delayMs?: number; errors?: string[] } = {}
): Promise<{ map: Map<string, T>; calls: number }> {
  const batchSize = options.batchSize ?? 10;
  const delayMs = options.delayMs ?? 1000;
  const errors = options.errors ?? [];
  const result = new Map<string, T>();
  let calls = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, Math.min(i + batchSize, items.length));
    const settled = await Promise.allSettled(
      batch.map(async (item) => {
        calls++;
        return fetcher(item);
      })
    );

    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) {
        result.set(r.value.key, r.value.value);
      } else if (r.status === "rejected") {
        errors.push(String(r.reason).slice(0, 120));
      }
    }

    // Throttle between batches
    if (i + batchSize < items.length && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return { map: result, calls };
}
