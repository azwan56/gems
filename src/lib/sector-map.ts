// ============================================================
// Static sector/industry mapping for well-known stocks
// Used when FMP /quote doesn't return sector info
// ============================================================

const SECTOR_MAP: Record<string, { sector: string; industry: string }> = {
  // ---- Mega-Cap Tech / Growth ----
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
  NOW: { sector: "Technology", industry: "Software—Application" },
  UBER: { sector: "Technology", industry: "Software—Application" },
  SHOP: { sector: "Technology", industry: "Software—Application" },
  SQ: { sector: "Financial Services", industry: "Software—Infrastructure" },
  SNOW: { sector: "Technology", industry: "Software—Application" },

  // ---- Value / Dividend / Financials ----
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
  COP: { sector: "Energy", industry: "Oil & Gas E&P" },
  SLB: { sector: "Energy", industry: "Oil & Gas Equipment" },
  EOG: { sector: "Energy", industry: "Oil & Gas E&P" },
  KO: { sector: "Consumer Defensive", industry: "Beverages" },
  PG: { sector: "Consumer Defensive", industry: "Household Products" },
  WMT: { sector: "Consumer Defensive", industry: "Discount Stores" },
  MCD: { sector: "Consumer Cyclical", industry: "Restaurants" },
  PM: { sector: "Consumer Defensive", industry: "Tobacco" },
  CL: { sector: "Consumer Defensive", industry: "Household Products" },
  GM: { sector: "Consumer Cyclical", industry: "Auto Manufacturers" },
  F: { sector: "Consumer Cyclical", industry: "Auto Manufacturers" },
  T: { sector: "Communication Services", industry: "Telecom Services" },
  VZ: { sector: "Communication Services", industry: "Telecom Services" },
  BLK: { sector: "Financial Services", industry: "Asset Management" },
  C: { sector: "Financial Services", industry: "Banks—Diversified" },
  WFC: { sector: "Financial Services", industry: "Banks—Diversified" },
  USB: { sector: "Financial Services", industry: "Banks—Regional" },
  PNC: { sector: "Financial Services", industry: "Banks—Regional" },
  TFC: { sector: "Financial Services", industry: "Banks—Regional" },

  // ---- Mid/Large Crossover ----
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
  COST: { sector: "Consumer Defensive", industry: "Discount Stores" },
  TGT: { sector: "Consumer Defensive", industry: "Discount Stores" },
  SBUX: { sector: "Consumer Cyclical", industry: "Restaurants" },
  CMG: { sector: "Consumer Cyclical", industry: "Restaurants" },
  YUM: { sector: "Consumer Cyclical", industry: "Restaurants" },
  NEE: { sector: "Utilities", industry: "Utilities—Regulated Electric" },
  DUK: { sector: "Utilities", industry: "Utilities—Regulated Electric" },
  SO: { sector: "Utilities", industry: "Utilities—Regulated Electric" },
  AEP: { sector: "Utilities", industry: "Utilities—Regulated Electric" },
  D: { sector: "Utilities", industry: "Utilities—Regulated Electric" },
  MMM: { sector: "Industrials", industry: "Conglomerates" },
  HON: { sector: "Industrials", industry: "Conglomerates" },
  UPS: { sector: "Industrials", industry: "Integrated Freight" },
  FDX: { sector: "Industrials", industry: "Integrated Freight" },
  LMT: { sector: "Industrials", industry: "Aerospace & Defense" },

  // ---- Healthcare / Biotech ----
  TMO: { sector: "Healthcare", industry: "Diagnostics & Research" },
  DHR: { sector: "Healthcare", industry: "Diagnostics & Research" },
  ABT: { sector: "Healthcare", industry: "Medical Devices" },
  AMGN: { sector: "Healthcare", industry: "Drug Manufacturers" },
  GILD: { sector: "Healthcare", industry: "Drug Manufacturers" },
  VRTX: { sector: "Healthcare", industry: "Drug Manufacturers" },
  REGN: { sector: "Healthcare", industry: "Drug Manufacturers" },
  MRNA: { sector: "Healthcare", industry: "Drug Manufacturers" },
  BIIB: { sector: "Healthcare", industry: "Drug Manufacturers" },
  ZTS: { sector: "Healthcare", industry: "Drug Manufacturers" },
  MDT: { sector: "Healthcare", industry: "Medical Devices" },
  EW: { sector: "Healthcare", industry: "Medical Devices" },
  SYK: { sector: "Healthcare", industry: "Medical Devices" },
  BSX: { sector: "Healthcare", industry: "Medical Devices" },
  HCA: { sector: "Healthcare", industry: "Medical Care Facilities" },

  // ---- Tech / SaaS / Semis ----
  MRVL: { sector: "Technology", industry: "Semiconductors" },
  MU: { sector: "Technology", industry: "Semiconductors" },
  LRCX: { sector: "Technology", industry: "Semiconductor Equipment" },
  KLAC: { sector: "Technology", industry: "Semiconductor Equipment" },
  TXN: { sector: "Technology", industry: "Semiconductors" },
  PYPL: { sector: "Financial Services", industry: "Credit Services" },
  INTC: { sector: "Technology", industry: "Semiconductors" },
  CSCO: { sector: "Technology", industry: "Communication Equipment" },
  IBM: { sector: "Technology", industry: "Information Technology Services" },
  ACN: { sector: "Technology", industry: "Information Technology Services" },
  NET: { sector: "Technology", industry: "Software—Infrastructure" },
  TEAM: { sector: "Technology", industry: "Software—Application" },
  WDAY: { sector: "Technology", industry: "Software—Application" },
  ZM: { sector: "Technology", industry: "Software—Application" },
  VEEV: { sector: "Technology", industry: "Software—Application" },
  HUBS: { sector: "Technology", industry: "Software—Application" },
  DOCU: { sector: "Technology", industry: "Software—Application" },
  MNDY: { sector: "Technology", industry: "Software—Application" },
  OKTA: { sector: "Technology", industry: "Software—Infrastructure" },
  BILL: { sector: "Technology", industry: "Software—Application" },

  // ---- Small/Mid-Cap Growth ----
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
  UPST: { sector: "Financial Services", industry: "Credit Services" },
  AFRM: { sector: "Financial Services", industry: "Credit Services" },
  RIVN: { sector: "Consumer Cyclical", industry: "Auto Manufacturers" },
  LCID: { sector: "Consumer Cyclical", industry: "Auto Manufacturers" },
  RBLX: { sector: "Technology", industry: "Electronic Gaming" },
  ANET: { sector: "Technology", industry: "Computer Hardware & Networking" },
  CFG: { sector: "Financial Services", industry: "Banks—Regional" },
  STX: { sector: "Technology", industry: "Computer Hardware & Storage" },
  WDC: { sector: "Technology", industry: "Computer Hardware & Storage" },
  DELL: { sector: "Technology", industry: "Computer Hardware" },
  HPE: { sector: "Technology", industry: "Computer Hardware" },
  NTNX: { sector: "Technology", industry: "Software—Infrastructure" },
  PSTG: { sector: "Technology", industry: "Computer Hardware & Storage" },
  VRT: { sector: "Industrials", industry: "Specialty Industrial Machinery" },
  MNSO: { sector: "Consumer Cyclical", industry: "Specialty Retail" },
  ASML: { sector: "Technology", industry: "Semiconductor Equipment" },
  TSM: { sector: "Technology", industry: "Semiconductors" },

  // ---- Media / Communication / Other ----
  DIS: { sector: "Communication Services", industry: "Entertainment" },
  CMCSA: { sector: "Communication Services", industry: "Telecom Services" },
  ABNB: { sector: "Consumer Cyclical", industry: "Travel Services" },
  SPOT: { sector: "Communication Services", industry: "Internet Content & Information" },
  PINS: { sector: "Communication Services", industry: "Internet Content & Information" },
};

