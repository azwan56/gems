// ============================================================
// API: /api/rebalance-data — Serve dashboard data
// Premium-only (paid/super). Returns latest alert snapshots
// AND live liquidity metrics (VIX, TNX, upcoming macro events).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { withPremium } from "@/lib/api-utils";
import { getLatestSnapshots } from "@/lib/rebalance-store";
import { getUpcomingMacroEvents } from "@/lib/market-calendar";
import { getWatchlist } from "@/lib/user-store";

// VIX/TNX via FMP quote (lightweight — no historical data needed)
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
  const [snapshots, vix, tnx, vixHistory, watchlist] = await Promise.all([
    getLatestSnapshots(limit),
    fetchLiveQuote("^VIX"),
    fetchLiveQuote("^TNX"),
    fetchVixHistory(7),
    getWatchlist(user.uid),
  ]);

  // Upcoming macro events (next 14 days) — pure computation, no API call
  const rawEvents = getUpcomingMacroEvents(new Date(), 14);
  const latestSnapshot = snapshots[0];

  // Enrich events with impacted stocks
  const upcomingEvents = rawEvents.map(event => {
    let impactedStocks: string[] = [];
    
    if (event.category === "MACRO_DATA" || event.category === "FED_POLICY") {
      // For macro events, highlight watchlist stocks. 
      // In a real app, we'd filter for high-beta or rate-sensitive tech stocks.
      // Here we just pick up to 3 from the user's watchlist.
      impactedStocks = watchlist.slice(0, 3).map(w => w.symbol);
    } else if (event.category === "OPTIONS_EXPIRY" || event.category === "REBALANCE_WINDOW") {
      // For rebalancing or OPEX, highlight the extreme winners/losers from the latest snapshot
      if (latestSnapshot?.micro) {
        // Grab top 2 winners and top 1 loser
        const topWinners = latestSnapshot.micro.winners.slice(0, 2).map(w => w.symbol);
        const topLosers = latestSnapshot.micro.losers.slice(0, 1).map(l => l.symbol);
        impactedStocks = [...topWinners, ...topLosers];
      }
    }
    
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
