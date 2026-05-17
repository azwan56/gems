// ============================================================
// Stock Resolver: resolves a symbol to StockMetrics
// Bridges mock data and live FMP API based on environment config
// ============================================================

import { StockMetrics } from "./types";
import { generateMockStocks } from "./mock-data";
import { fetchRatiosBatch, fetchGrowthBatch, buildStockMetrics } from "./fmp-client";

const FMP_STABLE_URL = "https://financialmodelingprep.com/stable";

/**
 * Resolve a stock symbol to a fully-populated StockMetrics object.
 *
 * Strategy:
 *  1. If FMP_API_KEY is set → fetch real data from FMP /stable/profile + ratios + growth
 *  2. Otherwise → look up from mock data pool
 *
 * This is the single entry point used by the analysis API route.
 */
export async function resolveStock(symbol: string): Promise<StockMetrics | undefined> {
  const upperSymbol = symbol.toUpperCase();

  // If no FMP key, fallback to mock data
  if (!process.env.FMP_API_KEY) {
    const mocks = generateMockStocks();
    return mocks.find((s) => s.symbol.toUpperCase() === upperSymbol);
  }

  // With FMP key, fetch the actual data to build StockMetrics
  // We use /stable/profile for the base info since it works for all symbols on free tier
  try {
    const response = await fetch(
      `${FMP_STABLE_URL}/profile?symbol=${upperSymbol}&apikey=${process.env.FMP_API_KEY}`
    );
    if (!response.ok) return undefined;

    const profiles = await response.json();
    if (!Array.isArray(profiles) || profiles.length === 0) return undefined;

    const profile = profiles[0];

    // Try to fetch ratios and growth, these might fail depending on free tier limits
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
  } catch {
    return undefined;
  }
}
