// ============================================================
// Monthly Retrospective Engine
// Compares previous month's predictions against actual outcomes
// to generate an accuracy report for premium users.
// ============================================================

import { fetchHistoricalPrices } from "./rebalance-fetcher";
import { AlertSnapshot, getLatestSnapshots } from "./rebalance-store";

export interface StockOutcome {
  symbol: string;
  predictedReturn: number; // MTD/QTD return at prediction time
  actualReturn: number;    // Return over the validation window (next 2-3 days)
  correct: boolean;        // Did the prediction hold?
}

export interface MacroOutcome {
  spyReturn: number;   // SPY return in validation window
  bndReturn: number;   // BND return in validation window
  spyCorrect: boolean; // Did the equity direction hold?
  bndCorrect: boolean; // Did the bond direction hold?
}

export interface RetrospectiveReport {
  month: string;           // e.g. "2026-05"
  predictionDate: string;  // Date of the original alert
  validationDates: string; // e.g. "May 28-29"
  signal: "SELL_EQUITY" | "BUY_EQUITY" | "NEUTRAL";
  period: "MTD" | "QTD";
  macro: MacroOutcome;
  winnersOutcome: StockOutcome[];
  losersOutcome: StockOutcome[];
  winnersAccuracy: number; // 0.0 - 1.0
  losersAccuracy: number;
  overallAccuracy: number;
  totalPredictions: number;
  totalCorrect: number;
  insights: string[];      // Auto-generated insights
}

/**
 * Calculate close-to-close return between two dates.
 */
function closeToCloseReturn(
  prices: { date: string; close: number }[],
  fromDate: string,
  toDate: string
): number | null {
  const from = prices.find(p => p.date === fromDate);
  const to = prices.find(p => p.date === toDate);
  if (!from || !to || from.close === 0) return null;
  return ((to.close - from.close) / from.close) * 100;
}

/**
 * Find the last trading day on or before a given date in a price array.
 */
function findNearestDate(prices: { date: string }[], targetDate: string): string | null {
  const sorted = [...prices].sort((a, b) => b.date.localeCompare(a.date));
  for (const p of sorted) {
    if (p.date <= targetDate) return p.date;
  }
  return null;
}

/**
 * Get the last N trading days of a month from price data.
 */
