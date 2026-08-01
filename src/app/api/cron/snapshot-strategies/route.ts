import { NextRequest, NextResponse } from "next/server";
import { loadStockPool } from "@/lib/stock-pool-store";
import { STRATEGY_PRESETS } from "@/lib/strategies";
import { executeScreener } from "@/lib/screener-engine";
import { updateStrategyRoster } from "@/lib/strategy-roster-store";

/**
 * GET: Run by a Vercel cron job to capture periodic snapshots of quantitative strategies.
 * This effectively rebalances the "virtual tracking portfolio" for each strategy,
 * allowing for accurate historical backtesting.
 */
export async function GET(request: NextRequest) {
  try {
    // Vercel Cron authorization (optional but recommended)
    const authHeader = request.headers.get("authorization");
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const poolData = await loadStockPool();
    if (!poolData || poolData.stocks.length === 0) {
      return NextResponse.json({ error: "No stock pool data available to snapshot." }, { status: 500 });
    }

    const results: Record<string, number> = {};

    for (const [strategyId, preset] of Object.entries(STRATEGY_PRESETS)) {
      // Seeking Alpha is a manual list, not a quantitative screener.
      if (strategyId === "seeking_alpha") continue;

      // Run the screener against the latest pool
      const response = executeScreener(poolData.stocks, {
        strategy: strategyId as any,
        filters: preset.defaultFilters,
        // We only care about the filtered stocks, don't paginate (use large limit)
        limit: 1000, 
      });

      // Update the roster
      await updateStrategyRoster(strategyId, response.stocks);
      results[strategyId] = response.stocks.length;
    }

    return NextResponse.json({
      success: true,
      message: "Strategy rosters updated successfully.",
      snapshots: results,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error("[Cron: snapshot-strategies] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
