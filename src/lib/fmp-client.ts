// ============================================================
// Financial Modeling Prep (FMP) API client
// Uses the new /stable/ endpoints (post-Aug 2025 migration)
// Refactored to use shared fmp-fetch module
// ============================================================

import { StockMetrics } from "./types";
import { getUniverseSymbols } from "./index-constituents";
import { getSectorInfo } from "./sector-map";
import { getCached, setCache, clearCache } from "./fmp-cache";
import { fmpFetch, parallelBatchFetch, sleep } from "./fmp-fetch";

// Re-export clearCache for backwards compatibility
export { clearCache } from "./fmp-cache";

// ---- FMP API types (raw response shapes) ----

/** /stable/profile response */
export interface FmpScreenerResult {
  symbol: string;
  companyName: string;
  marketCap: number;
  sector: string;
  industry: string;
  price: number;
  lastAnnualDividend?: number;
  volume: number;
  exchangeShortName: string;
  country: string;
  isEtf: boolean;
  isActivelyTrading: boolean;
  beta?: number;
}

/** /stable/ratios-ttm response */
export interface FmpRatios {
  symbol?: string;
  peRatioTTM?: number;
  priceToBookRatioTTM?: number;
  pegRatioTTM?: number;
  priceToEarningsGrowthRatioTTM?: number;
  currentRatioTTM?: number;
  debtEquityRatioTTM?: number;
  debtToEquityRatioTTM?: number;
  dividendYieldTTM?: number;
  returnOnEquityTTM?: number;
  // FMP sometimes uses different key for ROE
  roeTTM?: number;
  freeCashFlowPerShareTTM?: number;
  priceToFreeCashFlowsRatioTTM?: number;
  priceToFreeCashFlowRatioTTM?: number;
  grossProfitMarginTTM?: number;
  netProfitMarginTTM?: number;
  priceToEarningsRatioTTM?: number;
  // Catch-all for any fields FMP returns that we haven't typed
  [key: string]: number | string | undefined;
}

/** /stable/key-metrics-ttm response */
export interface FmpKeyMetrics {
  symbol?: string;
  returnOnEquityTTM?: number;
  [key: string]: number | string | undefined;
}

/** /stable/financial-growth response */
export interface FmpGrowth {
  symbol?: string;
  revenueGrowth?: number;
  epsgrowth?: number;
  epsdilutedGrowth?: number;
  netIncomeGrowth?: number;
}

/** /stable/quote response */
export interface FmpTechnical {
  symbol?: string;
  priceAvg50?: number;
  priceAvg200?: number;
  yearHigh?: number;
  yearLow?: number;
  name?: string;
  price?: number;
  marketCap?: number;
  volume?: number;
  exchange?: string;
}

// ---- Public API ----

/**
 * Fetch the stock screener results from FMP.
 * Uses the /stable/profile endpoint with batch symbols.
 * For the free tier, we use NASDAQ-100 and S&P-500 constituent lists instead.
 * 
 * Optimized: fetches profiles in parallel batches instead of sequentially.
 */
export async function fetchScreenerStocks(
  params: {
    marketCapMoreThan?: number;
    marketCapLessThan?: number;
    sector?: string;
    limit?: number;
  } = {}
): Promise<FmpScreenerResult[]> {
  const cacheKey = `screener:${JSON.stringify(params)}`;
  const cached = getCached<FmpScreenerResult[]>(cacheKey);
  if (cached) return cached;

  // Use hardcoded NASDAQ-100 + S&P-500 constituent symbols
  const allSymbols = getUniverseSymbols();
  const limit = params.limit ?? 200;
  const symbols = allSymbols.slice(0, limit);

  // Fetch profiles in parallel batches (was sequential before)
  const profiles: FmpScreenerResult[] = [];
  const BATCH_SIZE = 10;

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, Math.min(i + BATCH_SIZE, symbols.length));
    const settled = await Promise.allSettled(
      batch.map(async (symbol) => {
        const profileCacheKey = `profile:${symbol}`;
        const cachedProfile = getCached<FmpScreenerResult>(profileCacheKey);
        if (cachedProfile) return cachedProfile;

        const data = await fmpFetch<Array<{
          symbol: string;
          companyName: string;
          marketCap: number;
          sector: string;
          industry: string;
          price: number;
          volume: number;
          exchange: string;
          country: string;
          isEtf: boolean;
          isActivelyTrading: boolean;
          beta?: number;
        }>>("/profile", { symbol }, { revalidate: 1800 });

        if (!data || data.length === 0) return null;
        const p = data[0];

        const entry: FmpScreenerResult = {
          symbol: p.symbol,
          companyName: p.companyName,
          marketCap: p.marketCap,
          sector: p.sector || "Unknown",
          industry: p.industry || "Unknown",
          price: p.price,
          volume: p.volume || 0,
          exchangeShortName: p.exchange || "US",
          country: p.country || "US",
          isEtf: p.isEtf ?? false,
          isActivelyTrading: p.isActivelyTrading ?? true,
          beta: p.beta,
        };
        setCache(profileCacheKey, entry);
        return entry;
      })
    );

    for (const r of settled) {
      if (r.status !== "fulfilled" || !r.value) continue;
      const entry = r.value;
      // Apply market cap filters
      if (params.marketCapMoreThan && entry.marketCap < params.marketCapMoreThan) continue;
      if (params.marketCapLessThan && entry.marketCap > params.marketCapLessThan) continue;
      if (params.sector && entry.sector !== params.sector) continue;
      profiles.push(entry);
    }

    // Throttle between batches
    if (i + BATCH_SIZE < symbols.length) {
      await sleep(500);
    }
  }

  setCache(cacheKey, profiles);
  return profiles;
}

