// ============================================================
// GET /api/cron/rebalance-retrospective — Vercel Cron Job
//
// Runs daily at 13:30 UTC (8:30 AM ET) on weekdays.
// Fires on the FIRST TRADING DAY of each month only.
// Handles weekends and holidays (e.g., Jan 1, Jul 4 observed)
// so the report always arrives before the first market open.
//
// Generates a retrospective report comparing the previous month's
// rebalancing predictions against actual market outcomes, then
// sends the results to all premium users via Discord webhook.
//
// Manual trigger: ?force=true&month=2026-05 (requires CRON_SECRET)
//
// Security: Vercel sends Authorization: Bearer <CRON_SECRET>
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { generateRetrospective } from "@/lib/rebalance-retrospective";
import { fanOutRetrospective } from "@/lib/webhook-notifier";
import { isFirstTradingDayOfMonth } from "@/lib/market-calendar";

// Allow up to 300s for API calls
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  // ---- Security: verify Vercel cron secret ----
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  if (isProd && !cronSecret) {
    return NextResponse.json(
      { error: "CONFIGURATION_ERROR", message: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  if (cronSecret || isProd) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Invalid CRON_SECRET" },
        { status: 401 }
      );
    }
  }

  // ---- Determine which month to review ----
  // Default: previous month. Override with ?month=2026-05
  const monthParam = request.nextUrl.searchParams.get("month");
  const force = request.nextUrl.searchParams.get("force") === "true";
  
  let targetYear: number;
  let targetMonth: number; // 0-indexed

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    targetYear = y;
    targetMonth = m - 1;
  } else {
    // Previous month
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    targetYear = prevMonth.getFullYear();
    targetMonth = prevMonth.getMonth();
  }

  const monthStr = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}`;

  // ---- Skip if not first trading day (unless forced) ----
  if (!isFirstTradingDayOfMonth() && !force) {
    return NextResponse.json({
      status: "skipped",
      reason: "not_first_trading_day",
      message: "Retrospective fires on the first trading day of the month only.",
    });
  }

  // ---- Validate FMP API key ----
  if (!process.env.FMP_API_KEY) {
    return NextResponse.json(
      { error: "CONFIGURATION_ERROR", message: "FMP_API_KEY is not configured." },
      { status: 500 }
    );
  }

  try {
    console.log(`[Retrospective] Generating report for ${monthStr}...`);

    const report = await generateRetrospective(targetYear, targetMonth);

    if (!report) {
      return NextResponse.json({
        status: "skipped",
        reason: "no_data",
        message: `No prediction snapshots found for ${monthStr}. Cannot generate retrospective.`,
      });
    }

    // Fan out to all premium user webhooks
    const alertResult = await fanOutRetrospective(report);

    return NextResponse.json({
      status: "ok",
      month: monthStr,
      predictionDate: report.predictionDate,
      accuracy: {
        overall: `${(report.overallAccuracy * 100).toFixed(0)}%`,
        winners: `${(report.winnersAccuracy * 100).toFixed(0)}%`,
        losers: `${(report.losersAccuracy * 100).toFixed(0)}%`,
        macroSpy: report.macro.spyCorrect,
        macroBnd: report.macro.bndCorrect,
      },
      totalCorrect: report.totalCorrect,
      totalPredictions: report.totalPredictions,
      insights: report.insights,
      alerts: alertResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Retrospective] Error:", message);
    return NextResponse.json(
      { error: "ENGINE_ERROR", message, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
