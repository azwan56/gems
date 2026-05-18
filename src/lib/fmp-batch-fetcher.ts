// ============================================================
// FMP Batch Fetcher — optimized universe fetch for free tier
//
// Free tier constraints:
//   - 250 API calls/day
//   - NO comma-separated batch queries (402 error)
//   - Each endpoint call = 1 symbol, ~1s latency
//
// To fit within Vercel function timeout (60s for pro, 10s hobby),
// we use aggressive parallelism (20 concurrent requests).
//
// Budget allocation for ~160 symbols:
//   Phase 1: /stable/quote × 160 = 160 calls
//   Phase 2: /stable/ratios-ttm × 40 = 40 calls  (top 40 by market cap)
//   Phase 3: /stable/financial-growth × 40 = 40 calls
//   Total: ~240 calls ✅
//
// With 20-way parallelism: 160/20 = 8 rounds × ~1.5s = ~12s for phase 1
// Plus phases 2-3: 40/20 × 2 = 4 rounds × ~1.5s = ~6s
// Grand total: ~18s (fits within 60s Vercel Pro timeout)
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
const MAX_API_CALLS = 245;
const PARALLEL = 20; // concurrent requests

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
  budget: { current: number; max: number },
  errors: string[]
): Promise<Map<string, T>> {
  const result = new Map<string, T>();

  for (let i = 0; i < symbols.length && budget.current < budget.max; i += PARALLEL) {
    const batch = symbols.slice(
      i,
      Math.min(i + PARALLEL, symbols.length, i + (budget.max - budget.current))
    );
    const settled = await Promise.allSettled(
      batch.map(async (symbol) => {
        budget.current++;
        return fetcher(symbol);
      })
    );
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) {
        result.set(r.value.key, r.value.value);
      } else if (r.status === "rejected") {
        errors.push(String(r.reason).slice(0, 100));
      }
    }
  }
  return result;
}

/**
 * Fetch the full universe of stocks from FMP.
 */
export async function fetchFullUniverse(): Promise<FetchResult> {
  const symbols = getUniverseSymbols();
  const errors: string[] = [];
  const budget = { current: 0, max: MAX_API_CALLS };

  // ---- Phase 1: Quote for ALL symbols ----
  console.log(`[FMP] Phase 1: fetching quotes for ${symbols.length} symbols...`);
  const quoteMap = await parallelFetch<FmpTechnical>(
    symbols,
    async (symbol) => {
      const data = await fmpGet<FmpTechnical[]>("/quote", { symbol });
      if (!data?.[0]?.symbol) return null;
      return { key: data[0].symbol.toUpperCase(), value: data[0] };
    },
    budget,
    errors
  );
  console.log(`[FMP] Phase 1 done: ${quoteMap.size} quotes, ${budget.current} calls`);

  // Get list of symbols we have quote data for, sorted by market cap desc
  const validSymbols = symbols
    .filter((s) => quoteMap.has(s.toUpperCase()))
    .sort((a, b) => {
      const mcA = quoteMap.get(a.toUpperCase())?.marketCap ?? 0;
      const mcB = quoteMap.get(b.toUpperCase())?.marketCap ?? 0;
      return mcB - mcA; // largest first → they get ratios/growth priority
    });

  // ---- Phase 2: Ratios for top candidates ----
  const ratiosBudget = Math.floor((budget.max - budget.current) / 2);
  const ratioSymbols = validSymbols.slice(0, ratiosBudget);
  console.log(`[FMP] Phase 2: fetching ratios for ${ratioSymbols.length} symbols...`);

  const ratioMap = await parallelFetch<FmpRatios>(
    ratioSymbols,
    async (symbol) => {
      const data = await fmpGet<FmpRatios[]>("/ratios-ttm", { symbol });
      if (!data?.[0]) return null;
      return { key: symbol.toUpperCase(), value: data[0] };
    },
    budget,
    errors
  );
  console.log(`[FMP] Phase 2 done: ${ratioMap.size} ratios, ${budget.current} calls`);

  // ---- Phase 3: Growth for top candidates ----
  const growthBudget = budget.max - budget.current;
  const growthSymbols = ratioSymbols.slice(0, growthBudget);
  console.log(`[FMP] Phase 3: fetching growth for ${growthSymbols.length} symbols...`);

  const growthMap = await parallelFetch<FmpGrowth>(
    growthSymbols,
    async (symbol) => {
      const data = await fmpGet<FmpGrowth[]>("/financial-growth", {
        symbol,
        limit: "1",
      });
      if (!data?.[0]) return null;
      return { key: symbol.toUpperCase(), value: data[0] };
    },
    budget,
    errors
  );
  console.log(`[FMP] Phase 3 done: ${growthMap.size} growth, ${budget.current} calls`);

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
    `[FMP] Complete: ${stocks.length} stocks, ${budget.current} API calls, ${errors.length} errors`
  );

  return { stocks, apiCallsUsed: budget.current, errors };
}