function getLastTradingDays(
  prices: { date: string }[],
  year: number,
  month: number, // 0-indexed
  count: number
): string[] {
  const lastDay = new Date(year, month + 1, 0); // Last calendar day
  const lastDateStr = lastDay.toISOString().split("T")[0];
  
  const monthPrices = prices
    .filter(p => {
      const [y, m] = p.date.split("-").map(Number);
      return y === year && m === month + 1;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  return monthPrices.slice(0, count).map(p => p.date).reverse();
}

/**
 * Generate a monthly retrospective report by comparing the last alert
 * snapshot of the previous month against actual market data.
 *
 * @param targetYear  - Year of the month to review (e.g. 2026)
 * @param targetMonth - Month to review, 0-indexed (e.g. 4 = May)
 */
export async function generateRetrospective(
  targetYear: number,
  targetMonth: number
): Promise<RetrospectiveReport | null> {
  const monthStr = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}`;
  
  // 1. Find the alert snapshot for that month
  const snapshots = await getLatestSnapshots(60);
  const monthSnapshots = snapshots.filter(s => s.date.startsWith(monthStr));
  
  if (monthSnapshots.length === 0) {
    console.log(`[Retrospective] No snapshots found for ${monthStr}`);
    return null;
  }

  // Use the last snapshot of the month (closest to month-end)
  const snapshot = monthSnapshots.sort((a, b) => b.date.localeCompare(a.date))[0];
  const predDate = snapshot.date;
  
  console.log(`[Retrospective] Using snapshot from ${predDate} for ${monthStr} review`);

  // 2. Determine validation window: next 2-3 trading days after prediction
  const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0);
  const firstDayNextMonth = new Date(targetYear, targetMonth + 1, 1);
  
  // Fetch SPY prices spanning prediction date through a few days after
  const validationFrom = predDate;
  const validationTo = new Date(firstDayNextMonth.getTime() + 7 * 86400000)
    .toISOString().split("T")[0]; // +7 days into next month for buffer

  const [spyPrices, bndPrices] = await Promise.all([
    fetchHistoricalPrices("SPY", validationFrom, validationTo),
    fetchHistoricalPrices("BND", validationFrom, validationTo),
  ]);

  if (spyPrices.length < 2 || bndPrices.length < 2) {
    console.error("[Retrospective] Insufficient SPY/BND data for validation");
    return null;
  }

  // Sort ascending
  const spySorted = [...spyPrices].sort((a, b) => a.date.localeCompare(b.date));
  const bndSorted = [...bndPrices].sort((a, b) => a.date.localeCompare(b.date));

  // Find the last trading day of the month and 2 days after the prediction
  const tradingDaysAfterPred = spySorted.filter(p => p.date > predDate);
  const validationEnd = tradingDaysAfterPred.length >= 2
    ? tradingDaysAfterPred[1].date
    : tradingDaysAfterPred[0]?.date ?? predDate;

  const validationDates = tradingDaysAfterPred.length >= 2
    ? `${tradingDaysAfterPred[0].date} ~ ${tradingDaysAfterPred[1].date}`
    : tradingDaysAfterPred[0]?.date ?? "N/A";

  // 3. Macro validation
  const spyRet = closeToCloseReturn(spySorted, predDate, validationEnd);
  const bndRet = closeToCloseReturn(bndSorted, predDate, validationEnd);

  let spyCorrect = false;
  let bndCorrect = false;
  if (spyRet !== null && bndRet !== null) {
    if (snapshot.macro.signal === "SELL_EQUITY") {
      spyCorrect = spyRet < 0;        // Expected: stocks fall
      bndCorrect = bndRet > 0;        // Expected: bonds rise
    } else if (snapshot.macro.signal === "BUY_EQUITY") {
      spyCorrect = spyRet > 0;        // Expected: stocks rise
      bndCorrect = bndRet < 0;        // Expected: bonds fall
    }
  }

  const macroOutcome: MacroOutcome = {
    spyReturn: spyRet ?? 0,
    bndReturn: bndRet ?? 0,
    spyCorrect,
    bndCorrect,
  };

  // 4. Micro (window dressing) validation
  const winnersOutcome: StockOutcome[] = [];
  const losersOutcome: StockOutcome[] = [];

  if (snapshot.micro) {
    // Fetch prices for all predicted stocks
    const allStocks = [
      ...snapshot.micro.winners.map(w => ({ ...w, type: "winner" as const })),
      ...snapshot.micro.losers.map(l => ({ ...l, type: "loser" as const })),
    ];

    for (const stock of allStocks) {
      try {
        const prices = await fetchHistoricalPrices(stock.symbol, validationFrom, validationTo);
        const sorted = prices.sort((a, b) => a.date.localeCompare(b.date));
        const ret = closeToCloseReturn(sorted, predDate, validationEnd);

        if (ret !== null) {
          const outcome: StockOutcome = {
            symbol: stock.symbol,
            predictedReturn: stock.return,
            actualReturn: ret,
            correct: stock.type === "winner" ? ret > 0 : ret < 0,
          };

          if (stock.type === "winner") winnersOutcome.push(outcome);
          else losersOutcome.push(outcome);
        }
      } catch {
        // Skip symbols that fail
      }
    }
  }

  // 5. Calculate accuracy
  const winnersCorrect = winnersOutcome.filter(w => w.correct).length;
  const losersCorrect = losersOutcome.filter(l => l.correct).length;
  const winnersAccuracy = winnersOutcome.length > 0 ? winnersCorrect / winnersOutcome.length : 0;
  const losersAccuracy = losersOutcome.length > 0 ? losersCorrect / losersOutcome.length : 0;

  const totalCorrect = winnersCorrect + losersCorrect + (spyCorrect ? 1 : 0) + (bndCorrect ? 1 : 0);
  const totalPredictions = winnersOutcome.length + losersOutcome.length + 2;
  const overallAccuracy = totalCorrect / totalPredictions;

  // 6. Generate insights
  const insights: string[] = [];

  if (winnersAccuracy >= 0.8) {
    insights.push("🏆 Winners signal was highly accurate — window dressing buy momentum was strong this month.");
  } else if (winnersAccuracy >= 0.5) {
    insights.push("🏆 Winners signal was moderately accurate — some momentum stocks continued but not all.");
  } else {
    insights.push("🏆 Winners signal underperformed — the momentum trade was weak this month, possibly due to sector rotation.");
  }

  if (losersAccuracy <= 0.4) {
    insights.push("💀 Losers signal saw significant mean-reversion — most oversold stocks bounced. This confirms our advice to NOT chase shorts on deeply oversold names.");
  } else if (losersAccuracy >= 0.7) {
    insights.push("💀 Losers signal was accurate — selling pressure continued for weak names. Risk-off sentiment was dominant.");
  } else {
    insights.push("💀 Losers showed mixed results — some continued falling while others bounced. Individual catalysts mattered more than window dressing this month.");
  }

  if (spyCorrect && bndCorrect) {
    insights.push("📈 Macro drift signal was fully confirmed — both equity and bond directions matched predictions.");
  } else if (spyCorrect || bndCorrect) {
    insights.push("📈 Macro drift signal was partially confirmed — rebalancing flows were present but offset by other market forces.");
  } else {
    insights.push("📈 Macro drift signal was not confirmed — broader market trends (bull/bear momentum) overwhelmed rebalancing flows this month.");
  }

  return {
    month: monthStr,
    predictionDate: predDate,
    validationDates,
    signal: snapshot.macro.signal,
    period: snapshot.period,
    macro: macroOutcome,
    winnersOutcome,
    losersOutcome,
    winnersAccuracy,
    losersAccuracy,
    overallAccuracy,
    totalPredictions,
    totalCorrect,
    insights,
  };
}
