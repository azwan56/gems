// ============================================================
// Stock Resolver: resolves a symbol to StockMetrics
// Priority: Firestore pool → FMP API (live) → Mock data
// ============================================================

import { StockMetrics } from "./types";
import { generateMockStocks } from "./mock-data";
import { loadStockPool } from "./stock-pool-store";
import { getSectorInfo } from "./sector-map";
import { fetchRatiosBatch, fetchGrowthBatch, fetchOnDemandStocks } from "./fmp-client";
import { hasApiKey } from "./fmp-config";

/**
 * Resolve a stock symbol to a fully-populated StockMetrics object.
 *
 * Strategy (in priority order):
 *  1. Check Firestore stock pool (no API cost, instant)
 *  2. If FMP_API_KEY is set → fetch live from FMP via fetchOnDemandStocks (reuses fmp-client)
 *  3. Fallback → look up from mock data pool
 *
 * This is the single entry point used by the analysis API route.
 */
export async function resolveStock(symbol: string): Promise<StockMetrics | undefined> {
  const upperSymbol = symbol.toUpperCase();

  // 1. Try Firestore pool first (zero API cost)
  try {
    const pool = await loadStockPool();
    if (pool?.stocks) {
      const found = pool.stocks.find(
        (s: StockMetrics) => s.symbol.toUpperCase() === upperSymbol
      );
      if (found) {
        // Patch sector/industry if it was saved as "Unknown" in the old pool
        if (found.sector === "Unknown" || !found.sector) {
          const { sector, industry } = getSectorInfo(upperSymbol);
          found.sector = sector;
          found.industry = industry;
        }
        return found;
      }
    }
  } catch {
    // Firestore not available, continue to next strategy
  }

  // 2. Try live FMP API (if key is set) — reuses fmp-client module
  if (hasApiKey()) {
    try {
      const results = await fetchOnDemandStocks([upperSymbol]);
      if (results.length > 0) {
        return results[0];
      }
    } catch {
      // FMP API failed (quota exceeded, etc.), continue to mock
    }
  }

  // 3. Fallback to mock data
  const mocks = generateMockStocks();
  return mocks.find((s) => s.symbol.toUpperCase() === upperSymbol);
}
