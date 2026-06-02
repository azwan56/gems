// ============================================================
// FMP data fetcher for the Rebalancing Early Warning Engine
// Fetches historical prices and index constituent lists
// ============================================================

import { fmpFetch, parallelBatchFetch } from "./fmp-fetch";

export interface HistoricalPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number;
  volume: number;
  unadjustedVolume: number;
  change: number;
  changePercent: number;
  vwap: number;
  label: string;
  changeOverTime: number;
}

export interface HistoricalPriceResponse {
  symbol: string;
  historical: HistoricalPrice[];
}

export interface Constituent {
  symbol: string;
  name: string;
  sector: string;
  subSector: string;
  headQuarter: string;
  dateFirstAdded: string;
  cik: string;
  founded: string;
}

/**
 * Fetch historical end-of-day prices for a symbol between two dates.
 * Uses the /stable/historical-price-eod/full endpoint.
 *
 * NOTE: The stable API returns a flat array of price records,
 * NOT the legacy {symbol, historical: [...]} wrapper.
 */
export async function fetchHistoricalPrices(
  symbol: string,
  fromDate: string,
  toDate: string
): Promise<HistoricalPrice[]> {
  try {
    // Stable API returns HistoricalPrice[] directly (flat array)
    const data = await fmpFetch<HistoricalPrice[] | HistoricalPriceResponse>(
      "/historical-price-eod/full",
      {
        symbol,
        from: fromDate,
        to: toDate,
      },
      { revalidate: 3600 } // Cache for 1 hour
    );
    
    // Handle both formats: flat array (stable) and wrapped (legacy)
    if (Array.isArray(data)) {
      return data;
    }
    return data?.historical || [];
  } catch (error) {
    console.error(`[FMP] Error fetching historical prices for ${symbol}:`, error);
    return [];
  }
}

/**
 * Fetch historical prices for a batch of symbols in parallel.
 * Reuses the parallelBatchFetch logic from fmp-fetch to handle rate limits.
 */
export async function batchFetchConstituentPrices(
  symbols: string[],
  fromDate: string,
  toDate: string
): Promise<Map<string, HistoricalPrice[]>> {
  const { map } = await parallelBatchFetch<HistoricalPrice[]>(
    symbols,
    async (symbol) => {
      const prices = await fetchHistoricalPrices(symbol, fromDate, toDate);
      if (prices && prices.length > 0) {
        return { key: symbol, value: prices };
      }
      return null;
    },
    { batchSize: 25, delayMs: 5000 } // 25 calls every 5s = 5 calls/s = 300/min limit
  );
  return map;
}

/**
 * Fetch the current constituent list for an index.
 * Uses the /stable/sp500-constituent or /stable/nasdaq-constituent endpoint.
 */
export async function fetchIndexConstituents(
  index: "sp500" | "nasdaq100"
): Promise<Constituent[]> {
  const endpoint = index === "sp500" ? "/sp500-constituent" : "/nasdaq-constituent";
  try {
    const data = await fmpFetch<Constituent[]>(
      endpoint,
      {},
      { revalidate: 86400 } // Cache for 24 hours
    );
    if (data && data.length > 0) return data;
    // API returned empty — use fallback
    console.warn(`[FMP] Constituent API returned empty for ${index}, using fallback list.`);
    return index === "nasdaq100" ? NASDAQ_100_FALLBACK : [];
  } catch (error) {
    console.warn(`[FMP] Constituent API unavailable for ${index}, using fallback list.`);
    return index === "nasdaq100" ? NASDAQ_100_FALLBACK : [];
  }
}

/**
 * Hardcoded NASDAQ-100 symbols as fallback when the constituent API
 * is restricted (402) on lower-tier FMP plans.
 * Updated: June 2026.
 */
const NASDAQ_100_FALLBACK: Constituent[] = [
  "AAPL","MSFT","NVDA","AMZN","META","GOOGL","GOOG","AVGO","TSLA","COST",
  "NFLX","TMUS","AMD","PEP","ADBE","LIN","CSCO","QCOM","ISRG","TXN",
  "INTU","AMGN","CMCSA","BKNG","AMAT","HON","PANW","MU","ADP","LRCX",
  "VRTX","ADI","SBUX","GILD","KLAC","REGN","MDLZ","MELI","SNPS","CDNS",
  "PYPL","CRWD","CTAS","MAR","MRVL","ABNB","ORLY","MNST","FTNT","DASH",
  "WDAY","CEG","CHTR","PCAR","KDP","NXPI","AEP","CPRT","ODFL","PAYX",
  "TEAM","FAST","ROST","EA","KHC","DDOG","VRSK","BKR","CTSH","EXC",
  "FANG","IDXX","GEHC","XEL","MCHP","CCEP","DXCM","TTWO","ANSS","ZS",
  "CSGP","ON","CDW","TTD","GFS","ILMN","WBD","BIIB","MRNA","DLTR",
  "MDB","SMCI","ARM","LULU","SPLK","SIRI","AZN","PDD","COIN","LCID",
].map(symbol => ({
  symbol,
  name: "",
  sector: "",
  subSector: "",
  headQuarter: "",
  dateFirstAdded: "",
  cik: "",
  founded: "",
}));
