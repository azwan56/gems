// ============================================================
// Universe Provider — dynamically builds the full stock universe
//
// Sources:
//   1. S&P 500 constituents (fetched live from FMP)
//   2. Russell Mid-Cap additions (static curated list)
//   3. Original curated list (fallback)
//
// Typical result: ~850-900 unique symbols
// ============================================================

import { FMP_STABLE_URL, getApiKey, hasApiKey } from "./fmp-config";
import { UNIVERSE as CURATED_UNIVERSE } from "./index-constituents";

// ---- Russell Mid-Cap / Small-Cap Growth ----
// Popular mid-cap stocks NOT typically in S&P 500
// Covering: tech, biotech, fintech, industrials, consumer
export const RUSSELL_MIDCAP_ADDITIONS: string[] = [
  // ---- Tech / SaaS ----
  "ESTC", "CFLT", "GTLB", "DOCN", "BRZE", "SAMSARA", "IOT", "TOST", "PCOR",
  "ASAN", "FROG", "TENB", "ALTR", "QLYS", "VRNS", "CYBR", "RPD", "FRSH",
  "MTTR", "PATH", "AI", "BBAI", "PRCT", "GENI", "INOD", "SEMR",
  "DT", "TWLO", "U", "ROKU", "LYFT", "ETSY", "CHWY", "W", "CVNA",

  // ---- Biotech / Pharma ----
  "EXAS", "PCVX", "IONS", "ALNY", "SRPT", "BMRN", "HALO", "RARE",
  "NBIX", "CRNX", "RVMD", "KRTX", "ADMA", "CORT", "INCY", "EXEL",
  "ITCI", "LEGN", "NTRA", "TWST", "CRSP", "NTLA", "BEAM", "EDIT",
  "ARWR", "FATE", "SGEN", "MGNX", "XNCR", "APLS", "RCKT",

  // ---- Fintech / Financial ----
  "LPLA", "IBKR", "MKTX", "CBOE", "NDAQ", "FDS", "MSCI", "SPGI",
  "TRMB", "WEX", "EVTC", "FOUR", "PAGS", "STNE", "LMND", "ROOT",
  "OPEN", "RDFN", "CARG",

  // ---- Industrials / Aerospace / Defense ----
  "HEI", "TDG", "HWM", "BWXT", "KTOS", "AVAV", "KRTOS", "ACHR",
  "ASTS", "RDW", "LUNR", "IRDM", "SWBI", "RGR", "TXT",
  "XPO", "ODFL", "SAIA", "CHRW", "JBHT", "EXPD", "GXO",

  // ---- Consumer / Retail / Food ----
  "DPZ", "WING", "JACK", "SHAK", "BROS", "DNUT", "EAT", "TXRH",
  "DRI", "WINGSTOP", "LULU", "DECK", "ON", "CROX", "BIRK", "SKX",
  "ELF", "COTY", "HIMS", "MNST", "SAM", "BJ", "OLLI", "FIVE",
  "RH", "WSM", "ARHS", "TPX", "LEVI",

  // ---- Energy / Commodities ----
  "FANG", "PR", "CTRA", "DVN", "MPC", "PSX", "VLO", "DINO",
  "OXY", "HAL", "BKR", "TRGP", "OKE", "WMB", "KMI",
  "FCX", "NEM", "GOLD", "AEM", "WPM", "FNV",

  // ---- Healthcare Services / MedTech ----
  "VEEV", "DOCS", "GDRX", "OSCR", "ACCD", "SDGR", "RXRX",
  "TEM", "RPRX", "GH", "NVCR", "NVST", "ALGN", "HOLX", "IART",
  "PODD", "DXCM", "TNDM", "INSP",

  // ---- REITs / Real Estate ----
  "AMT", "CCI", "EQIX", "DLR", "PSA", "SPG", "O", "VICI",
  "WELL", "ARE", "EXR", "AVB", "EQR", "MAA", "ESS", "UDR",
  "INVH", "SUI", "REXR", "COLD",

  // ---- Utilities / Clean Energy ----
  "ENPH", "SEDG", "FSLR", "RUN", "NOVA", "ARRY", "MAXN",
  "VST", "CEG", "TLN", "NRG", "AES", "ES", "WEC", "CMS", "LNT",

  // ---- Media / Entertainment / Gaming ----
  "TTWO", "EA", "DKNG", "PENN", "MGM", "CZR", "WYNN", "LVS",
  "LYV", "IMAX", "SIRI", "PARA", "WBD", "FOX", "NWSA",

  // ---- Telecom / Infrastructure ----
  "TMUS", "LUMN", "FTR", "USM", "ATUS", "CHTR", "CABO",

  // ---- China ADR / International ----
  "BABA", "JD", "PDD", "BIDU", "NIO", "XPEV", "LI", "TME",
  "BILI", "IQ", "VNET", "ZTO", "MNSO", "FUTU", "TIGR",
  "SE", "GRAB", "CPNG",

  // ---- Crypto / Blockchain ----
  "MARA", "RIOT", "CLSK", "HUT", "BITF", "BTDR",

  // ---- Misc Growth / Disruptors ----
  "TSEM", "GFS", "WOLF", "ACLS", "MKSI", "ENTG", "TER", "LSCC",
  "MPWR", "RMBS", "SWKS", "QRVO", "MTSI", "CRUS",
  "GLOB", "EPAM", "TASK", "TTEC", "PAYC", "ADP", "PAYX",
  "GDDY", "SQSP", "WFRD", "OWL", "ARES", "BAM", "APO", "KKR", "CG",
  "TPG", "STEP", "HLNE",
];

