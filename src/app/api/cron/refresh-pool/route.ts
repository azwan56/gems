// ============================================================
// GET /api/cron/refresh-pool — Vercel Cron Job (chunked)
//
// Expands the universe to S&P 500 + NASDAQ 100 + Russell mid-cap
// (~850-900 stocks). Since Vercel functions have a 300s timeout,
// the universe is split into 6 chunks (~150 symbols each):
//
//   ?chunk=1  → (21:00 UTC / 5:00 PM ET)
//   ?chunk=2  → (21:05 UTC / 5:05 PM ET)
//   ?chunk=3  → (21:10 UTC / 5:10 PM ET)
//   ?chunk=4  → (21:15 UTC / 5:15 PM ET)
//   ?chunk=5  → (21:20 UTC / 5:20 PM ET)
//   ?chunk=6  → (21:25 UTC / 5:25 PM ET)
//
// Each chunk merges its results into the Firestore pool.
//
// Security: Vercel sends Authorization: Bearer <CRON_SECRET>
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { fetchFullUniverse } from "@/lib/fmp-batch-fetcher";
import { mergeStockPool, saveStockPool } from "@/lib/stock-pool-store";
import { generateMockStocks } from "@/lib/mock-data";
import { isTradingDay } from "@/lib/market-calendar";
import { buildFullUniverse, chunkUniverse } from "@/lib/universe-provider";
import { hasRateLimitErrors } from "@/lib/api-utils";

// Allow up to 300s for larger chunks
export const maxDuration = 300;

const TOTAL_CHUNKS = 6;

export async function GET(request: NextRequest) {
  // ---- Security: verify Vercel cron secret ----
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  if (isProd && !cronSecret) {
    console.error("[cron] CRON_SECRET is not configured in production.");
    return NextResponse.json(
      { error: "CONFIGURATION_ERROR", message: "CRON_SECRET environment variable is missing" },
      { status: 500 }
    );
  }

  // Require authorization if CRON_SECRET is set, or if in production
  if (cronSecret || isProd) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn("[cron] Unauthorized cron request blocked.");
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Invalid CRON_SECRET" },
        { status: 401 }
      );
    }
  }

  // ---- Parse chunk parameter ----
  const chunkParam = request.nextUrl.searchParams.get("chunk");
  const chunkIndex = chunkParam ? parseInt(chunkParam, 10) - 1 : -1; // 0-indexed internally

  // ---- Skip non-trading days ----
  if (!isTradingDay()) {
    console.log("[cron] Today is not a trading day, skipping refresh.");
    return NextResponse.json({
      status: "skipped",
      reason: "not_trading_day",
      message: "Market is closed today (weekend or holiday).",
      timestamp: new Date().toISOString(),
    });
  }

  // ---- Check FMP API key ----
  if (!process.env.FMP_API_KEY) {
    console.log("[cron] No FMP_API_KEY, storing mock data.");
    const mockStocks = generateMockStocks();
    const meta = await saveStockPool(mockStocks, "mock", 0);
    return NextResponse.json({
      status: "ok",
      source: "mock",
      meta,
      message: "Stored mock data (no FMP_API_KEY configured).",
    });
  }

  // ---- Build full universe and select chunk ----
  try {
    const startMs = Date.now();
    const fullUniverse = await buildFullUniverse();
    console.log(`[cron] Full universe: ${fullUniverse.length} symbols`);

    let symbols: string[];
    let chunkLabel: string;

    if (chunkIndex >= 0 && chunkIndex < TOTAL_CHUNKS) {
      symbols = chunkUniverse(fullUniverse, TOTAL_CHUNKS, chunkIndex);
      chunkLabel = `chunk ${chunkIndex + 1}/${TOTAL_CHUNKS}`;
    } else {
      // No chunk specified → process entire universe (for manual triggers)
      // WARNING: may timeout for large universes on Vercel
      symbols = fullUniverse;
      chunkLabel = `full (${symbols.length} symbols)`;
    }

    console.log(`[cron] Processing ${chunkLabel}: ${symbols.length} symbols`);

    // ---- Fetch from FMP ----
    const result = await fetchFullUniverse(symbols);

    const hasRateLimit = hasRateLimitErrors(result.errors);

    if (result.stocks.length === 0 || hasRateLimit) {
      console.warn(`[cron] FMP API limited for ${chunkLabel}, skipping merge.`);
      return NextResponse.json({
        status: "partial",
        chunk: chunkLabel,
        message: "FMP API limited, chunk skipped. Other chunks may still succeed.",
        apiCallsUsed: result.apiCallsUsed,
        errorCount: result.errors.length,
        timestamp: new Date().toISOString(),
      });
    }

    // ---- Merge into Firestore pool ----
    const meta = await mergeStockPool(result.stocks, "fmp", result.apiCallsUsed);
    const durationSec = ((Date.now() - startMs) / 1000).toFixed(1);

    console.log(
      `[cron] ${chunkLabel} complete: ${result.stocks.length} stocks, ` +
      `${result.apiCallsUsed} API calls, ${durationSec}s, ` +
      `pool now has ${meta.symbolCount} total stocks`
    );

    return NextResponse.json({
      status: "ok",
      source: "fmp",
      chunk: chunkLabel,
      meta,
      chunkStocks: result.stocks.length,
      apiCallsUsed: result.apiCallsUsed,
      durationSeconds: parseFloat(durationSec),
      errorCount: result.errors.length,
      errors: result.errors.slice(0, 5),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron] Refresh error:", message);
    return NextResponse.json(
      { error: "CRON_REFRESH_ERROR", message, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
