// ============================================================
// API: /api/rebalance-data — Serve dashboard data
// Premium-only (paid/super). Returns latest alert snapshots
// AND live liquidity metrics (VIX, TNX, upcoming macro events).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { withPremium } from "@/lib/api-utils";
import { getLatestSnapshots } from "@/lib/rebalance-store";
import { getUpcomingMacroEvents } from "@/lib/market-calendar";
import { getDb } from "@/lib/firebase";

// ---- helpers for portfolio holdings from DailyStock ----

interface StockProfile {
  symbol: string;
  beta: number | null;
  sector: string;
  marketCap: number;
}

interface StockImpact {
  symbol: string;
  tag: string;    // e.g. "抛售风险", "防御性", "利率敏感"
  color: string;  // CSS color class: "red", "green", "amber", "blue"
}

// Defensive sectors that tend to hold up during macro volatility
const DEFENSIVE_SECTORS = new Set([
  "Consumer Defensive", "Utilities", "Healthcare",
  "Consumer Staples", "Real Estate",
]);

// Rate-sensitive sectors
const RATE_SENSITIVE_SECTORS = new Set([
  "Technology", "Real Estate", "Utilities", "Financial Services",
]);

/**
 * Read user's watchlist (primary holdings) from DailyStock Firestore.
 * Each item can be a plain string ("AAPL") or an object ({ symbol: "AAPL", ... }).
 * observe_list is intentionally excluded — only real holdings matter.
 */
async function getPortfolioSymbols(uid: string): Promise<string[]> {
  try {
    const db = getDb();
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists) return [];
    const data = snap.data();
    const rawWl = (data?.watchlist as unknown[]) || [];
    return rawWl
      .map((item) => {
        if (typeof item === "string") return item.toUpperCase();
        if (item && typeof item === "object" && "symbol" in item) {
          const sym = (item as { symbol: string }).symbol;
          return typeof sym === "string" ? sym.toUpperCase() : null;
        }
        return null;
      })
      .filter((s): s is string => s != null);
  } catch (e) {
    console.error("Failed to read DailyStock portfolio:", e);
    return [];
  }
}

/** Fetch beta & sector for a list of symbols from FMP (bulk) */
async function fetchStockProfiles(symbols: string[]): Promise<Map<string, StockProfile>> {
  const map = new Map<string, StockProfile>();
  if (symbols.length === 0) return map;
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return map;

  try {
    const syms = symbols.join(",");
    const url = `https://financialmodelingprep.com/stable/profile?symbol=${encodeURIComponent(syms)}&apikey=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 3600 } }); // cache 1h — profiles don't change often
    if (!res.ok) return map;
    const data = await res.json();
    if (!Array.isArray(data)) return map;
    for (const p of data) {
      map.set(String(p.symbol).toUpperCase(), {
        symbol: String(p.symbol).toUpperCase(),
        beta: typeof p.beta === "number" ? p.beta : null,
        sector: p.sector || "Unknown",
        marketCap: typeof p.mktCap === "number" ? p.mktCap : 0,
      });
    }
  } catch (e) {
    console.error("Failed to fetch FMP profiles:", e);
  }
  return map;
}

/** Classify a stock's risk for a given event category */
function classifyStockForEvent(
  sym: string,
  category: string,
  profiles: Map<string, StockProfile>,
  snapshotWinners: Set<string>,
  snapshotLosers: Set<string>,
): StockImpact {
  const p = profiles.get(sym);
  const beta = p?.beta ?? 1.0;
  const sector = p?.sector ?? "Unknown";
  const isDefensive = DEFENSIVE_SECTORS.has(sector);
  const isRateSensitive = RATE_SENSITIVE_SECTORS.has(sector);

  if (category === "MACRO_DATA") {
    // CPI / NFP / GDP etc. — high-beta growth stocks face sell-off risk
    if (beta >= 1.3) return { symbol: sym, tag: "⚠️ 高Beta抛售风险", color: "red" };
    if (isDefensive) return { symbol: sym, tag: "🛡️ 防御性", color: "green" };
    if (beta <= 0.8) return { symbol: sym, tag: "🛡️ 低波动", color: "green" };
    return { symbol: sym, tag: "📊 关注数据", color: "amber" };
  }

  if (category === "FED_POLICY") {
    // FOMC / Fed speakers — rate-sensitive sectors most affected
    if (isRateSensitive && beta >= 1.2) return { symbol: sym, tag: "⚠️ 利率敏感·高风险", color: "red" };
    if (isRateSensitive) return { symbol: sym, tag: "📉 利率敏感", color: "amber" };
    if (isDefensive) return { symbol: sym, tag: "🛡️ 防御性", color: "green" };
    return { symbol: sym, tag: "📊 间接影响", color: "blue" };
  }

  if (category === "OPTIONS_EXPIRY" || category === "REBALANCE_WINDOW") {
    // OPEX / Quad Witching / Quarter-end — momentum extremes face rebalancing
    if (snapshotWinners.has(sym)) return { symbol: sym, tag: "⚠️ 获利回吐风险", color: "red" };
    if (snapshotLosers.has(sym)) return { symbol: sym, tag: "⚠️ 止损抛售风险", color: "red" };
    if (beta >= 1.3) return { symbol: sym, tag: "📉 高Gamma波动", color: "amber" };
    if (isDefensive || beta <= 0.8) return { symbol: sym, tag: "🛡️ 相对稳定", color: "green" };
    return { symbol: sym, tag: "📊 正常波动", color: "blue" };
  }

  return { symbol: sym, tag: "📊 待观察", color: "blue" };
}

// VIX via FMP quote (lightweight — no historical data needed)
async function fetchLiveQuote(symbol: string): Promise<number | null> {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://financialmodelingprep.com/stable/quote?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 300 } }); // cache 5 min
    if (!res.ok) return null;
    const data = await res.json();
    return data?.[0]?.price ?? null;
  } catch {
    return null;
  }
}

// TNX (10-Year Treasury Yield) via FMP dedicated endpoint
// FMP does NOT support ^TNX as a quote symbol — must use /stable/treasury-rates
async function fetchTreasuryYield(): Promise<number | null> {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return null;

  try {
    const today = new Date().toISOString().split("T")[0];
    // Fetch last 7 days to handle weekends/holidays
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const url = `https://financialmodelingprep.com/stable/treasury-rates?from=${from}&to=${today}&apikey=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    // Data is sorted by date descending — first entry is the latest
    return data[0]?.year10 ?? null;
  } catch {
    return null;
  }
}

