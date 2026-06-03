// ============================================================
// API: /api/rebalance-data — Serve dashboard data
// Premium-only (paid/super). Returns latest alert snapshots
// AND live liquidity metrics (VIX, TNX, upcoming macro events).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { withPremium } from "@/lib/api-utils";
import { getLatestSnapshots } from "@/lib/rebalance-store";
import { getUpcomingMacroEvents } from "@/lib/market-calendar";

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

export const GET = withPremium(async (request: NextRequest) => {
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitParam || "10", 10) || 10, 1), 30);

  // Fetch snapshots and live liquidity data in parallel
  const [snapshots, vix, tnx] = await Promise.all([
    getLatestSnapshots(limit),
    fetchLiveQuote("^VIX"),
    fetchLiveQuote("^TNX"),
  ]);

  // Upcoming macro events (next 14 days) — pure computation, no API call
  const upcomingEvents = getUpcomingMacroEvents(new Date(), 14);

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
      tnx,
      upcomingEvents,
    },
  });
});
