// ============================================================
// Local incremental FMP data fetch script
// Reads .env, connects to Firestore, fetches all missing data
// Usage: npx tsx fetch-missing.ts
// ============================================================

import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

// Load environment variables from .env file
const envContent = fs.readFileSync(".env", "utf-8");
envContent.split("\n").forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    process.env[match[1].trim()] = match[2].trim();
  }
});

const FMP_STABLE_URL = "https://financialmodelingprep.com/stable";
const PARALLEL = 10;
const BATCH_DELAY_MS = 1200; // 1.2s between batches to avoid per-minute rate limits

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// Import universe from the project source
import { UNIVERSE } from "./src/lib/index-constituents";

// Inline sector map for the script (matches sector-map.ts)
import { getSectorInfo } from "./src/lib/sector-map";

async function fmpGet(endpoint: string, params: Record<string, string> = {}, retries = 3): Promise<any> {
  const url = new URL(`${FMP_STABLE_URL}${endpoint}`);
  url.searchParams.set("apikey", process.env.FMP_API_KEY!);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url.toString());
    if (res.ok) return res.json();
    if (res.status === 429) {
      const wait = (attempt + 1) * 3000; // 3s, 6s, 9s backoff
      console.log(`  ⏳ Rate limited on ${endpoint} ${params.symbol || ''}, waiting ${wait/1000}s...`);
      await sleep(wait);
      continue;
    }
    if (res.status === 402) throw new Error("FMP 402: Payment Required");
    throw new Error(`FMP Error: ${res.status}`);
  }
  throw new Error("FMP 429: Rate Limited (after retries)");
}

function numOrNull(val: any) {
  return val != null ? val : null;
}

function toPercent(val: any) {
  return val != null ? val * 100 : null;
}

interface StockData {
  symbol: string;
  companyName: string;
  sector: string;
  industry: string;
  marketCap: number;
  price: number;
  peRatio: number | null;
  pbRatio: number | null;
  freeCashFlowYield: number | null;
  dividendYield: number | null;
  currentRatio: number | null;
  debtToEquity: number | null;
  revenueGrowthYoY: number | null;
  epsGrowthYoY: number | null;
  pegRatio: number | null;
  roe: number | null;
  grossMargin: number | null;
  netMargin: number | null;
  priceVs50SMA: number | null;
  priceVs200SMA: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
}

async function parallelFetch<T>(
  symbols: string[],
  fetcher: (symbol: string) => Promise<{ key: string; value: T } | null>,
  errors: string[]
): Promise<{ map: Map<string, T>; calls: number }> {
  const result = new Map<string, T>();
  let calls = 0;

  for (let i = 0; i < symbols.length; i += PARALLEL) {
    const batch = symbols.slice(i, Math.min(i + PARALLEL, symbols.length));
    const settled = await Promise.allSettled(
      batch.map(async (symbol) => {
        calls++;
        return fetcher(symbol);
      })
    );
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) {
        result.set(r.value.key, r.value.value);
      } else if (r.status === "rejected") {
        errors.push(String(r.reason).slice(0, 120));
      }
    }
    // Throttle between batches to avoid per-minute rate limits
    if (i + PARALLEL < symbols.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }
  return { map: result, calls };
}