/**
 * Fetch TTM financial ratios for a list of symbols.
 * Optimized: uses parallelBatchFetch instead of sequential loop.
 */
export async function fetchRatiosBatch(symbols: string[]): Promise<Map<string, FmpRatios>> {
  const { map } = await parallelBatchFetch<FmpRatios>(
    symbols,
    async (symbol) => {
      const cacheKey = `ratios:${symbol}`;
      const cached = getCached<FmpRatios>(cacheKey);
      if (cached) return { key: symbol, value: cached };

      const data = await fmpFetch<FmpRatios[]>("/ratios-ttm", { symbol });
      if (data && data.length > 0) {
        setCache(cacheKey, data[0]);
        return { key: symbol, value: data[0] };
      }
      return null;
    },
    { batchSize: 5, delayMs: 1000 }
  );
  return map;
}

/**
 * Fetch financial growth data (revenue, EPS) for a list of symbols.
 * Optimized: uses parallelBatchFetch instead of sequential loop.
 */
export async function fetchGrowthBatch(symbols: string[]): Promise<Map<string, FmpGrowth>> {
  const { map } = await parallelBatchFetch<FmpGrowth>(
    symbols,
    async (symbol) => {
      const cacheKey = `growth:${symbol}`;
      const cached = getCached<FmpGrowth>(cacheKey);
      if (cached) return { key: symbol, value: cached };

      const data = await fmpFetch<FmpGrowth[]>("/financial-growth", { symbol, limit: "1" });
      if (data && data.length > 0) {
        setCache(cacheKey, data[0]);
        return { key: symbol, value: data[0] };
      }
      return null;
    },
    { batchSize: 5, delayMs: 1000 }
  );
  return map;
}

/**
 * Fetch quote / technical data for symbols.
 * Optimized: uses parallelBatchFetch instead of manual batching.
 */
export async function fetchQuoteBatch(symbols: string[]): Promise<Map<string, FmpTechnical>> {
  if (symbols.length === 0) return new Map();

  const { map } = await parallelBatchFetch<FmpTechnical>(
    symbols,
    async (symbol) => {
      const cacheKey = `quote:${symbol}`;
      const cached = getCached<FmpTechnical>(cacheKey);
      if (cached) return { key: symbol, value: cached };

      const data = await fmpFetch<FmpTechnical[]>("/quote", { symbol });
      if (data && data.length > 0) {
        setCache(cacheKey, data[0]);
        return { key: symbol, value: data[0] };
      }
      return null;
    },
    { batchSize: 10, delayMs: 1000 }
  );
  return map;
}

/**
 * Build a full StockMetrics object by combining screener, ratios, growth, and quote data.
 */
/**
 * Safely convert a ratio value to a percentage, or return null.
 * Uses proper null check instead of truthy check (avoids 0 being treated as missing).
 */
function toPercent(value: number | undefined | null): number | null {
  return value != null ? value * 100 : null;
}

/** Get a numeric value, returning null only if truly missing */
function numOrNull(value: number | undefined | null): number | null {
  return value != null ? value : null;
}

