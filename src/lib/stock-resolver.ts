// ============================================================
// Stock Resolver: resolves a symbol to StockMetrics
// Priority: Firestore pool → FMP API (live) → Mock data
// ============================================================

import { StockMetrics } from "./types";
import { generateMockStocks } from "./mock-data";
import { loadStockPool } from "./stock-pool-store";
import { fetchRatiosBatch, fetchGrowthBatch, buildStockMetrics } from "./fmp-client";

const FMP_STABLE_URL = "https://financialmodelingprep.com/stable";

/**
 * Resolve a stock symbol to a fully-populated StockMetrics object.
 *
 * Strategy (in priority order):
 *  1. Check Firestore stock pool (no API cost, instant)
 *  2. If FMP_API_KEY is set → fetch live from FMP (costs 3 API calls)
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
      if (found) return found;
    }
  } catch {
    // Firestore not available, continue to next strategy
  }

  // 2. Try live FMP API (if key is set)
  if (process.env.FMP_API_KEY) {
    try {
      const response = await fetch(
        `${FMP_STABLE_URL}/profile?symbol=${upperSymbol}&apikey=${process.env.FMP_API_KEY}`
      );
      if (response.ok) {
        const profiles = await response.json();
        if (Array.isArray(profiles) && profiles.length > 0) {
          const profile = profiles[0];

          const [ratioMap, growthMap] = await Promise.all([
            fetchRatiosBatch([upperSymbol]),
            fetchGrowthBatch([upperSymbol]),
          ]);

          const baseScreener = {
            symbol: profile.symbol || upperSymbol,
            companyName: profile.companyName || profile.name || upperSymbol,
            marketCap: profile.marketCap || 0,
            sector: profile.sector || "Unknown",
            industry: profile.industry || "Unknown",
            price: profile.price || 0,
            volume: profile.volume || 0,
            exchangeShortName: profile.exchange || "US",
            country: profile.country || "US",
            isEtf: profile.isEtf || false,
            isActivelyTrading: profile.isActivelyTrading !== false,
          };

          return buildStockMetrics(
            baseScreener,
            ratioMap.get(upperSymbol),
            growthMap.get(upperSymbol),
            undefined
          );
        }
      }
    } catch {
      // FMP API failed (quota exceeded, etc.), continue to mock
    }
  }

  // 3. Fallback to mock data
  const mocks = generateMockStocks();
  return mocks.find((s) => s.symbol.toUpperCase() === upperSymbol);
}
