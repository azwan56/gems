// ============================================================
// Static sector/industry mapping for well-known stocks
// Used when FMP /quote doesn't return sector info
// ============================================================

const SECTOR_MAP: Record<string, { sector: string; industry: string }> = {
  // Mega-Cap Tech / Growth
  AAPL: { sector: "Technology", industry: "Consumer Electronics" },
  MSFT: { sector: "Technology", industry: "Software—Infrastructure" },
  AMZN: { sector: "Consumer Cyclical", industry: "Internet Retail" },
  NVDA: { sector: "Technology", industry: "Semiconductors" },
  META: { sector: "Technology", industry: "Internet Content & Information" },
  GOOGL: { sector: "Technology", industry: "Internet Content & Information" },
  AVGO: { sector: "Technology", industry: "Semiconductors" },
  TSLA: { sector: "Consumer Cyclical", industry: "Auto Manufacturers" },
  NFLX: { sector: "Communication Services", industry: "Entertainment" },
  ADBE: { sector: "Technology", industry: "Software—Application" },
  AMD: { sector: "Technology", industry: "Semiconductors" },
  CRM: { sector: "Technology", industry: "Software—Application" },
  ORCL: { sector: "Technology", industry: "Software—Infrastructure" },
  INTU: { sector: "Technology", industry: "Software—Application" },
  QCOM: { sector: "Technology", industry: "Semiconductors" },
  ISRG: { sector: "Healthcare", industry: "Medical Instruments" },
  AMAT: { sector: "Technology", industry: "Semiconductor Equipment" },
  PANW: { sector: "Technology", industry: "Software—Infrastructure" },
  CRWD: { sector: "Technology", industry: "Software—Infrastructure" },
  PLTR: { sector: "Technology", industry: "Software—Infrastructure" },
  ARM: { sector: "Technology", industry: "Semiconductors" },
  MELI: { sector: "Consumer Cyclical", industry: "Internet Retail" },
  BKNG: { sector: "Consumer Cyclical", industry: "Travel Services" },
  SNPS: { sector: "Technology", industry: "Software—Application" },
  CDNS: { sector: "Technology", industry: "Software—Application" },

  // Value / Dividend / Financials
  "BRK-B": { sector: "Financial Services", industry: "Insurance—Diversified" },
  JPM: { sector: "Financial Services", industry: "Banks—Diversified" },
  V: { sector: "Financial Services", industry: "Credit Services" },
  MA: { sector: "Financial Services", industry: "Credit Services" },
  BAC: { sector: "Financial Services", industry: "Banks—Diversified" },
  GS: { sector: "Financial Services", industry: "Capital Markets" },
  MS: { sector: "Financial Services", industry: "Capital Markets" },
  SCHW: { sector: "Financial Services", industry: "Capital Markets" },
  AXP: { sector: "Financial Services", industry: "Credit Services" },
  JNJ: { sector: "Healthcare", industry: "Drug Manufacturers" },
  PFE: { sector: "Healthcare", industry: "Drug Manufacturers" },
  ABBV: { sector: "Healthcare", industry: "Drug Manufacturers" },
  MRK: { sector: "Healthcare", industry: "Drug Manufacturers" },
  BMY: { sector: "Healthcare", industry: "Drug Manufacturers" },
  XOM: { sector: "Energy", industry: "Oil & Gas Integrated" },
  CVX: { sector: "Energy", industry: "Oil & Gas Integrated" },
  KO: { sector: "Consumer Defensive", industry: "Beverages" },
  PG: { sector: "Consumer Defensive", industry: "Household Products" },
  WMT: { sector: "Consumer Defensive", industry: "Discount Stores" },
  MCD: { sector: "Consumer Cyclical", industry: "Restaurants" },
  PM: { sector: "Consumer Defensive", industry: "Tobacco" },
  CL: { sector: "Consumer Defensive", industry: "Household Products" },
  GM: { sector: "Consumer Cyclical", industry: "Auto Manufacturers" },
  F: { sector: "Consumer Cyclical", industry: "Auto Manufacturers" },
  T: { sector: "Communication Services", industry: "Telecom Services" },

  // Mid/Large crossover
  LLY: { sector: "Healthcare", industry: "Drug Manufacturers" },
  UNH: { sector: "Healthcare", industry: "Healthcare Plans" },
  HD: { sector: "Consumer Cyclical", industry: "Home Improvement" },
  CAT: { sector: "Industrials", industry: "Farm & Heavy Construction" },
  DE: { sector: "Industrials", industry: "Farm & Heavy Construction" },
  GE: { sector: "Industrials", industry: "Specialty Industrial Machinery" },
  RTX: { sector: "Industrials", industry: "Aerospace & Defense" },
  BA: { sector: "Industrials", industry: "Aerospace & Defense" },
  LOW: { sector: "Consumer Cyclical", industry: "Home Improvement" },
  NKE: { sector: "Consumer Cyclical", industry: "Footwear & Accessories" },

  // Small/Mid-Cap Growth
  AXON: { sector: "Industrials", industry: "Aerospace & Defense" },
  DDOG: { sector: "Technology", industry: "Software—Application" },
  MDB: { sector: "Technology", industry: "Software—Infrastructure" },
  ZS: { sector: "Technology", industry: "Software—Infrastructure" },
  FTNT: { sector: "Technology", industry: "Software—Infrastructure" },
  COIN: { sector: "Financial Services", industry: "Financial Data" },
  HOOD: { sector: "Financial Services", industry: "Capital Markets" },
  APP: { sector: "Technology", industry: "Software—Application" },
  TTD: { sector: "Technology", industry: "Software—Application" },
  DASH: { sector: "Technology", industry: "Internet Content & Information" },
  SMCI: { sector: "Technology", industry: "Computer Hardware" },
  MSTR: { sector: "Technology", industry: "Software—Application" },
  CELH: { sector: "Consumer Defensive", industry: "Beverages" },
  DUOL: { sector: "Technology", industry: "Software—Application" },
  CAVA: { sector: "Consumer Cyclical", industry: "Restaurants" },
  SOUN: { sector: "Technology", industry: "Software—Application" },
  IONQ: { sector: "Technology", industry: "Computer Hardware" },
  RKLB: { sector: "Industrials", industry: "Aerospace & Defense" },
  JOBY: { sector: "Industrials", industry: "Aerospace & Defense" },
  SOFI: { sector: "Financial Services", industry: "Credit Services" },

  // Other common ones
  PYPL: { sector: "Financial Services", industry: "Credit Services" },
  INTC: { sector: "Technology", industry: "Semiconductors" },
  CSCO: { sector: "Technology", industry: "Communication Equipment" },
  DIS: { sector: "Communication Services", industry: "Entertainment" },
  VZ: { sector: "Communication Services", industry: "Telecom Services" },
  IBM: { sector: "Technology", industry: "Information Technology Services" },
  SIRI: { sector: "Communication Services", industry: "Broadcasting" },
};

/**
 * Look up sector & industry for a given symbol.
 * Returns { sector: "Unknown", industry: "Unknown" } if not found.
 */
export function getSectorInfo(symbol: string): { sector: string; industry: string } {
  return SECTOR_MAP[symbol.toUpperCase()] ?? { sector: "Unknown", industry: "Unknown" };
}
