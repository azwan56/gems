// ============================================================
// FMP API Configuration — shared constants and utilities
// Single source of truth for FMP base URL and API key access
// ============================================================

/** Base URL for FMP's stable (v4) endpoints */
export const FMP_STABLE_URL = "https://financialmodelingprep.com/stable";

/**
 * Retrieve the FMP API key from environment variables.
 * Throws if the key is not configured.
 */
export function getApiKey(): string {
  const key = process.env.FMP_API_KEY;
  if (!key) {
    throw new Error("FMP_API_KEY environment variable is not set");
  }
  return key;
}

/**
 * Check whether an FMP API key is available (without throwing).
 */
export function hasApiKey(): boolean {
  return !!process.env.FMP_API_KEY;
}
