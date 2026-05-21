// ============================================================
// FMP Universe Fetcher — for Starter tier (10,000 calls/day)
//
// Supports fetching a custom symbol list (for chunked cron jobs)
// or defaults to the curated universe.
//
// Rate limit: 300 calls/min → PARALLEL=25, DELAY=5s → 5 calls/s
//
// Refactored to use shared fmp-fetch module
// ============================================================

import { StockMetrics } from "./types";
import { getUniverseSymbols } from "./index-constituents";
import { getSectorInfo } from "./sector-map";
import {
  FmpRatios,
  FmpGrowth,
  FmpTechnical,
  FmpScreenerResult,
  FmpKeyMetrics,
  buildStockMetrics,
} from "./fmp-client";
import { fmpFetch, parallelBatchFetch, sleep } from "./fmp-fetch";

const PARALLEL = 25;
const BATCH_DELAY_MS = 5000; // 5s between batches → 25/5s = 5/s = 300/min

export interface FetchResult {
  stocks: StockMetrics[];
  apiCallsUsed: number;
  errors: string[];
}

/**
 * Fetch stocks from FMP with all metrics.
 * @param customSymbols — optional symbol list (used by chunked cron jobs).
 *   If omitted, falls back to the curated universe.
 */
export async function fetchFullUniverse(customSymbols?: string[]): Promise<FetchResult> {
  const symbols = customSymbols ?? getUniverseSymbols();
  const errors: string[] = [];
  let totalCalls = 0;

  // ---- Phase 1: Quote → price, marketCap, SMA, 52-week ----
  console.log(`[FMP] Phase 1: quotes for ${symbols.length} symbols...`);
  const { map: quoteMap, calls: quoteCalls } = await parallelBatchFetch<FmpTechnical>(
    symbols,
    async (symbol) => {
      const data = await fmpFetch<FmpTechnical[]>("/quote", { symbol });
      if (!data?.[0]?.symbol) return null;
      return { key: data[0].symbol.toUpperCase(), value: data[0] };
    },
    { batchSize: PARALLEL, delayMs: BATCH_DELAY_MS, errors }
  );
  totalCalls += quoteCalls;
  console.log(`[FMP] Phase 1 done: ${quoteMap.size} quotes (${quoteCalls} calls)`);

  // Only proceed with symbols that have quote data
  const validSymbols = symbols.filter((s) => quoteMap.has(s.toUpperCase()));

  // ---- Phase 2: Ratios → PE, PB, FCF yield, margins ----
  console.log(`[FMP] Phase 2: ratios for ${validSymbols.length} symbols...`);
  const { map: ratioMap, calls: ratioCalls } = await parallelBatchFetch<FmpRatios>(
    validSymbols,
    async (symbol) => {
      const data = await fmpFetch<FmpRatios[]>("/ratios-ttm", { symbol });
      if (!data?.[0]) return null;
      return { key: symbol.toUpperCase(), value: data[0] };
    },
    { batchSize: PARALLEL, delayMs: BATCH_DELAY_MS, errors }
  );
  totalCalls += ratioCalls;
  console.log(`[FMP] Phase 2 done: ${ratioMap.size} ratios (${ratioCalls} calls)`);

  // ---- Phase 3: Growth → revenue & EPS growth ----
  console.log(`[FMP] Phase 3: growth for ${validSymbols.length} symbols...`);
  const { map: growthMap, calls: growthCalls } = await parallelBatchFetch<FmpGrowth>(
    validSymbols,
    async (symbol) => {
      const data = await fmpFetch<FmpGrowth[]>("/financial-growth", {
        symbol,
        limit: "1",
      });
      if (!data?.[0]) return null;
      return { key: symbol.toUpperCase(), value: data[0] };
    },
    { batchSize: PARALLEL, delayMs: BATCH_DELAY_MS, errors }
  );
  totalCalls += growthCalls;
  console.log(`[FMP] Phase 3 done: ${growthMap.size} growth (${growthCalls} calls)`);

  // ---- Phase 4: Key Metrics → ROE, ROIC ----
  console.log(`[FMP] Phase 4: key metrics for ${validSymbols.length} symbols...`);
  const { map: keyMetricsMap, calls: keyMetricsCalls } = await parallelBatchFetch<FmpKeyMetrics>(
    validSymbols,
    async (symbol) => {
      const data = await fmpFetch<FmpKeyMetrics[]>("/key-metrics-ttm", {
        symbol,
        limit: "1",
      });
      if (!data?.[0]) return null;
      return { key: symbol.toUpperCase(), value: data[0] };
    },
    { batchSize: PARALLEL, delayMs: BATCH_DELAY_MS, errors }
  );
  totalCalls += keyMetricsCalls;
  console.log(`[FMP] Phase 4 done: ${keyMetricsMap.size} key metrics (${keyMetricsCalls} calls)`);

  // ---- Build StockMetrics ----
  const stocks: StockMetrics[] = [];
  for (const symbol of validSymbols) {
    const upper = symbol.toUpperCase();
    const quote = quoteMap.get(upper);
    if (!quote) continue;

    const { sector, industry } = getSectorInfo(upper);

    const screener: FmpScreenerResult = {
      symbol: quote.symbol || symbol,
      companyName: quote.name || symbol,
      marketCap: quote.marketCap || 0,
      sector,
      industry,
      price: quote.price || 0,
      volume: quote.volume || 0,
      exchangeShortName: quote.exchange || "US",
      country: "US",
      isEtf: false,
      isActivelyTrading: true,
    };

    stocks.push(
      buildStockMetrics(screener, ratioMap.get(upper), growthMap.get(upper), quote, keyMetricsMap.get(upper))
    );
  }

  console.log(
    `[FMP] Complete: ${stocks.length} stocks, ${totalCalls} API calls, ${errors.length} errors`
  );

  return { stocks, apiCallsUsed: totalCalls, errors };
}
