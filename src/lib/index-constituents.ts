// ============================================================
// Hardcoded index constituents for free-tier FMP usage
// Curated ~80 stocks across value, growth, and small-cap
// to fit within 250 API calls/day (80×3 endpoints = 240 calls)
// ============================================================

/**
 * Core universe: ~80 high-quality stocks covering all 3 strategies.
 *
 * Large-Cap Growth candidates (MC > $100B):
 *   Tech mega-caps, AI plays, healthcare leaders
 *
 * Value candidates (low P/E, high FCF):
 *   Financials, energy, pharma, consumer staples
 *
 * Small/Mid-Cap Growth (MC $300M-$10B):
 *   Disruptive tech, high-growth SaaS, quantum, AI
 */
export const UNIVERSE: string[] = [
  // ---- Mega-Cap Tech / Growth (top 25) ----
  "AAPL", "MSFT", "AMZN", "NVDA", "META", "GOOGL", "AVGO", "TSLA",
  "NFLX", "ADBE", "AMD", "CRM", "ORCL", "INTU", "QCOM",
  "ISRG", "AMAT", "PANW", "CRWD", "PLTR",
  "ARM", "MELI", "BKNG", "SNPS", "CDNS",

  // ---- Value / Dividend / Financials (25) ----
  "BRK-B", "JPM", "V", "MA", "BAC", "GS", "MS", "SCHW", "AXP",
  "JNJ", "PFE", "ABBV", "MRK", "BMY",
  "XOM", "CVX",
  "KO", "PG", "WMT", "MCD", "PM", "CL",
  "GM", "F", "T",

  // ---- Mid/Large crossover (10) ----
  "LLY", "UNH", "HD", "CAT", "DE",
  "GE", "RTX", "BA", "LOW", "NKE",

  // ---- Small/Mid-Cap Growth (20) ----
  "AXON", "DDOG", "MDB", "ZS", "FTNT",
  "COIN", "HOOD", "APP", "TTD", "DASH",
  "SMCI", "MSTR", "CELH", "DUOL", "CAVA",
  "SOUN", "IONQ", "RKLB", "JOBY", "SOFI",
];

/** All symbols in our universe (deduplicated) */
export function getUniverseSymbols(): string[] {
  return [...new Set(UNIVERSE)];
}
