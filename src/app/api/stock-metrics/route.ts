// ============================================================
// GET /api/stock-metrics?symbol=AAPL — Fetch metrics for a single stock
// Uses resolveStock: Firestore pool → FMP live API → Mock data.
// Used by the share card generator to populate the metrics grid.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { resolveStock } from "@/lib/stock-resolver";
import { verifyAuth } from "@/lib/auth-middleware";

export async function GET(request: NextRequest) {
  const authResult = await verifyAuth(request);
  if (!authResult.success) return authResult.response;

  const symbol = request.nextUrl.searchParams.get("symbol");

  if (!symbol) {
    return NextResponse.json(
      { error: "MISSING_SYMBOL", message: "symbol query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const found = await resolveStock(symbol);

    if (!found) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `${symbol} could not be resolved` },
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

