// ============================================================
// Hardcoded index constituents for FMP Starter tier
// ~150 stocks across value, growth, small-cap, and dividends
// Starter tier: 10,000 calls/day → 150×4 = 600 calls per refresh
// ============================================================

/**
 * Core universe: ~150 high-quality stocks covering all 3 strategies.
 *
 * Large-Cap Growth (MC > $100B):
 *   Tech mega-caps, AI plays, healthcare leaders
 *
 * Value / Dividend (low P/E, high FCF):
 *   Financials, energy, pharma, consumer staples, industrials
 *
 * Mid/Large Crossover:
 *   Industrials, healthcare, consumer discretionary
 *
 * Small/Mid-Cap Growth (MC $1B–$50B):
 *   Disruptive tech, high-growth SaaS, quantum, AI, fintech
 */
export const UNIVERSE: string[] = [
  // ---- Mega-Cap Tech / Growth (30) ----
  "AAPL", "MSFT", "AMZN", "NVDA", "META", "GOOGL", "AVGO", "TSLA",
  "NFLX", "ADBE", "AMD", "CRM", "ORCL", "INTU", "QCOM",
  "ISRG", "AMAT", "PANW", "CRWD", "PLTR",
  "ARM", "MELI", "BKNG", "SNPS", "CDNS",
  "NOW", "UBER", "SHOP", "SQ", "SNOW",

  // ---- Value / Dividend / Financials (35) ----
  "BRK-B", "JPM", "V", "MA", "BAC", "GS", "MS", "SCHW", "AXP",
  "JNJ", "PFE", "ABBV", "MRK", "BMY",
  "XOM", "CVX", "COP", "SLB", "EOG",
  "KO", "PG", "WMT", "MCD", "PM", "CL",
  "GM", "F", "T", "VZ",
  "BLK", "C", "WFC", "USB", "PNC", "TFC",

  // ---- Mid/Large Crossover (25) ----
  "LLY", "UNH", "HD", "CAT", "DE",
  "GE", "RTX", "BA", "LOW", "NKE",
  "COST", "TGT", "SBUX", "CMG", "YUM",
  "NEE", "DUK", "SO", "AEP", "D",
  "MMM", "HON", "UPS", "FDX", "LMT",

  // ---- Healthcare / Biotech (15) ----
  "TMO", "DHR", "ABT", "AMGN", "GILD",
  "VRTX", "REGN", "MRNA", "BIIB", "ZTS",
  "MDT", "EW", "SYK", "BSX", "HCA",

  // ---- Tech / SaaS / Semis (20) ----
  "MRVL", "MU", "LRCX", "KLAC", "TXN",
  "PYPL", "INTC", "CSCO", "IBM", "ACN",
  "NET", "TEAM", "WDAY", "ZM", "VEEV",
  "HUBS", "DOCU", "MNDY", "OKTA", "BILL",

  // ---- Small/Mid-Cap Growth (25) ----
  "AXON", "DDOG", "MDB", "ZS", "FTNT",
  "COIN", "HOOD", "APP", "TTD", "DASH",
  "SMCI", "MSTR", "CELH", "DUOL", "CAVA",
  "SOUN", "IONQ", "RKLB", "JOBY", "SOFI",
  "UPST", "AFRM", "RIVN", "LCID", "RBLX",

  // ---- Media / Communication / Other (5) ----
  "DIS", "CMCSA", "ABNB", "SPOT", "PINS",
];

/** All symbols in our universe (deduplicated) */
export function getUniverseSymbols(): string[] {
  return [...new Set(UNIVERSE)];
}