/**
 * Look up sector & industry for a given symbol.
 * Returns { sector: "Unknown", industry: "Unknown" } if not found.
 */
export function getSectorInfo(symbol: string): { sector: string; industry: string } {
  return SECTOR_MAP[symbol.toUpperCase()] ?? { sector: "Unknown", industry: "Unknown" };
}

/**
 * Standard SPDR Sector ETF mapping for 11 GICS sectors.
 */
export const SECTOR_TO_ETF: Record<string, string> = {
  Technology: "XLK",
  "Information Technology": "XLK",
  "Financial Services": "XLF",
  Financials: "XLF",
  Healthcare: "XLV",
  "Health Care": "XLV",
  "Consumer Cyclical": "XLY",
  "Consumer Discretionary": "XLY",
  "Consumer Defensive": "XLP",
  "Consumer Staples": "XLP",
  Energy: "XLE",
  "Basic Materials": "XLB",
  Materials: "XLB",
  Industrials: "XLI",
  Utilities: "XLU",
  "Real Estate": "XLRE",
  "Communication Services": "XLC",
};

/**
 * Look up the primary SPDR Sector ETF ticker for a given sector name.
 */
export function getSectorETF(sector: string): string {
  if (!sector) return "SPY";
  return SECTOR_TO_ETF[sector] || "SPY";
}

