// ============================================================
// Financial Modeling Prep (FMP) API client
// Uses the new /stable/ endpoints (post-Aug 2025 migration)
// ============================================================

import { StockMetrics } from "./types";
import { getUniverseSymbols } from "./index-constituents";

const FMP_STABLE_URL = "https://financialmodelingprep.com/stable";

function getApiKey(): string {
  const key = process.env.FMP_API_KEY;
  if (!key) {
    throw new Error("FMP_API_KEY environment variable is not set");
  }
  return key;
}

// ---- In-memory cache with TTL ----
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/** Clears all cached data */
export function clearCache(): void {
  cache.clear();
}

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

// ---- Fetch helpers ----
async function fmpFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${FMP_STABLE_URL}${endpoint}`);
  url.searchParams.set("apikey", getApiKey());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), { next: { revalidate: 1800 } });
  if (!res.ok) {
    throw new Error(`FMP API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ---- Public API ----

/**
 * Fetch the stock screener results from FMP.
 * Uses the /stable/profile endpoint with batch symbols, or /stable/stock-screener if available.
 * For the free tier, we use NASDAQ-100 and S&P-500 constituent lists instead.
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

  // Fetch profiles one symbol at a time (free tier only supports single-symbol profile)
  const profiles: FmpScreenerResult[] = [];
  for (const symbol of symbols) {
    const profileCacheKey = `profile:${symbol}`;
    const cachedProfile = getCached<FmpScreenerResult>(profileCacheKey);
    if (cachedProfile) {
      // Apply market cap filters
      if (params.marketCapMoreThan && cachedProfile.marketCap < params.marketCapMoreThan) continue;
      if (params.marketCapLessThan && cachedProfile.marketCap > params.marketCapLessThan) continue;
      if (params.sector && cachedProfile.sector !== params.sector) continue;
      profiles.push(cachedProfile);
      continue;
    }
    try {
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
      }>>("/profile", { symbol });

      if (!data || data.length === 0) continue;
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
      };
      setCache(profileCacheKey, entry);

      // Apply market cap filters
      if (params.marketCapMoreThan && entry.marketCap < params.marketCapMoreThan) continue;
      if (params.marketCapLessThan && entry.marketCap > params.marketCapLessThan) continue;
      if (params.sector && entry.sector !== params.sector) continue;
      profiles.push(entry);
    } catch {
      // Skip failed fetches
    }
  }

  setCache(cacheKey, profiles);
  return profiles;
}

/**
 * Fetch TTM financial ratios for a list of symbols.
 */
export async function fetchRatiosBatch(symbols: string[]): Promise<Map<string, FmpRatios>> {
  const result = new Map<string, FmpRatios>();
  // FMP stable supports single symbol per ratios-ttm call
  const batchSize = 5;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    for (const symbol of batch) {
      const cacheKey = `ratios:${symbol}`;
      const cached = getCached<FmpRatios>(cacheKey);
      if (cached) {
        result.set(symbol, cached);
        continue;
      }
      try {
        const data = await fmpFetch<FmpRatios[]>("/ratios-ttm", { symbol });
        if (data && data.length > 0) {
          setCache(cacheKey, data[0]);
          result.set(symbol, data[0]);
        }
      } catch {
        // Skip failed fetches
      }
    }
  }
  return result;
}

/**
 * Fetch financial growth data (revenue, EPS) for a list of symbols.
 */
export async function fetchGrowthBatch(symbols: string[]): Promise<Map<string, FmpGrowth>> {
  const result = new Map<string, FmpGrowth>();
  for (const symbol of symbols) {
    const cacheKey = `growth:${symbol}`;
    const cached = getCached<FmpGrowth>(cacheKey);
    if (cached) {
      result.set(symbol, cached);
      continue;
    }
    try {
      const data = await fmpFetch<FmpGrowth[]>("/financial-growth", { symbol, limit: "1" });
      if (data && data.length > 0) {
        setCache(cacheKey, data[0]);
        result.set(symbol, data[0]);
      }
    } catch {
      // Skip failed fetches
    }
  }
  return result;
}

/**
 * Fetch quote / technical data for symbols.
 */
export async function fetchQuoteBatch(symbols: string[]): Promise<Map<string, FmpTechnical>> {
  const result = new Map<string, FmpTechnical>();
  if (symbols.length === 0) return result;

  const cacheKey = `quote:${symbols.sort().join(",")}`;
  const cached = getCached<FmpTechnical[]>(cacheKey);
  if (cached) {
    for (const q of cached) {
      if (q.symbol) result.set(q.symbol, q);
    }
    return result;
  }

  // The /stable/quote endpoint supports comma-separated symbols
  const symbolStr = symbols.join(",");
  try {
    const data = await fmpFetch<FmpTechnical[]>("/quote", { symbol: symbolStr });
    setCache(cacheKey, data);
    for (const q of data) {
      if (q.symbol) result.set(q.symbol, q);
    }
  } catch {
    // Return empty on failure
  }
  return result;
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
  };
}
