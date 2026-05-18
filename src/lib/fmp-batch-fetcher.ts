// ============================================================
// FMP Batch Fetcher — optimized universe fetch for free tier
//
// Budget: 250 API calls/day
// Strategy:
//   1. /stable/quote batch (comma-separated) → ~4 calls
//   2. /stable/profile batch (comma-separated) → ~4 calls
//   3. /stable/ratios-ttm individual → up to 120 calls
//   4. /stable/financial-growth individual → up to 120 calls
//   Total: ~248 calls, fits within 250/day
//
// Parallel requests within each phase for speed.
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

function getApiKey(): string {
  const key = process.env.FMP_API_KEY;
  if (!key) throw new Error("FMP_API_KEY is not set");
  return key;
}

async function fmpGet<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${FMP_STABLE_URL}${endpoint}`);
  url.searchParams.set("apikey", getApiKey());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`FMP ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

/** Split array into chunks */
function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

/** Small delay to be polite to the API */
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface FetchProgress {
  phase: string;
  current: number;
  total: number;
  apiCallsUsed: number;
}

export interface FetchResult {
  stocks: StockMetrics[];
  apiCallsUsed: number;
  errors: string[];
}

/**
 * Fetch the full universe of stocks from FMP, optimized for free tier.
 *
 * Phase 1: Batch quote → price, marketCap, SMA, 52-week range
 * Phase 2: Batch profile → sector, industry, companyName
 * Phase 3: Individual ratios-ttm → PE, PB, FCF yield, ROE, etc.
 * Phase 4: Individual financial-growth → revenue & EPS growth
 */
export async function fetchFullUniverse(): Promise<FetchResult> {
  const symbols = getUniverseSymbols();
  let apiCalls = 0;
  const errors: string[] = [];

  // ---- Phase 1: Batch Quote (supports comma-separated) ----
  const quoteMap = new Map<string, FmpTechnical>();
  const quoteBatches = chunk(symbols, 50);
  for (const batch of quoteBatches) {
    try {
      const data = await fmpGet<FmpTechnical[]>("/quote", { symbol: batch.join(",") });
      apiCalls++;
      for (const q of data) {
        if (q.symbol) quoteMap.set(q.symbol.toUpperCase(), q);
      }
    } catch (e) {
      errors.push(`Quote batch error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`[FMP] Phase 1 (quote): ${quoteMap.size} quotes, ${apiCalls} calls`);

  // ---- Phase 2: Batch Profile (for sector/industry) ----
  const profileMap = new Map<string, FmpScreenerResult>();
  const profileBatches = chunk(symbols, 50);
  for (const batch of profileBatches) {
    try {
      const data = await fmpGet<Array<{
        symbol: string; companyName: string; marketCap: number;
        sector: string; industry: string; price: number;
        volume: number; exchange: string; country: string;
        isEtf: boolean; isActivelyTrading: boolean;
      }>>("/profile", { symbol: batch.join(",") });
      apiCalls++;
      for (const p of data) {
        if (p.symbol) {
          profileMap.set(p.symbol.toUpperCase(), {
            symbol: p.symbol,
            companyName: p.companyName || p.symbol,
            marketCap: p.marketCap || 0,
            sector: p.sector || "Unknown",
            industry: p.industry || "Unknown",
            price: p.price || 0,
            volume: p.volume || 0,
            exchangeShortName: p.exchange || "US",
            country: p.country || "US",
            isEtf: p.isEtf ?? false,
            isActivelyTrading: p.isActivelyTrading ?? true,
          });
        }
      }
    } catch (e) {
      errors.push(`Profile batch error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`[FMP] Phase 2 (profile): ${profileMap.size} profiles, ${apiCalls} calls`);

  // Determine which symbols we have data for
  const validSymbols = symbols.filter(
    (s) => quoteMap.has(s.toUpperCase()) || profileMap.has(s.toUpperCase())
  );

  // ---- Phase 3: Individual ratios-ttm (budget-limited) ----
  const RATIO_BUDGET = Math.min(validSymbols.length, Math.floor((250 - apiCalls) / 2));
  const ratioMap = new Map<string, FmpRatios>();
  const ratioBatches = chunk(validSymbols.slice(0, RATIO_BUDGET), 10);
  for (const batch of ratioBatches) {
    const results = await Promise.allSettled(
      batch.map(async (symbol) => {
        const data = await fmpGet<FmpRatios[]>("/ratios-ttm", { symbol });
        apiCalls++;
        if (data?.[0]) ratioMap.set(symbol.toUpperCase(), data[0]);
      })
    );
    for (const r of results) {
      if (r.status === "rejected") {
        errors.push(`Ratios error: ${r.reason}`);
      }
    }
    await delay(100); // small pause between parallel batches
  }
  console.log(`[FMP] Phase 3 (ratios): ${ratioMap.size} ratios, ${apiCalls} calls`);

  // ---- Phase 4: Individual financial-growth (budget-limited) ----
  const GROWTH_BUDGET = Math.min(validSymbols.length, 250 - apiCalls);
  const growthMap = new Map<string, FmpGrowth>();
  const growthBatches = chunk(validSymbols.slice(0, GROWTH_BUDGET), 10);
  for (const batch of growthBatches) {
    const results = await Promise.allSettled(
      batch.map(async (symbol) => {
        const data = await fmpGet<FmpGrowth[]>("/financial-growth", {
          symbol,
          limit: "1",
        });
        apiCalls++;
        if (data?.[0]) growthMap.set(symbol.toUpperCase(), data[0]);
      })
    );
    for (const r of results) {
      if (r.status === "rejected") {
        errors.push(`Growth error: ${r.reason}`);
      }
    }
    await delay(100);
  }
  console.log(`[FMP] Phase 4 (growth): ${growthMap.size} growth, ${apiCalls} calls`);

  // ---- Build StockMetrics ----
  const stocks: StockMetrics[] = [];
  for (const symbol of validSymbols) {
    const upper = symbol.toUpperCase();
    const profile = profileMap.get(upper);
    const quote = quoteMap.get(upper);

    if (!profile && !quote) continue;

    const screener: FmpScreenerResult = profile ?? {
      symbol: quote?.symbol || symbol,
      companyName: quote?.name || symbol,
      marketCap: quote?.marketCap || 0,
      sector: "Unknown",
      industry: "Unknown",
      price: quote?.price || 0,
      volume: quote?.volume || 0,
      exchangeShortName: quote?.exchange || "US",
      country: "US",
      isEtf: false,
      isActivelyTrading: true,
    };

    stocks.push(
      buildStockMetrics(screener, ratioMap.get(upper), growthMap.get(upper), quote)
    );
  }

  console.log(
    `[FMP] Fetch complete: ${stocks.length} stocks, ${apiCalls} API calls, ${errors.length} errors`
  );

  return { stocks, apiCallsUsed: apiCalls, errors };
}