// Fetch last N trading days of VIX close prices for the sparkline chart
async function fetchVixHistory(days: number = 7): Promise<number[]> {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return [];

  try {
    // Fetch a wider window to account for weekends/holidays, then take last N
    const today = new Date().toISOString().split("T")[0];
    const fromDate = new Date(Date.now() - (days + 10) * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const url = `https://financialmodelingprep.com/stable/historical-price-eod/light?symbol=%5EVIX&from=${fromDate}&to=${today}&apikey=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    // FMP returns descending order; reverse to ascending, take last N
    const sorted = data
      .filter((d: { close?: number }) => d.close != null)
      .reverse()
      .slice(-days)
      .map((d: { close: number }) => d.close);
    return sorted;
  } catch {
    return [];
  }
}

export const GET = withPremium(async (request: NextRequest, user) => {
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitParam || "10", 10) || 10, 1), 30);

  // Fetch snapshots, live quotes, VIX history, and user's watchlist in parallel
  const [snapshots, vix, tnx, vixHistory, portfolioSymbols] = await Promise.all([
    getLatestSnapshots(limit),
    fetchLiveQuote("^VIX"),
    fetchTreasuryYield(),
    fetchVixHistory(7),
    getPortfolioSymbols(user.uid),
  ]);

  // Fetch FMP profiles for the user's portfolio (beta, sector) — cached 1h
  const profiles = await fetchStockProfiles(portfolioSymbols);

  // Upcoming macro events (next 21 days) — pure computation, no API call
  const rawEvents = getUpcomingMacroEvents(new Date(), 21);
  const latestSnapshot = snapshots[0];

  // Build winner/loser sets from the latest snapshot
  const snapshotWinners = new Set(
    (latestSnapshot?.micro?.winners ?? []).slice(0, 5).map(w => w.symbol)
  );
  const snapshotLosers = new Set(
    (latestSnapshot?.micro?.losers ?? []).slice(0, 5).map(l => l.symbol)
  );

  // Enrich events with per-stock risk classification
  const upcomingEvents = rawEvents.map(event => {
    const impactedStocks: StockImpact[] = portfolioSymbols.map(sym =>
      classifyStockForEvent(sym, event.category, profiles, snapshotWinners, snapshotLosers)
    );

    // Sort: red (risk) first, then amber, then green/blue
    const colorOrder: Record<string, number> = { red: 0, amber: 1, green: 2, blue: 3 };
    impactedStocks.sort((a, b) => (colorOrder[a.color] ?? 9) - (colorOrder[b.color] ?? 9));
    
    return {
      ...event,
      impactedStocks
    };
  });

  // Determine VIX trend
  let vixTrend: "SPIKING" | "SUPPRESSED" | "NORMAL" | "UNKNOWN" = "UNKNOWN";
  if (vix != null) {
    if (vix > 20) vixTrend = "SPIKING";
    else if (vix < 14) vixTrend = "SUPPRESSED";
    else vixTrend = "NORMAL";
  }

  return NextResponse.json({
    snapshots,
    count: snapshots.length,
    liquidity: {
      vix,
      vixTrend,
      vixHistory,
      tnx,
      upcomingEvents,
    },
  });
});
