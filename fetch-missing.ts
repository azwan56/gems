import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const envContent = fs.readFileSync(".env", "utf-8");
envContent.split("\n").forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    process.env[match[1].trim()] = match[2].trim();
  }
});

const FMP_STABLE_URL = "https://financialmodelingprep.com/stable";

const UNIVERSE = [
  "AAPL", "MSFT", "AMZN", "NVDA", "META", "GOOGL", "AVGO", "TSLA",
  "NFLX", "ADBE", "AMD", "CRM", "ORCL", "INTU", "QCOM",
  "ISRG", "AMAT", "PANW", "CRWD", "PLTR",
  "BRK-B", "JPM", "V", "MA", "BAC", "GS", "MS", "AXP",
  "JNJ", "PFE", "ABBV", "MRK", 
  "XOM", "CVX",
  "KO", "PG", "WMT", "MCD", "PM", "T",
  "LLY", "UNH", "HD", "CAT", "LOW",
  "AXON", "DDOG", "MDB", "ZS", "FTNT",
  "COIN", "HOOD", "APP", "TTD", "SMCI", 
  "CELH", "DUOL", "CAVA", "SOUN", "IONQ"
];

const SECTOR_MAP: Record<string, any> = {
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
  "BRK-B": { sector: "Financial Services", industry: "Insurance—Diversified" },
  JPM: { sector: "Financial Services", industry: "Banks—Diversified" },
  V: { sector: "Financial Services", industry: "Credit Services" },
  MA: { sector: "Financial Services", industry: "Credit Services" },
  BAC: { sector: "Financial Services", industry: "Banks—Diversified" },
  GS: { sector: "Financial Services", industry: "Capital Markets" },
  MS: { sector: "Financial Services", industry: "Capital Markets" },
  AXP: { sector: "Financial Services", industry: "Credit Services" },
  JNJ: { sector: "Healthcare", industry: "Drug Manufacturers" },
  PFE: { sector: "Healthcare", industry: "Drug Manufacturers" },
  ABBV: { sector: "Healthcare", industry: "Drug Manufacturers" },
  MRK: { sector: "Healthcare", industry: "Drug Manufacturers" },
  XOM: { sector: "Energy", industry: "Oil & Gas Integrated" },
  CVX: { sector: "Energy", industry: "Oil & Gas Integrated" },
  KO: { sector: "Consumer Defensive", industry: "Beverages" },
  PG: { sector: "Consumer Defensive", industry: "Household Products" },
  WMT: { sector: "Consumer Defensive", industry: "Discount Stores" },
  MCD: { sector: "Consumer Cyclical", industry: "Restaurants" },
  PM: { sector: "Consumer Defensive", industry: "Tobacco" },
  T: { sector: "Communication Services", industry: "Telecom Services" },
  LLY: { sector: "Healthcare", industry: "Drug Manufacturers" },
  UNH: { sector: "Healthcare", industry: "Healthcare Plans" },
  HD: { sector: "Consumer Cyclical", industry: "Home Improvement" },
  CAT: { sector: "Industrials", industry: "Farm & Heavy Construction" },
  LOW: { sector: "Consumer Cyclical", industry: "Home Improvement" },
  AXON: { sector: "Industrials", industry: "Aerospace & Defense" },
  DDOG: { sector: "Technology", industry: "Software—Application" },
  MDB: { sector: "Technology", industry: "Software—Infrastructure" },
  ZS: { sector: "Technology", industry: "Software—Infrastructure" },
  FTNT: { sector: "Technology", industry: "Software—Infrastructure" },
  COIN: { sector: "Financial Services", industry: "Financial Data" },
  HOOD: { sector: "Financial Services", industry: "Capital Markets" },
  APP: { sector: "Technology", industry: "Software—Application" },
  TTD: { sector: "Technology", industry: "Software—Application" },
  SMCI: { sector: "Technology", industry: "Computer Hardware" },
  CELH: { sector: "Consumer Defensive", industry: "Beverages" },
  DUOL: { sector: "Technology", industry: "Software—Application" },
  CAVA: { sector: "Consumer Cyclical", industry: "Restaurants" },
  SOUN: { sector: "Technology", industry: "Software—Application" },
  IONQ: { sector: "Technology", industry: "Computer Hardware" }
};

