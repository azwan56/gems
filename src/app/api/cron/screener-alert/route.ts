// ============================================================
// GET /api/cron/screener-alert — Vercel Cron Job
//
// Runs daily at 21:35 UTC (after the last pool refresh chunk
// finishes at ~21:25 UTC). For each strategy (including SA),
// re-runs the screener, diffs against the previous snapshot,
// and sends Discord + email notifications when stocks change.
//
// Manual trigger: ?force=true (requires CRON_SECRET in prod)
//
// Security: Vercel sends Authorization: Bearer <CRON_SECRET>
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { loadStockPool } from "@/lib/stock-pool-store";
import { applyFilters } from "@/lib/screener-engine";
import { STRATEGY_PRESETS } from "@/lib/strategies";
import { loadSAList } from "@/lib/seeking-alpha-store";
import { StockMetrics } from "@/lib/types";
import {
  loadScreenerSnapshot,
  saveScreenerSnapshot,
  diffSnapshots,
  ScreenerDiff,
} from "@/lib/screener-snapshot-store";
import { fanOutScreenerAlerts } from "@/lib/webhook-notifier";
import { isTradingDay } from "@/lib/market-calendar";

// All strategies to monitor (including seeking_alpha)
const MONITORED_STRATEGIES = ["value", "large_growth", "small_growth", "seeking_alpha"] as const;

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // ---- Security: verify Vercel cron secret ----
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  if (isProd && !cronSecret) {
    console.error("[screener-alert] CRON_SECRET is not configured in production.");
    return NextResponse.json(
      { error: "CONFIGURATION_ERROR", message: "CRON_SECRET environment variable is missing" },
      { status: 500 }
    );
  }

  if (cronSecret || isProd) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn("[screener-alert] Unauthorized request blocked.");
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Invalid CRON_SECRET" },
        { status: 401 }
      );
    }
  }

  // ---- Parse force flag ----
  const force = request.nextUrl.searchParams.get("force") === "true";

  // ---- Skip non-trading days (unless forced) ----
  if (!isTradingDay() && !force) {
    return NextResponse.json({
      status: "skipped",
      reason: "not_trading_day",
      message: "Market is closed today (weekend or holiday).",
    });
  }

  try {
    // ---- Load stock pool ----
    const pool = await loadStockPool();
    if (!pool || pool.stocks.length === 0) {
      return NextResponse.json({
        status: "skipped",
        reason: "empty_pool",
        message: "Stock pool is empty. Wait for pool refresh to complete.",
      });
    }

    console.log(`[screener-alert] Running diff on ${pool.stocks.length} stocks across ${MONITORED_STRATEGIES.length} strategies`);

    // ---- Pre-load SA list for seeking_alpha strategy ----
    let saSymbols: string[] = [];
    try {
      const saList = await loadSAList();
      saSymbols = saList.symbols;
    } catch {
      console.warn("[screener-alert] Failed to load SA list, skipping SA strategy.");
    }

    // ---- Run screener + diff for each strategy ----
    const allDiffs: ScreenerDiff[] = [];
    let totalAdded = 0;
    let totalRemoved = 0;

    for (const strategyId of MONITORED_STRATEGIES) {
      const preset = STRATEGY_PRESETS[strategyId];
      if (!preset) continue;

      let filtered: StockMetrics[];

      if (strategyId === "seeking_alpha") {
        // SA strategy: match pool stocks against the SA symbol list
        // No quantitative filters — the "screener result" IS the SA list
        const saSet = new Set(saSymbols.map((s) => s.toUpperCase()));
        filtered = pool.stocks.filter((s) => saSet.has(s.symbol.toUpperCase()));
      } else {
        // Normal strategy: apply default filters
        filtered = applyFilters(pool.stocks, preset.defaultFilters);
      }

      // Load previous snapshot
      const previous = await loadScreenerSnapshot(strategyId);

      // Diff
      const diff = diffSnapshots(
        previous,
        filtered,
        strategyId,
        preset.name,
        preset.nameZh
      );

      allDiffs.push(diff);
      totalAdded += diff.added.length;
      totalRemoved += diff.removed.length;

      console.log(
        `[screener-alert] ${preset.name}: ${filtered.length} current, ` +
        `${previous?.symbolCount ?? 0} previous, ` +
        `+${diff.added.length} new, -${diff.removed.length} removed`
      );

      // Save new snapshot (always, so next diff is against today)
      await saveScreenerSnapshot(strategyId, filtered);
    }

    // ---- Send notifications if there are changes ----
    let alertResult = { sent: 0, failed: 0 };
    const hasChanges = totalAdded > 0 || totalRemoved > 0;

    if (hasChanges || force) {
      alertResult = await fanOutScreenerAlerts(allDiffs);
      console.log(
        `[screener-alert] Alerts dispatched: ${alertResult.sent} sent, ${alertResult.failed} failed`
      );
    } else {
      console.log("[screener-alert] No changes detected, skipping notification.");
    }

    return NextResponse.json({
      status: "ok",
      totalAdded,
      totalRemoved,
      strategies: allDiffs.map((d) => ({
        strategyId: d.strategyId,
        name: d.strategyName,
        currentCount: d.currentCount,
        previousCount: d.previousCount,
        added: d.added.map((s) => s.symbol),
        removed: d.removed,
      })),
      alerts: alertResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[screener-alert] Error:", message);
    return NextResponse.json(
      { error: "SCREENER_ALERT_ERROR", message, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
