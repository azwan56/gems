// ============================================================
// GET /api/stock-metrics?symbol=AAPL — Fetch metrics for a single stock
// Reads from the Firestore stock pool (already fetched from FMP).
// Used by the share card generator to populate the metrics grid.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { loadStockPool } from "@/lib/stock-pool-store";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");

  if (!symbol) {
    return NextResponse.json(
      { error: "MISSING_SYMBOL", message: "symbol query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const pool = await loadStockPool();
    if (!pool || !pool.stocks) {
      return NextResponse.json(
        { error: "POOL_EMPTY", message: "Stock pool is not available" },
        { status: 404 }
      );
    }

    const upperSymbol = symbol.toUpperCase();
    const found = pool.stocks.find((s) => s.symbol.toUpperCase() === upperSymbol);

    if (!found) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `${symbol} not found in stock pool` },
        { status: 404 }
      );
    }

    return NextResponse.json({ metrics: found });
  } catch (e) {
    console.error("Failed to fetch stock metrics:", e);
    return NextResponse.json(
      { error: "FETCH_FAILED", message: "Failed to fetch stock metrics" },
      { status: 500 }
    );
  }
}
