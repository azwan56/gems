// ============================================================
// GET /api/cron/rebalance-alert — Vercel Cron Job
//
// Runs daily at 13:30 UTC (8:30 AM ET, 1 hour before market open)
// on weekdays. Fires alerts on exactly TWO dates each month:
//
//   T-5: 5 trading days before the last trading day of the month
//   T-2: 2 trading days before the last trading day of the month
//
// Each alert:
//   1. Calculates 60/40 macro drift (SPY vs BND)
//   2. If threshold exceeded → fetches NASDAQ-100 constituent
//      prices for window dressing analysis
//   3. Dispatches a rich Discord embed via webhook
//
// Manual trigger: ?force=true (requires CRON_SECRET in prod)
//
// Security: Vercel sends Authorization: Bearer <CRON_SECRET>
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { fetchHistoricalPrices, fetchIndexConstituents, batchFetchConstituentPrices } from "@/lib/rebalance-fetcher";
import { 
  calculateMacroDrift, 
  getPeriodStartDate, 
  isWithinWarningWindow, 
  identifyWindowDressing,
  calculateConstituentReturns,
  WindowDressingResult 
} from "@/lib/rebalance-engine";
import { fanOutAlerts, RebalanceAlertPayload } from "@/lib/webhook-notifier";
import { saveAlertSnapshot } from "@/lib/rebalance-store";
import { isTradingDay, tradingDaysUntilMonthEnd } from "@/lib/market-calendar";

/** Alert fires on these exact T-minus trading-day positions */
const ALERT_TRIGGER_DAYS = [5, 2];

// Allow up to 300s for large constituent fetches
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  // ---- Security: verify Vercel cron secret ----
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  if (isProd && !cronSecret) {
    console.error("[rebalance] CRON_SECRET is not configured in production.");
    return NextResponse.json(
      { error: "CONFIGURATION_ERROR", message: "CRON_SECRET environment variable is missing" },
      { status: 500 }
    );
  }

  // In production, always require the cron secret.
  // In dev, require it only if it's configured (allows local testing without it).
  if (cronSecret || isProd) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn("[rebalance] Unauthorized request blocked.");
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Invalid CRON_SECRET" },
        { status: 401 }
      );
    }
  }

  // ---- Parse force flag ----
  // force=true bypasses the schedule check, but NOT the auth check above.
  const force = request.nextUrl.searchParams.get("force") === "true";

  // ---- Skip non-trading days (unless forced) ----
  if (!isTradingDay() && !force) {
    return NextResponse.json({
      status: "skipped",
      reason: "not_trading_day",
      message: "Market is closed today (weekend or holiday).",
    });
  }

  // ---- Check T-minus schedule ----
  const tdRemaining = tradingDaysUntilMonthEnd();
  const isTriggerDay = ALERT_TRIGGER_DAYS.includes(tdRemaining);

  if (!isTriggerDay && !force) {
    return NextResponse.json({
      status: "skipped",
      reason: "not_alert_day",
      message: `Today is T-${tdRemaining} from month end. Alerts fire on T-${ALERT_TRIGGER_DAYS.join(" and T-")}.`,
    });
  }

  const alertLabel = `T-${tdRemaining}`;
  console.log(`[rebalance] 🔔 Alert triggered: ${alertLabel} from month-end.`);

  // ---- Validate FMP API key ----
  if (!process.env.FMP_API_KEY) {
    return NextResponse.json(
      { error: "CONFIGURATION_ERROR", message: "FMP_API_KEY is not configured." },
      { status: 500 }
    );
  }

  const currentDate = new Date();

  try {
    // ---- Determine Period (MTD or QTD) ----
    // Quarter-end months (Mar, Jun, Sep, Dec) use QTD; otherwise MTD
    const month = currentDate.getMonth();
    const isQuarterEndMonth = [2, 5, 8, 11].includes(month);
    const period = isQuarterEndMonth ? "QTD" : "MTD";
    
    const startDate = getPeriodStartDate(currentDate, period);
    const toDate = currentDate.toISOString().split("T")[0];

    console.log(`[rebalance] Running for period: ${period} (${startDate} to ${toDate}), force=${force}`);

    // ---- Fetch Macro Data (2 API calls: SPY + BND) ----
    const [spyPrices, bndPrices] = await Promise.all([
      fetchHistoricalPrices("SPY", startDate, toDate),
      fetchHistoricalPrices("BND", startDate, toDate)
    ]);

    if (!spyPrices.length || !bndPrices.length) {
      return NextResponse.json(
        { error: "DATA_ERROR", message: "Failed to fetch historical prices for SPY or BND." },
        { status: 500 }
      );
    }

    // ---- Calculate Macro Drift ----
    const macroResult = calculateMacroDrift(spyPrices, bndPrices, 3.0); // 3% threshold

    // ---- Fetch Micro Data (only when threshold exceeded or forced) ----
    let microResult: WindowDressingResult | undefined = undefined;
    let microApiCalls = 0;
    
    if (macroResult.thresholdExceeded || force) {
      console.log(`[rebalance] Fetching micro anomaly data (NASDAQ-100 constituents)...`);
      
      const constituents = await fetchIndexConstituents("nasdaq100");
      if (constituents.length > 0) {
        const symbols = constituents.map(c => c.symbol);
        microApiCalls = symbols.length + 1; // 1 for constituent list + N for prices
        
        // Fetch prices in parallel batches
        const constituentPrices = await batchFetchConstituentPrices(symbols, startDate, toDate);
        
        // Compute returns and rank
        const constituentReturns = calculateConstituentReturns(constituentPrices);
        microResult = identifyWindowDressing(constituentReturns, 0.10); // Top/Bottom 10%
        
        console.log(`[rebalance] Found ${microResult.winners.length} winners and ${microResult.losers.length} losers from ${constituentReturns.length} constituents.`);
      }
    }

    // ---- Build payload ----
    const payload: RebalanceAlertPayload = {
      period,
      date: toDate,
      macro: macroResult,
      micro: microResult
    };

    // ---- Fan out alerts (system + per-user webhooks) ----
    let alertResult = { sent: 0, failed: 0 };
    if (macroResult.thresholdExceeded || force) {
      alertResult = await fanOutAlerts(payload);
    } else {
      console.log(`[rebalance] Drift (${macroResult.spread.toFixed(2)}%) below threshold. No alert sent.`);
    }

    // ---- Save snapshot to Firestore (for dashboard) ----
    await saveAlertSnapshot({
      date: toDate,
      period,
      macro: macroResult,
      micro: microResult ?? null,
      alertsSent: alertResult.sent,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      status: "ok",
      period,
      macro: macroResult,
      microSummary: microResult ? {
        winnersCount: microResult.winners.length,
        losersCount: microResult.losers.length,
        topWinner: microResult.winners[0]?.symbol ?? null,
        topLoser: microResult.losers[0]?.symbol ?? null,
      } : null,
      alerts: alertResult,
      apiCallsUsed: 2 + microApiCalls,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[rebalance] Error:", message);
    return NextResponse.json(
      { error: "ENGINE_ERROR", message, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
