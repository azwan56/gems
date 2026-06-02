// ============================================================
// Rebalancing Early Warning Engine
// Core calculation logic for 60/40 drift and window dressing
// ============================================================

import { HistoricalPrice } from "./rebalance-fetcher";

export interface MacroDriftResult {
  spyReturn: number;
  bndReturn: number;
  spread: number;
  isEquityOutperforming: boolean;
  thresholdExceeded: boolean;
  signal: "SELL_EQUITY" | "BUY_EQUITY" | "NEUTRAL";
}

export interface WindowDressingResult {
  winners: { symbol: string; return: number }[];
  losers: { symbol: string; return: number }[];
}

/**
 * Calculates the cumulative return from an array of historical prices.
 * Handles FMP's default descending sort by re-sorting ascending.
 * Returns 0 for insufficient data or a zero start price.
 */
export function calculateCumulativeReturn(prices: HistoricalPrice[]): number {
  if (!prices || prices.length < 2) return 0;
  
  // Sort ascending by date
  const sorted = [...prices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const startPrice = sorted[0].adjClose ?? sorted[0].close;
  const endPrice = sorted[sorted.length - 1].adjClose ?? sorted[sorted.length - 1].close;
  
  if (!startPrice || startPrice === 0) return 0;
  return ((endPrice - startPrice) / startPrice) * 100;
}

/**
 * Calculates returns for a map of constituent prices.
 * Skips symbols with fewer than 2 price points.
 */
export function calculateConstituentReturns(priceMap: Map<string, HistoricalPrice[]>): { symbol: string; return: number }[] {
  const returns: { symbol: string; return: number }[] = [];
  
  for (const [symbol, prices] of priceMap.entries()) {
    if (prices && prices.length >= 2) {
      returns.push({
        symbol,
        return: calculateCumulativeReturn(prices)
      });
    }
  }
  
  return returns;
}

/**
 * Calculates the macro drift between SPY and BND for a given period.
 * Threshold is typically 3% to 5% spread to trigger a strong signal.
 *
 * Signal logic:
 * - SELL_EQUITY: Equities overheated → institutions sell stocks, buy bonds
 * - BUY_EQUITY: Equities oversold → institutions buy stocks, sell bonds
 * - NEUTRAL: Drift within normal range
 */
export function calculateMacroDrift(
  spyPrices: HistoricalPrice[],
  bndPrices: HistoricalPrice[],
  thresholdPercent: number = 3.0
): MacroDriftResult {
  const spyReturn = calculateCumulativeReturn(spyPrices);
  const bndReturn = calculateCumulativeReturn(bndPrices);
  
  const spread = spyReturn - bndReturn;
  const isEquityOutperforming = spread > 0;
  const thresholdExceeded = Math.abs(spread) >= thresholdPercent;
  
  let signal: "SELL_EQUITY" | "BUY_EQUITY" | "NEUTRAL" = "NEUTRAL";
  if (thresholdExceeded) {
    signal = isEquityOutperforming ? "SELL_EQUITY" : "BUY_EQUITY";
  }

  return {
    spyReturn,
    bndReturn,
    spread,
    isEquityOutperforming,
    thresholdExceeded,
    signal
  };
}

/**
 * Identifies window dressing candidates based on constituent returns.
 * Winners are the top percentile, losers are the bottom percentile.
 *
 * - Winners: likely to see institutional buy momentum at quarter end
 * - Losers: likely to be dumped by fund managers to hide poor picks
 */
export function identifyWindowDressing(
  constituentReturns: { symbol: string; return: number }[],
  percentile: number = 0.10 // Top/Bottom 10%
): WindowDressingResult {
  if (!constituentReturns || constituentReturns.length === 0) {
    return { winners: [], losers: [] };
  }

  // Sort descending by return
  const sorted = [...constituentReturns].sort((a, b) => b.return - a.return);
  
  const cutoffCount = Math.max(1, Math.floor(sorted.length * percentile));
  
  const winners = sorted.slice(0, cutoffCount);
  const losers = sorted.slice(-cutoffCount).reverse(); // Reverse so worst is first

  return {
    winners,
    losers
  };
}

/**
 * Helper to determine the start date for MTD or QTD calculations.
 * Always returns the first calendar day of the period.
 */
export function getPeriodStartDate(currentDate: Date, period: "MTD" | "QTD"): string {
  const date = new Date(currentDate);
  if (period === "MTD") {
    date.setDate(1);
  } else if (period === "QTD") {
    const currentMonth = date.getMonth();
    const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
    date.setMonth(quarterStartMonth, 1);
  }
  return date.toISOString().split("T")[0];
}

/**
 * Checks if a given date is within the "end of period" warning window.
 *
 * Uses calendar days from the last day of the month (not trading days).
 * For a 7-day window on a 31-day month, this activates on the 24th or later.
 *
 * The time component is zeroed out so that `Math.ceil` doesn't
 * produce off-by-one errors when the cron runs at 21:30 UTC.
 */
export function isWithinWarningWindow(
  currentDate: Date,
  daysWarning: number = 7,
  checkQuarterly: boolean = false
): boolean {
  const d = new Date(currentDate);
  const month = d.getMonth();
  
  // Zero out time to avoid fractional-day rounding issues
  d.setHours(0, 0, 0, 0);
  
  // Find last day of current month (day 0 of next month = last day of this month)
  const lastDayOfMonth = new Date(d.getFullYear(), month + 1, 0);
  lastDayOfMonth.setHours(0, 0, 0, 0);
  
  const diffTime = Math.abs(lastDayOfMonth.getTime() - d.getTime());
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  const isMonthEnd = diffDays <= daysWarning;
  
  if (checkQuarterly) {
    // End of quarter months: March (2), June (5), September (8), December (11)
    const isQuarterEndMonth = [2, 5, 8, 11].includes(month);
    return isQuarterEndMonth && isMonthEnd;
  }
  
  return isMonthEnd;
}
