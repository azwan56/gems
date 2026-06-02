// ============================================================
// GET /api/quotes?symbols=AAPL,MSFT,TSLA
// Proxy to the DailyStock backend's /api/quotes endpoint.
// Keeps the backend URL secret from the browser client.
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

  try {
    const url = `${DAILYSTOCK_API_URL}/quotes?symbols=${encodeURIComponent(symbols)}`;
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
      // Cache for 60 seconds on the edge to reduce backend load
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      console.error(`DailyStock /api/quotes returned ${res.status}`);
      return NextResponse.json(
        { error: "UPSTREAM_ERROR", message: `Backend returned ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error("Failed to proxy quotes:", e);
    return NextResponse.json(
      { error: "PROXY_FAILED", message: "Failed to fetch quotes from backend" },
      { status: 502 }
    );
  }
}