/**
 * Fetch index constituents from fallback source (yfiua.github.io/index-constituents CSVs).
 * Used when FMP API key does not have subscription permissions for index constituents.
 */
async function fetchIndexConstituentsFromFallback(index: "sp500" | "nasdaq"): Promise<string[]> {
  try {
    const url = index === "sp500"
      ? "https://yfiua.github.io/index-constituents/constituents-sp500.csv"
      : "https://yfiua.github.io/index-constituents/constituents-nasdaq100.csv";

    console.log(`[universe] Fetching ${index.toUpperCase()} constituents from fallback source: ${url}`);
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[universe] Fallback fetch failed for ${index}: ${res.status}`);
      return [];
    }

    const text = await res.text();
    const lines = text.split(/\r?\n/);
    const symbols: string[] = [];

    // Skip CSV header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(",");
      let symbol = parts[0]?.trim()?.toUpperCase();
      if (symbol) {
        // Normalize class shares notation (e.g. BRK.B -> BRK-B) for FMP API compatibility
        symbol = symbol.replace(".", "-");
        if (/^[A-Z-]+$/.test(symbol)) {
          symbols.push(symbol);
        }
      }
    }

    console.log(`[universe] Fetched ${symbols.length} ${index.toUpperCase()} constituents from fallback`);
    return symbols;
  } catch (err) {
    console.warn(`[universe] Error fetching ${index} from fallback:`, err);
    return [];
  }
}

/**
 * Fetch index constituents from FMP API.
 * Supports: sp500-constituent, nasdaq-constituent
 * Returns an array of symbol strings, or falls back to public datasets on failure.
 */
async function fetchIndexConstituents(index: "sp500" | "nasdaq"): Promise<string[]> {
  let symbols: string[] = [];

  if (hasApiKey()) {
    try {
      const url = `${FMP_STABLE_URL}/${index}-constituent?apikey=${getApiKey()}`;
      const res = await fetch(url);
      if (res.ok) {
        const data: Array<{ symbol: string }> = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          symbols = data
            .map((d) => d.symbol?.toUpperCase())
            .filter((s): s is string => !!s)
            .map((s) => s.replace(".", "-"));
          console.log(`[universe] Fetched ${symbols.length} ${index.toUpperCase()} constituents from FMP`);
        }
      } else {
        console.warn(`[universe] FMP fetch failed for ${index} (${res.status}), trying fallback...`);
      }
    } catch (err) {
      console.warn(`[universe] FMP fetch error for ${index}, trying fallback...`, err);
    }
  }

  // Fallback if FMP returned nothing (free/restricted key)
  if (symbols.length === 0) {
    symbols = await fetchIndexConstituentsFromFallback(index);
  }

  return symbols;
}

let cachedUniverse: string[] | null = null;
let universeCacheExpiry = 0;
const UNIVERSE_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Build the full stock universe by merging:
 *   1. S&P 500 (dynamic from FMP)
 *   2. NASDAQ 100 (dynamic from FMP)
 *   3. Russell Mid-Cap additions (static)
 *   4. Original curated list (ensures no regressions)
 *
 * Deduplicates and returns sorted array.
 */
export async function buildFullUniverse(): Promise<string[]> {
  const now = Date.now();
  if (cachedUniverse && now < universeCacheExpiry) {
    console.log(`[universe] Serving cached universe of ${cachedUniverse.length} symbols`);
    return cachedUniverse;
  }

  const allSymbols = new Set<string>();

  // 1. Fetch S&P 500 and NASDAQ 100 in parallel (2 API calls)
  const [sp500, nasdaq] = await Promise.all([
    fetchIndexConstituents("sp500"),
    fetchIndexConstituents("nasdaq"),
  ]);
  sp500.forEach((s) => allSymbols.add(s));
  nasdaq.forEach((s) => allSymbols.add(s));

  // 2. Add Russell Mid-Cap additions
  RUSSELL_MIDCAP_ADDITIONS.forEach((s) => allSymbols.add(s.toUpperCase()));

  // 3. Ensure original curated universe is included (no regressions)
  CURATED_UNIVERSE.forEach((s) => allSymbols.add(s.toUpperCase()));

  const universe = Array.from(allSymbols).sort();
  console.log(
    `[universe] Full universe: ${universe.length} unique symbols ` +
    `(S&P500=${sp500.length}, NASDAQ=${nasdaq.length}, Russell=${RUSSELL_MIDCAP_ADDITIONS.length}, curated=${CURATED_UNIVERSE.length})`
  );

  cachedUniverse = universe;
  universeCacheExpiry = now + UNIVERSE_CACHE_TTL_MS;
  return universe;
}

/**
 * Split the universe into N roughly equal chunks.
 * Used by the cron jobs to process in parallel across multiple invocations.
 */
export function chunkUniverse(symbols: string[], totalChunks: number, chunkIndex: number): string[] {
  const chunkSize = Math.ceil(symbols.length / totalChunks);
  const start = chunkIndex * chunkSize;
  const end = Math.min(start + chunkSize, symbols.length);
  return symbols.slice(start, end);
}
