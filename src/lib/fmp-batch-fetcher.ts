// ============================================================
// FMP Universe Fetcher — for free tier (250 calls/day)
//
// With ~80 stocks in the universe:
//   Phase 1: /stable/quote     × 80 = 80 calls  → price, SMA, 52wk
//   Phase 2: /stable/ratios-ttm × 80 = 80 calls → PE, PB, ROE, FCF
//   Phase 3: /stable/financial-growth × 80 = 80 calls → rev/EPS growth
//   Total: ~240 calls ✅ (well under 250/day)
//
// Uses 20-way parallelism → ~12s total execution time
// ============================================================

import { StockMetrics } from "./types";
import { getUniverseSymbols } from "./index-constituents";
import {
  FmpRatios,
  FmpGrowth,
  FmpTechnical,
  FmpScreenerResult,
  buildStockMetrics,
} from "./fmp-client";

const FMP_STABLE_URL = "https://financialmodelingprep.com/stable";
const PARALLEL = 20;

function getApiKey(): string {
  const key = process.env.FMP_API_KEY;
  if (!key) throw new Error("FMP_API_KEY is not set");
  return key;
}

async function fmpGet<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${FMP_STABLE_URL}${endpoint}`);
  url.searchParams.set("apikey", getApiKey());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`FMP ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
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
  }
  return { map: result, calls };
}

/**
 * Fetch the full universe of stocks from FMP with all metrics.
 */
export async function fetchFullUniverse(): Promise<FetchResult> {
  const symbols = getUniverseSymbols();
  const errors: string[] = [];
  let totalCalls = 0;

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

  // ---- Phase 2: Ratios → PE, PB, ROE, FCF yield, margins ----
  console.log(`[FMP] Phase 2: ratios for ${validSymbols.length} symbols...`);
  let ratioDebugLogged = false;
  const { map: ratioMap, calls: ratioCalls } = await parallelFetch<FmpRatios>(
    validSymbols,
    async (symbol) => {
      const data = await fmpGet<FmpRatios[]>("/ratios-ttm", { symbol });
      if (!data?.[0]) return null;
      // Log the first successful response to debug field names
      if (!ratioDebugLogged) {
        ratioDebugLogged = true;
        const keys = Object.keys(data[0]);
        const roeKeys = keys.filter(k => k.toLowerCase().includes('return') || k.toLowerCase().includes('roe') || k.toLowerCase().includes('equity'));
        console.log(`[FMP] Ratios sample keys for ${symbol}:`, keys.join(', '));
        console.log(`[FMP] ROE-related keys:`, roeKeys.join(', ') || 'NONE FOUND');
        console.log(`[FMP] returnOnEquityTTM value:`, data[0].returnOnEquityTTM);
        console.log(`[FMP] roeTTM value:`, data[0].roeTTM);
      }
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

  // ---- Build StockMetrics ----
  const stocks: StockMetrics[] = [];
  for (const symbol of validSymbols) {
    const upper = symbol.toUpperCase();
    const quote = quoteMap.get(upper);
    if (!quote) continue;

    const screener: FmpScreenerResult = {
      symbol: quote.symbol || symbol,
      companyName: quote.name || symbol,
      marketCap: quote.marketCap || 0,
      sector: "Unknown",
      industry: "Unknown",
      price: quote.price || 0,
      volume: quote.volume || 0,
      exchangeShortName: quote.exchange || "US",
      country: "US",
      isEtf: false,
      isActivelyTrading: true,
    };

    stocks.push(
      buildStockMetrics(screener, ratioMap.get(upper), growthMap.get(upper), quote)
    );
  }

  console.log(
    `[FMP] Complete: ${stocks.length} stocks, ${totalCalls} API calls, ${errors.length} errors`
  );

  return { stocks, apiCallsUsed: totalCalls, errors };
}
