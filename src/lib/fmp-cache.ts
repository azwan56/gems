// ============================================================
// FMP API Cache — generic in-memory TTL cache
// Extracted from fmp-client.ts for reuse and testability
// ============================================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

/** Default TTL: 30 minutes */
export const DEFAULT_TTL_MS = 30 * 60 * 1000;

/**
 * Retrieve a cached value by key. Returns null if missing or expired.
 */
export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

/**
 * Store a value in the cache with a TTL.
 */
export function setCache<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/**
 * Clear all cached entries. Useful for testing and manual refresh.
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Get the current number of cache entries (for diagnostics).
 */
export function cacheSize(): number {
  return cache.size;
}