export function buildStockMetrics(
  screener: FmpScreenerResult,
  ratios?: FmpRatios,
  growth?: FmpGrowth,
  quote?: FmpTechnical,
  keyMetrics?: FmpKeyMetrics
): StockMetrics {
  const price = screener.price || 0;
  const priceVs50 = quote?.priceAvg50 != null
    ? ((price - quote.priceAvg50) / quote.priceAvg50) * 100
    : null;
  const priceVs200 = quote?.priceAvg200 != null
    ? ((price - quote.priceAvg200) / quote.priceAvg200) * 100
    : null;

  // Calculate FCF yield from priceToFreeCashFlowsRatio
  const fcfRatio = ratios?.priceToFreeCashFlowsRatioTTM ?? ratios?.priceToFreeCashFlowRatioTTM;
  const fcfYield =
    fcfRatio != null && fcfRatio > 0
      ? (1 / fcfRatio) * 100
      : null;

  // Get P/E from either field name
  const pe = numOrNull(ratios?.peRatioTTM ?? ratios?.priceToEarningsRatioTTM);

  // Get PEG from either field name
  const peg = numOrNull(ratios?.pegRatioTTM ?? ratios?.priceToEarningsGrowthRatioTTM);

  // Get D/E from either field name
  const debtToEquity = numOrNull(ratios?.debtEquityRatioTTM ?? ratios?.debtToEquityRatioTTM);

  // Get ROE from keyMetrics if available, fallback to ratios
  const rawRoe = keyMetrics?.returnOnEquityTTM ?? ratios?.returnOnEquityTTM ?? ratios?.roeTTM;

  return {
    symbol: screener.symbol,
    companyName: screener.companyName,
    sector: screener.sector || "Unknown",
    industry: screener.industry || "Unknown",
    marketCap: screener.marketCap,
    price,
    peRatio: pe,
    pbRatio: numOrNull(ratios?.priceToBookRatioTTM),
    freeCashFlowYield: fcfYield,
    dividendYield: toPercent(ratios?.dividendYieldTTM),
    currentRatio: numOrNull(ratios?.currentRatioTTM),
    debtToEquity,
    revenueGrowthYoY: toPercent(growth?.revenueGrowth),
    epsGrowthYoY: toPercent(growth?.epsgrowth),
    pegRatio: peg,
    roe: toPercent(rawRoe),
    grossMargin: toPercent(ratios?.grossProfitMarginTTM),
    netMargin: toPercent(ratios?.netProfitMarginTTM),
    priceVs50SMA: priceVs50,
    priceVs200SMA: priceVs200,
    fiftyTwoWeekHigh: numOrNull(quote?.yearHigh),
    fiftyTwoWeekLow: numOrNull(quote?.yearLow),
    beta: numOrNull(screener.beta),
  };
}

/**
 * Fetch complete StockMetrics for a list of symbols not in the pool.
 * Used for Seeking Alpha custom list — fetches quote, ratios, growth, and key-metrics.
 * Results are cached for 30 minutes.
 */
export async function fetchOnDemandStocks(symbols: string[]): Promise<StockMetrics[]> {
  if (symbols.length === 0) return [];

  const results: StockMetrics[] = [];
  const BATCH = 5; // conservative parallelism for on-demand

  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, Math.min(i + BATCH, symbols.length));

    const settled = await Promise.allSettled(
      batch.map(async (symbol) => {
        // Check cache first
        const cacheKey = `ondemand:${symbol}`;
        const cached = getCached<StockMetrics>(cacheKey);
        if (cached) return cached;

        // Fetch all 4 endpoints in parallel
        const [quoteData, ratiosData, growthData, kmData] = await Promise.allSettled([
          fmpFetch<FmpTechnical[]>("/quote", { symbol }),
          fmpFetch<FmpRatios[]>("/ratios-ttm", { symbol }),
          fmpFetch<FmpGrowth[]>("/financial-growth", { symbol, limit: "1" }),
          fmpFetch<FmpKeyMetrics[]>("/key-metrics-ttm", { symbol, limit: "1" }),
        ]);

        const quote = quoteData.status === "fulfilled" ? quoteData.value?.[0] : undefined;
        const ratios = ratiosData.status === "fulfilled" ? ratiosData.value?.[0] : undefined;
        const growth = growthData.status === "fulfilled" ? growthData.value?.[0] : undefined;
        const km = kmData.status === "fulfilled" ? kmData.value?.[0] : undefined;

        if (!quote?.symbol) return null;

        // Try sector map first, then use "Unknown" (FMP quote doesn't include sector)
        const sectorInfo = getSectorInfo(quote.symbol || symbol);

        const screener: FmpScreenerResult = {
          symbol: quote.symbol || symbol,
          companyName: quote.name || symbol,
          marketCap: quote.marketCap || 0,
          sector: sectorInfo.sector,
          industry: sectorInfo.industry,
          price: quote.price || 0,
          volume: quote.volume || 0,
          exchangeShortName: quote.exchange || "US",
          country: "US",
          isEtf: false,
          isActivelyTrading: true,
        };

        const metrics = buildStockMetrics(screener, ratios, growth, quote, km);
        setCache(cacheKey, metrics);
        return metrics;
      })
    );

    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) {
        results.push(r.value);
      }
    }

    // Small delay between batches
    if (i + BATCH < symbols.length) {
      await sleep(500);
    }
  }

  return results;
}
