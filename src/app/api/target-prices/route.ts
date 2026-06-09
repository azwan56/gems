// ============================================================
// GET /api/target-prices?symbols=AAPL,MSFT,NVDA
// Proxy to Python backend's /api/deep-insights endpoint.
// Returns analyst target prices for multiple symbols in one call.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-middleware";

const DAILYSTOCK_API_URL =
  process.env.DAILYSTOCK_API_URL || "https://daily-mkt-rpt.onrender.com/api";

export async function GET(request: NextRequest) {
  const authResult = await verifyAuth(request);
  if (!authResult.success) return authResult.response;

  const symbols = request.nextUrl.searchParams.get("symbols");

  if (!symbols || !symbols.trim()) {
    return NextResponse.json(
      { error: "MISSING_SYMBOLS", message: "symbols query parameter is required (comma-separated)" },
      { status: 400 }
    );
  }

  const symbolList = symbols.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);

  try {
    // Fetch deep insights for each symbol in parallel
    const results: Record<string, {
      targetConsensus: number;
      targetHigh: number;
      targetLow: number;
      targetMedian: number;
    }> = {};

    await Promise.allSettled(
      symbolList.map(async (sym) => {
        try {
          const url = `${DAILYSTOCK_API_URL}/deep-insights?symbol=${encodeURIComponent(sym)}`;
          const res = await fetch(url, {
            headers: { "Accept": "application/json" },
            next: { revalidate: 3600 }, // Cache for 1 hour
          });
          if (res.ok) {
            const data = await res.json();
            const pt = data?.insights?.price_target;
            if (pt && pt.targetConsensus) {
              results[sym] = {
                targetConsensus: pt.targetConsensus,
                targetHigh: pt.targetHigh,
                targetLow: pt.targetLow,
                targetMedian: pt.targetMedian,
              };
            }
          }
        } catch {
          // Ignore per-symbol failures — target prices are non-critical
        }
      })
    );

    return NextResponse.json({ targets: results });
  } catch (e) {
    console.error("Failed to fetch target prices:", e);
    return NextResponse.json(
      { error: "PROXY_FAILED", message: "Failed to fetch target prices" },
      { status: 502 }
    );
  }
}