async function fmpGet(endpoint: string, symbol: string) {
  const url = `${FMP_STABLE_URL}${endpoint}?symbol=${symbol}&limit=1&apikey=${process.env.FMP_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 402) throw new Error("FMP 402: Payment Required");
    throw new Error(`FMP Error: ${res.status}`);
  }
  return res.json();
}

function numOrNull(val: any) {
  return val != null ? val : null;
}

function toPercent(val: any) {
  return val != null ? val * 100 : null;
}

async function run() {
  if (getApps().length === 0) {
    const cred = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(cred) });
  }
  const db = getFirestore();
  db.settings({ ignoreUndefinedProperties: true });

  const doc = await db.collection("stock_pools").doc("latest").get();
  const pool = doc.data() || { meta: {}, stocks: [] };
  const existingStocks = pool.stocks as any[];

  // Map of symbol -> stock object
  const stockMap = new Map<string, any>();
  for (const s of existingStocks) {
    stockMap.set(s.symbol, s);
  }

  let calls = 0;

  try {
    for (const symbol of UNIVERSE) {
      const stock = stockMap.get(symbol) || {};
      const { sector, industry } = SECTOR_MAP[symbol] || { sector: "Unknown", industry: "Unknown" };
      
      let needsUpdate = false;
      
      // We need quote, ratios, growth, key-metrics
      if (!stock.price) {
        console.log(`Fetching quote for ${symbol}`);
        const data: any = await fmpGet("/quote", symbol);
        calls++;
        if (data?.[0]) {
          stock.symbol = data[0].symbol;
          stock.companyName = data[0].name;
          stock.price = data[0].price;
          stock.marketCap = data[0].marketCap;
          stock.priceVs50SMA = data[0].priceAvg50 != null ? ((data[0].price - data[0].priceAvg50) / data[0].priceAvg50) * 100 : null;
          stock.priceVs200SMA = data[0].priceAvg200 != null ? ((data[0].price - data[0].priceAvg200) / data[0].priceAvg200) * 100 : null;
          stock.fiftyTwoWeekHigh = data[0].yearHigh;
          stock.fiftyTwoWeekLow = data[0].yearLow;
          stock.sector = sector;
          stock.industry = industry;
        }
        needsUpdate = true;
      }

      if (stock.peRatio === undefined || stock.peRatio === null) {
        console.log(`Fetching ratios for ${symbol}`);
        const data: any = await fmpGet("/ratios-ttm", symbol);
        calls++;
        if (data?.[0]) {
          const r = data[0];
          stock.peRatio = numOrNull(r.peRatioTTM ?? r.priceToEarningsRatioTTM);
          stock.pbRatio = numOrNull(r.priceToBookRatioTTM);
          
          const fcfRatio = r.priceToFreeCashFlowsRatioTTM ?? r.priceToFreeCashFlowRatioTTM;
          stock.freeCashFlowYield = fcfRatio != null && fcfRatio > 0 ? (1 / fcfRatio) * 100 : null;
          
          stock.dividendYield = toPercent(r.dividendYieldTTM);
          stock.currentRatio = numOrNull(r.currentRatioTTM);
          stock.debtToEquity = numOrNull(r.debtEquityRatioTTM ?? r.debtToEquityRatioTTM);
          stock.pegRatio = numOrNull(r.pegRatioTTM ?? r.priceToEarningsGrowthRatioTTM);
          stock.grossMargin = toPercent(r.grossProfitMarginTTM);
          stock.netMargin = toPercent(r.netProfitMarginTTM);
        }
        needsUpdate = true;
      }

      if (stock.revenueGrowthYoY === undefined || stock.revenueGrowthYoY === null) {
        console.log(`Fetching growth for ${symbol}`);
        const data: any = await fmpGet("/financial-growth", symbol);
        calls++;
        if (data?.[0]) {
          stock.revenueGrowthYoY = toPercent(data[0].revenueGrowth);
          stock.epsGrowthYoY = toPercent(data[0].epsgrowth);
        }
        needsUpdate = true;
      }

      if (stock.roe === undefined || stock.roe === null) {
        console.log(`Fetching key-metrics for ${symbol}`);
        const data: any = await fmpGet("/key-metrics-ttm", symbol);
        calls++;
        if (data?.[0]) {
          stock.roe = toPercent(data[0].returnOnEquityTTM);
        }
        needsUpdate = true;
      }

      if (needsUpdate) {
        stockMap.set(symbol, stock);
      }
    }
  } catch (err: any) {
    console.error("Fetch stopped:", err.message);
  }

  const finalStocks = Array.from(stockMap.values()).filter(s => s.price);
  
  await db.collection("stock_pools").doc("latest").set({
    meta: {
      updatedAt: new Date().toISOString(),
      symbolCount: finalStocks.length,
      source: "fmp",
      apiCallsUsed: (pool.meta?.apiCallsUsed || 0) + calls
    },
    stocks: finalStocks
  });

  console.log(`Done. Total stocks: ${finalStocks.length}. API calls used in this run: ${calls}`);
}

run().catch(console.error);