async function run() {
  if (getApps().length === 0) {
    const cred = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({ credential: cert(cred) });
  }
  const db = getFirestore();
  db.settings({ ignoreUndefinedProperties: true });

  const symbols = [...new Set(UNIVERSE)];
  const errors: string[] = [];
  let totalCalls = 0;

  console.log(`\n🚀 Fetching data for ${symbols.length} stocks...\n`);

  // ---- Phase 1: Quote ----
  console.log(`[Phase 1] Fetching quotes for ${symbols.length} symbols...`);
  const { map: quoteMap, calls: quoteCalls } = await parallelFetch<any>(
    symbols,
    async (symbol) => {
      const data: any = await fmpGet("/quote", { symbol });
      if (!data?.[0]?.symbol) return null;
      return { key: data[0].symbol.toUpperCase(), value: data[0] };
    },
    errors
  );
  totalCalls += quoteCalls;
  console.log(`[Phase 1] ✅ ${quoteMap.size} quotes (${quoteCalls} calls)`);

  const validSymbols = symbols.filter(s => quoteMap.has(s.toUpperCase()));

  // ---- Phase 2: Ratios ----
  console.log(`[Phase 2] Fetching ratios for ${validSymbols.length} symbols...`);
  const { map: ratioMap, calls: ratioCalls } = await parallelFetch<any>(
    validSymbols,
    async (symbol) => {
      const data: any = await fmpGet("/ratios-ttm", { symbol });
      if (!data?.[0]) return null;
      return { key: symbol.toUpperCase(), value: data[0] };
    },
    errors
  );
  totalCalls += ratioCalls;
  console.log(`[Phase 2] ✅ ${ratioMap.size} ratios (${ratioCalls} calls)`);

  // ---- Phase 3: Growth ----
  console.log(`[Phase 3] Fetching growth for ${validSymbols.length} symbols...`);
  const { map: growthMap, calls: growthCalls } = await parallelFetch<any>(
    validSymbols,
    async (symbol) => {
      const data: any = await fmpGet("/financial-growth", { symbol, limit: "1" });
      if (!data?.[0]) return null;
      return { key: symbol.toUpperCase(), value: data[0] };
    },
    errors
  );
  totalCalls += growthCalls;
  console.log(`[Phase 3] ✅ ${growthMap.size} growth (${growthCalls} calls)`);

  // ---- Phase 4: Key Metrics (ROE) ----
  console.log(`[Phase 4] Fetching key metrics for ${validSymbols.length} symbols...`);
  const { map: keyMetricsMap, calls: keyMetricsCalls } = await parallelFetch<any>(
    validSymbols,
    async (symbol) => {
      const data: any = await fmpGet("/key-metrics-ttm", { symbol, limit: "1" });
      if (!data?.[0]) return null;
      return { key: symbol.toUpperCase(), value: data[0] };
    },
    errors
  );
  totalCalls += keyMetricsCalls;
  console.log(`[Phase 4] ✅ ${keyMetricsMap.size} key metrics (${keyMetricsCalls} calls)`);

  // ---- Build stock data ----
  const stocks: StockData[] = [];
  for (const symbol of validSymbols) {
    const upper = symbol.toUpperCase();
    const quote = quoteMap.get(upper);
    if (!quote) continue;

    const ratios = ratioMap.get(upper);
    const growth = growthMap.get(upper);
    const km = keyMetricsMap.get(upper);
    const { sector, industry } = getSectorInfo(upper);

    const price = quote.price || 0;
    const priceVs50 = quote.priceAvg50 != null
      ? ((price - quote.priceAvg50) / quote.priceAvg50) * 100 : null;
    const priceVs200 = quote.priceAvg200 != null
      ? ((price - quote.priceAvg200) / quote.priceAvg200) * 100 : null;

    const fcfRatio = ratios?.priceToFreeCashFlowsRatioTTM ?? ratios?.priceToFreeCashFlowRatioTTM;
    const fcfYield = fcfRatio != null && fcfRatio > 0 ? (1 / fcfRatio) * 100 : null;

    const pe = numOrNull(ratios?.peRatioTTM ?? ratios?.priceToEarningsRatioTTM);
    const peg = numOrNull(ratios?.pegRatioTTM ?? ratios?.priceToEarningsGrowthRatioTTM);
    const debtToEquity = numOrNull(ratios?.debtEquityRatioTTM ?? ratios?.debtToEquityRatioTTM);
    const rawRoe = km?.returnOnEquityTTM ?? ratios?.returnOnEquityTTM ?? ratios?.roeTTM;

    stocks.push({
      symbol: quote.symbol || symbol,
      companyName: quote.name || symbol,
      sector,
      industry,
      marketCap: quote.marketCap || 0,
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
      fiftyTwoWeekHigh: numOrNull(quote.yearHigh),
      fiftyTwoWeekLow: numOrNull(quote.yearLow),
    });
  }

  // ---- Save to Firestore ----
  console.log(`\n📊 Saving ${stocks.length} stocks to Firestore...`);
  await db.collection("stock_pools").doc("latest").set({
    meta: {
      updatedAt: new Date().toISOString(),
      symbolCount: stocks.length,
      source: "fmp",
      apiCallsUsed: totalCalls,
    },
    stocks,
  });

  // Print summary
  const withRoe = stocks.filter(s => s.roe != null).length;
  const withPe = stocks.filter(s => s.peRatio != null).length;
  const withGrowth = stocks.filter(s => s.revenueGrowthYoY != null).length;

  console.log(`\n✅ Done!`);
  console.log(`   Total stocks: ${stocks.length}`);
  console.log(`   API calls used: ${totalCalls}`);
  console.log(`   Errors: ${errors.length}`);
  console.log(`   Data coverage:`);
  console.log(`     • ROE: ${withRoe}/${stocks.length}`);
  console.log(`     • PE:  ${withPe}/${stocks.length}`);
  console.log(`     • Revenue Growth: ${withGrowth}/${stocks.length}`);

  if (errors.length > 0) {
    console.log(`\n⚠️ First 10 errors:`);
    errors.slice(0, 10).forEach(e => console.log(`   ${e}`));
  }
}

run().catch(console.error);