/**
 * 16 High-Liquidity Sub-Industry & Thematic ETFs mapping.
 */
export const SUB_INDUSTRY_ETFS: Record<
  string,
  { name: string; nameZh: string; parentSector: string; parentETF: string }
> = {
  SMH: { name: "Semiconductors", nameZh: "半导体与芯片", parentSector: "Technology", parentETF: "XLK" },
  IGV: { name: "Software & Cloud", nameZh: "软件与SaaS云", parentSector: "Technology", parentETF: "XLK" },
  CIBR: { name: "Cybersecurity", nameZh: "网络安全", parentSector: "Technology", parentETF: "XLK" },
  KRE: { name: "Regional Banking", nameZh: "区域性银行", parentSector: "Financial Services", parentETF: "XLF" },
  IPAY: { name: "Fintech & Payments", nameZh: "数字支付/Fintech", parentSector: "Financial Services", parentETF: "XLF" },
  XBI: { name: "Biotechnology", nameZh: "生物科技 (Biotech)", parentSector: "Healthcare", parentETF: "XLV" },
  IHI: { name: "Medical Devices", nameZh: "医疗器械精密仪器", parentSector: "Healthcare", parentETF: "XLV" },
  ITA: { name: "Aerospace & Defense", nameZh: "国防军工与航天", parentSector: "Industrials", parentETF: "XLI" },
  IYT: { name: "Transportation", nameZh: "交通运输 (道氏先导)", parentSector: "Industrials", parentETF: "XLI" },
  ITB: { name: "Homebuilders", nameZh: "房屋建筑与建材", parentSector: "Consumer Cyclical", parentETF: "XLY" },
  XRT: { name: "Retail", nameZh: "商业零售", parentSector: "Consumer Cyclical", parentETF: "XLY" },
  XOP: { name: "Oil & Gas E&P", nameZh: "油气勘探开采", parentSector: "Energy", parentETF: "XLE" },
  ICLN: { name: "Clean Energy", nameZh: "清洁能源", parentSector: "Energy", parentETF: "XLE" },
  SOCL: { name: "Social Media", nameZh: "社交与数字媒体", parentSector: "Communication Services", parentETF: "XLC" },
  IWO: { name: "Russell 2000 Growth", nameZh: "小盘成长", parentSector: "Broad", parentETF: "SPY" },
  SPHD: { name: "High Dividend Low Vol", nameZh: "高股息低波", parentSector: "Broad", parentETF: "SPY" },
};

/**
 * Maps standard FMP/Yahoo industry strings to Sub-Industry ETFs.
 */
export const INDUSTRY_TO_SUB_ETF: Record<string, string> = {
  // Semiconductors
  Semiconductors: "SMH",
  "Semiconductor Equipment": "SMH",
  "Semiconductor Equipment & Materials": "SMH",
  // Software
  "Software—Application": "IGV",
  "Software—Infrastructure": "IGV",
  "Software - Application": "IGV",
  "Software - Infrastructure": "IGV",
  "Information Technology Services": "IGV",
  // Cybersecurity
  Cybersecurity: "CIBR",
  "Security & Protection Services": "CIBR",
  // Regional Banks
  "Banks—Regional": "KRE",
  "Banks - Regional": "KRE",
  // Payments / Fintech
  "Credit Services": "IPAY",
  "Financial Data": "IPAY",
  "Financial Data & Stock Exchanges": "IPAY",
  // Biotech
  Biotechnology: "XBI",
  // Medical Devices
  "Medical Instruments": "IHI",
  "Medical Devices": "IHI",
  "Medical Instruments & Supplies": "IHI",
  // Aerospace & Defense
  "Aerospace & Defense": "ITA",
  // Transportation
  Railroads: "IYT",
  "Integrated Freight & Logistics": "IYT",
  Airlines: "IYT",
  Trucking: "IYT",
  Marine: "IYT",
  // Homebuilders
  "Residential Construction": "ITB",
  "Building Materials": "ITB",
  // Retail
  "Internet Retail": "XRT",
  "Specialty Retail": "XRT",
  "Discount Stores": "XRT",
  "Department Stores": "XRT",
  // Oil & Gas
  "Oil & Gas E&P": "XOP",
  "Oil & Gas Exploration & Production": "XOP",
  "Oil & Gas Equipment": "XOP",
  "Oil & Gas Refining & Marketing": "XOP",
  // Clean Energy
  Solar: "ICLN",
  "Clean Energy": "ICLN",
  // Social Media
  "Internet Content & Information": "SOCL",
};

