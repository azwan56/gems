// ============================================================
// Hardcoded index constituents for free-tier FMP usage
// NASDAQ-100 + S&P-500 top holdings (deduplicated)
// ============================================================

/** NASDAQ-100 constituent symbols (as of 2025) */
export const NASDAQ_100: string[] = [
  "AAPL", "MSFT", "AMZN", "NVDA", "META", "GOOGL", "GOOG", "AVGO", "TSLA", "COST",
  "NFLX", "ADBE", "AMD", "PEP", "LIN", "CSCO", "QCOM", "INTU", "TXN", "AMGN",
  "ISRG", "AMAT", "BKNG", "HON", "SBUX", "VRTX", "LRCX", "ADI", "MDLZ", "MU",
  "GILD", "REGN", "PANW", "KLAC", "ADP", "SNPS", "CDNS", "MELI", "CRWD", "CTAS",
  "MAR", "CSX", "ABNB", "PYPL", "ORLY", "NXPI", "CEG", "MNST", "PCAR", "ROP",
  "CPRT", "WDAY", "MRVL", "DASH", "ROST", "FTNT", "AEP", "PAYX", "DXCM", "FAST",
  "ODFL", "KDP", "TTD", "CTSH", "VRSK", "FANG", "EA", "GEHC", "BKR", "LULU",
  "EXC", "XEL", "IDXX", "ON", "KHC", "CSGP", "CCEP", "ANSS", "TEAM", "DDOG",
  "CDW", "BIIB", "ZS", "GFS", "ILMN", "MDB", "WBD", "MRNA", "LCID", "SIRI",
  "ARM", "SMCI", "APP", "PLTR", "COIN", "MSTR", "HOOD", "AXON", "TTWO", "CHTR",
];

/** S&P-500 additional high-cap symbols not in NASDAQ-100 */
export const SP500_EXTRA: string[] = [
  "BRK-B", "JPM", "JNJ", "V", "PG", "UNH", "HD", "MA", "XOM", "CVX",
  "LLY", "ABBV", "MRK", "BAC", "KO", "WMT", "PFE", "TMO", "ORCL", "DIS",
  "ABT", "DHR", "CRM", "ACN", "NKE", "WFC", "MCD", "PM", "NEE", "BMY",
  "RTX", "UPS", "SPGI", "LOW", "MS", "BLK", "GS", "DE", "MDT", "CAT",
  "SCHW", "SYK", "AXP", "AMT", "CI", "CB", "PLD", "SO", "DUK", "CL",
  "GM", "F", "BA", "GE", "MMM", "IBM", "INTC", "T", "VZ", "MO",
];

/** All symbols in our universe (deduplicated) */
export function getUniverseSymbols(): string[] {
  return [...new Set([...NASDAQ_100, ...SP500_EXTRA])];
}
