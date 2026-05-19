// ============================================================
// Hardcoded index constituents for free-tier FMP usage
// Curated 60 stocks across value, growth, and small-cap
// to fit within 250 API calls/day (60×4 endpoints = 240 calls)
// ============================================================

/**
 * Core universe: 60 high-quality stocks covering all 3 strategies.
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
  // ---- Mega-Cap Tech / Growth (20) ----
  "AAPL", "MSFT", "AMZN", "NVDA", "META", "GOOGL", "AVGO", "TSLA",
  "NFLX", "ADBE", "AMD", "CRM", "ORCL", "INTU", "QCOM",
  "ISRG", "AMAT", "PANW", "CRWD", "PLTR",

  // ---- Value / Dividend / Financials (20) ----
  "BRK-B", "JPM", "V", "MA", "BAC", "GS", "MS", "AXP",
  "JNJ", "PFE", "ABBV", "MRK", 
  "XOM", "CVX",
  "KO", "PG", "WMT", "MCD", "PM", "T",

  // ---- Mid/Large crossover (5) ----
  "LLY", "UNH", "HD", "CAT", "LOW",

  // ---- Small/Mid-Cap Growth (15) ----
  "AXON", "DDOG", "MDB", "ZS", "FTNT",
  "COIN", "HOOD", "APP", "TTD", "SMCI", 
  "CELH", "DUOL", "CAVA", "SOUN", "IONQ",
];

/** All symbols in our universe (deduplicated) */
export function getUniverseSymbols(): string[] {
  return [...new Set(UNIVERSE)];
}