/**
 * Ticker-level precision overrides for white-chip / growth leaders.
 */
export const SYMBOL_SUB_ETF_OVERRIDES: Record<string, string> = {
  NVDA: "SMH",
  TSM: "SMH",
  AVGO: "SMH",
  ASML: "SMH",
  AMD: "SMH",
  QCOM: "SMH",
  AMAT: "SMH",
  ARM: "SMH",
  LRCX: "SMH",
  KLAC: "SMH",
  MRVL: "SMH",
  TXN: "SMH",
  MU: "SMH",

  MSFT: "IGV",
  CRM: "IGV",
  ADBE: "IGV",
  NOW: "IGV",
  ORCL: "IGV",
  INTU: "IGV",
  PLTR: "IGV",
  SNOW: "IGV",
  DDOG: "IGV",
  MDB: "IGV",
  APP: "IGV",
  TTD: "IGV",
  SHOP: "IGV",

  PANW: "CIBR",
  CRWD: "CIBR",
  FTNT: "CIBR",
  ZS: "CIBR",
  NET: "CIBR",

  TFC: "KRE",
  CFG: "KRE",
  KEY: "KRE",
  FITB: "KRE",
  HBAN: "KRE",
  WAL: "KRE",
  ZION: "KRE",

  V: "IPAY",
  MA: "IPAY",
  PYPL: "IPAY",
  SQ: "IPAY",
  HOOD: "IPAY",
  COIN: "IPAY",
  AFRM: "IPAY",
  SOFI: "IPAY",

  LLY: "XBI",
  VRTX: "XBI",
  REGN: "XBI",
  MRNA: "XBI",
  BIIB: "XBI",

  ISRG: "IHI",
  MDT: "IHI",
  ABT: "IHI",
  BSX: "IHI",
  SYK: "IHI",
  DXCM: "IHI",

  LMT: "ITA",
  RTX: "ITA",
  BA: "ITA",
  NOC: "ITA",
  GD: "ITA",
  GE: "ITA",
  AXON: "ITA",
  RKLB: "ITA",

  UNP: "IYT",
  UPS: "IYT",
  FDX: "IYT",
  DAL: "IYT",
  CSX: "IYT",

  DHI: "ITB",
  LEN: "ITB",
  NVR: "ITB",
  TOL: "ITB",

  WMT: "XRT",
  COST: "XRT",
  TGT: "XRT",
  ROST: "XRT",
  CELH: "XRT",

  OXY: "XOP",
  EOG: "XOP",
  DVN: "XOP",
  FANG: "XOP",

  FSLR: "ICLN",
  ENPH: "ICLN",

  META: "SOCL",
  GOOGL: "SOCL",
  GOOG: "SOCL",
  PINS: "SOCL",
  SNAP: "SOCL",
  SPOT: "SOCL",
};

/**
 * Resolve sub-industry ETF and name for a symbol and optional industry string.
 */
export function getSubIndustryInfo(
  symbol: string,
  industry?: string
): { etf: string; name: string; nameZh: string; parentSector: string; parentETF: string } | null {
  const symUpper = symbol.toUpperCase();
  // 1. Ticker override has top priority
  const overrideETF = SYMBOL_SUB_ETF_OVERRIDES[symUpper];
  if (overrideETF && SUB_INDUSTRY_ETFS[overrideETF]) {
    const info = SUB_INDUSTRY_ETFS[overrideETF];
    return { etf: overrideETF, ...info };
  }

  // 2. Industry name mapping
  if (industry && industry !== "Unknown") {
    const etf = INDUSTRY_TO_SUB_ETF[industry];
    if (etf && SUB_INDUSTRY_ETFS[etf]) {
      const info = SUB_INDUSTRY_ETFS[etf];
      return { etf, ...info };
    }
  }

  // 3. Static sector map industry fallback
  const staticEntry = SECTOR_MAP[symUpper];
  if (staticEntry?.industry) {
    const etf = INDUSTRY_TO_SUB_ETF[staticEntry.industry];
    if (etf && SUB_INDUSTRY_ETFS[etf]) {
      const info = SUB_INDUSTRY_ETFS[etf];
      return { etf, ...info };
    }
  }

  return null;
}


