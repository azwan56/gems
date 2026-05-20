// ============================================================
// FMP Universe Fetcher — for Starter tier (10,000 calls/day)
//
// Supports fetching a custom symbol list (for chunked cron jobs)
// or defaults to the curated universe.
//
// Rate limit: 300 calls/min → PARALLEL=25, DELAY=5s → 5 calls/s
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
import { FMP_STABLE_URL, getApiKey } from "./fmp-config";

const PARALLEL = 25;
const BATCH_DELAY_MS = 5000; // 5s between batches → 25/5s = 5/s = 300/min

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fmpGet<T>(
  endpoint: string,
  params: Record<string, string> = {},
  retries = 3
): Promise<T> {
  const url = new URL(`${FMP_STABLE_URL}${endpoint}`);
  url.searchParams.set("apikey", getApiKey());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url.toString());
    if (res.ok) return res.json() as Promise<T>;
    if (res.status === 429) {
      const wait = (attempt + 1) * 3000;
      console.log(`[FMP] Rate limited on ${endpoint}, retrying in ${wait/1000}s...`);
      await sleep(wait);
      continue;
    }
    throw new Error(`FMP ${res.status}: ${res.statusText}`);
  }
  throw new Error(`FMP 429: Rate Limited (after ${retries} retries)`);
}

export interface FetchResult {
  stocks: StockMetrics[];
  apiCallsUsed: number;
  errors: string[];
}

/**
 * Run fetches in parallel batches, returning results as a Map.
 */
async function parallelFetch<T>(
  symbols: string[],
  fetcher: (symbol: string) => Promise<{ key: string; value: T } | null>,
  errors: string[]
): Promise<{ map: Map<string, T>; calls: number }> {
  const result = new Map<string, T>();
  let calls = 0;

  for (let i = 0; i < symbols.length; i += PARALLEL) {
    const batch = symbols.slice(i, Math.min(i + PARALLEL, symbols.length));
    const settled = await Promise.allSettled(
      batch.map(async (symbol) => {
        calls++;
        return fetcher(symbol);
      })
    );
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) {
        result.set(r.value.key, r.value.value);
      } else if (r.status === "rejected") {
        errors.push(String(r.reason).slice(0, 120));
      }
    }
    // Throttle between batches to respect per-minute rate limits
    if (i + PARALLEL < symbols.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }
  return { map: result, calls };
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
  // ---- Phase 1: Quote → price, marketCap, SMA, 52-week ----
  console.log(`[FMP] Phase 1: quotes for ${symbols.length} symbols...`);
  const { map: quoteMap, calls: quoteCalls } = await parallelFetch<FmpTechnical>(
    symbols,
    async (symbol) => {
      const data = await fmpGet<FmpTechnical[]>("/quote", { symbol });
      if (!data?.[0]?.symbol) return null;
      return { key: data[0].symbol.toUpperCase(), value: data[0] };
    },
    errors
  );
  totalCalls += quoteCalls;
  console.log(`[FMP] Phase 1 done: ${quoteMap.size} quotes (${quoteCalls} calls)`);

  // Only proceed with symbols that have quote data
  const validSymbols = symbols.filter((s) => quoteMap.has(s.toUpperCase()));

  // ---- Phase 2: Ratios → PE, PB, FCF yield, margins ----
  console.log(`[FMP] Phase 2: ratios for ${validSymbols.length} symbols...`);
  const { map: ratioMap, calls: ratioCalls } = await parallelFetch<FmpRatios>(
    validSymbols,
    async (symbol) => {
      const data = await fmpGet<FmpRatios[]>("/ratios-ttm", { symbol });
      if (!data?.[0]) return null;
      return { key: symbol.toUpperCase(), value: data[0] };
    },
    errors
  );
  totalCalls += ratioCalls;
  console.log(`[FMP] Phase 2 done: ${ratioMap.size} ratios (${ratioCalls} calls)`);

  // ---- Phase 3: Growth → revenue & EPS growth ----
  console.log(`[FMP] Phase 3: growth for ${validSymbols.length} symbols...`);
  const { map: growthMap, calls: growthCalls } = await parallelFetch<FmpGrowth>(
    validSymbols,
    async (symbol) => {
      const data = await fmpGet<FmpGrowth[]>("/financial-growth", {
        symbol,
        limit: "1",
      });
      if (!data?.[0]) return null;
      return { key: symbol.toUpperCase(), value: data[0] };
    },
    errors
  );
  totalCalls += growthCalls;
  console.log(`[FMP] Phase 3 done: ${growthMap.size} growth (${growthCalls} calls)`);

  // ---- Phase 4: Key Metrics → ROE, ROIC ----
  console.log(`[FMP] Phase 4: key metrics for ${validSymbols.length} symbols...`);
  const { map: keyMetricsMap, calls: keyMetricsCalls } = await parallelFetch<FmpKeyMetrics>(
    validSymbols,
    async (symbol) => {
      const data = await fmpGet<FmpKeyMetrics[]>("/key-metrics-ttm", {
        symbol,
        limit: "1",
      });
      if (!data?.[0]) return null;
      return { key: symbol.toUpperCase(), value: data[0] };
    },
    errors
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
