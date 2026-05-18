// ============================================================
// GET /api/stock-pool  — Returns pool status & stocks
// POST /api/stock-pool — Triggers a refresh from FMP
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { loadStockPool, saveStockPool, getPoolStatus, isPoolFresh } from "@/lib/stock-pool-store";
import { fetchFullUniverse } from "@/lib/fmp-batch-fetcher";
import { generateMockStocks } from "@/lib/mock-data";

// Allow longer execution for the refresh operation (Vercel Pro: up to 300s)
export const maxDuration = 120;

/**
 * GET: Return pool status and optionally the stocks.
 * Query params:
 *   ?include=stocks — also return the full stock array
 */
export async function GET(request: NextRequest) {
  try {
    const includeStocks = request.nextUrl.searchParams.get("include") === "stocks";

    if (includeStocks) {
      const pool = await loadStockPool();
      if (!pool) {
        return NextResponse.json({
          status: "empty",
          message: "No stock pool stored yet. POST to /api/stock-pool to refresh.",
        });
      }
      return NextResponse.json({
        status: "ok",
        meta: pool.meta,
        fresh: isPoolFresh(pool.meta),
        stocks: pool.stocks,
      });
    }

    // Just return metadata
    const meta = await getPoolStatus();
    if (!meta) {
      return NextResponse.json({ status: "empty" });
    }
    return NextResponse.json({
      status: "ok",
      meta,
      fresh: isPoolFresh(meta),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "POOL_STATUS_ERROR", message: String(err) },
      { status: 500 }
    );
  }
}

/**
 * POST: Refresh the stock pool from FMP (or mock if no API key).
 * Body (optional):
 *   { "force": true }  — refresh even if pool is still fresh
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const force = body?.force === true;

    // Check if pool is already fresh
    if (!force) {
      const existingMeta = await getPoolStatus();
      if (existingMeta && isPoolFresh(existingMeta)) {
        return NextResponse.json({
          status: "skipped",
          message: `Pool is still fresh (updated ${existingMeta.updatedAt}). Pass { "force": true } to override.`,
          meta: existingMeta,
        });
      }
    }

    // Check if FMP API key is configured
    if (!process.env.FMP_API_KEY) {
      // Fallback: store mock data
      console.log("[stock-pool] No FMP_API_KEY, storing mock data");
      const mockStocks = generateMockStocks();
      const meta = await saveStockPool(mockStocks, "mock", 0);
      return NextResponse.json({
        status: "ok",
        source: "mock",
        meta,
        message: "Stored mock data (no FMP_API_KEY configured).",
      });
    }

    // Fetch from FMP
    console.log("[stock-pool] Starting FMP universe fetch...");
    const result = await fetchFullUniverse();

    if (result.stocks.length === 0) {
      return NextResponse.json(
        {
          error: "FETCH_FAILED",
          message: "No stocks returned from FMP",
          errors: result.errors,
          apiCallsUsed: result.apiCallsUsed,
        },
        { status: 502 }
      );
    }

    // Persist to Firestore
    const meta = await saveStockPool(result.stocks, "fmp", result.apiCallsUsed);

    return NextResponse.json({
      status: "ok",
      source: "fmp",
      meta,
      apiCallsUsed: result.apiCallsUsed,
      errorCount: result.errors.length,
      errors: result.errors.slice(0, 10), // first 10 errors only
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[stock-pool] Refresh error:", message);
    return NextResponse.json(
      { error: "REFRESH_ERROR", message },
      { status: 500 }
    );
  }
}
