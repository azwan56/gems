// ============================================================
// Screener engine: applies quantitative filters to stock data
// This is the core business logic, decoupled from data sources
// ============================================================

import { StockMetrics, FilterCriterion, ScreenerRequest, ScreenerResponse } from "./types";

/**
 * Evaluate a single filter criterion against a stock's metrics.
 * Returns true if the stock passes the filter.
 */
export function evaluateFilter(
  stock: StockMetrics,
  filter: FilterCriterion
): boolean {
  const rawValue = stock[filter.field];

  // If the metric is null/undefined, the stock does not pass the filter
  if (rawValue === null || rawValue === undefined) {
    return false;
  }

  // Only numeric comparisons are supported
  if (typeof rawValue !== "number") {
    return false;
  }

  switch (filter.operator) {
    case "gt":
      return rawValue > filter.value;
    case "lt":
      return rawValue < filter.value;
    case "gte":
      return rawValue >= filter.value;
    case "lte":
      return rawValue <= filter.value;
    case "eq":
      return rawValue === filter.value;
    case "between":
      return rawValue >= filter.value && rawValue <= (filter.valueTo ?? filter.value);
    default:
      return false;
  }
}

/**
 * Apply all filters to a list of stocks.
 * A stock must pass ALL filters (AND logic).
 */
export function applyFilters(
  stocks: StockMetrics[],
  filters: FilterCriterion[]
): StockMetrics[] {
  if (filters.length === 0) return stocks;
  return stocks.filter((stock) =>
    filters.every((filter) => evaluateFilter(stock, filter))
  );
}

function clamp(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Calculate quantitative scores for a stock (Fundamental Score, Technical Score, Total Combined Score).
 */
export function enrichStockScores(stock: StockMetrics): StockMetrics {
  const price = stock.price || 0;
  const p50 = stock.priceVs50SMA ?? 0;
  const p200 = stock.priceVs200SMA ?? 0;
  const h52 = stock.fiftyTwoWeekHigh || 0;
  const l52 = stock.fiftyTwoWeekLow || 0;

  // Technical Sub-scores (0-100)
  let h52Pos = 50.0;
  if (price > 0 && h52 > l52 && h52 > 0) {
    h52Pos = clamp(((price - l52) / (h52 - l52)) * 100);
  }
  const sma50Score = clamp(((p50 - (-20)) / 40) * 100);
  const sma200Score = p200 < -20 ? 0 : clamp(((p200 - (-20)) / 40) * 100);
  const computedTech = Math.round(sma50Score * 0.40 + sma200Score * 0.30 + h52Pos * 0.30);
  const technicalScore = stock.technicalScore ?? computedTech;

  // Fundamental Sub-scores (0-100)
  const roe = stock.roe ?? 15;
  const gm = stock.grossMargin ?? 40;
  const revG = stock.revenueGrowthYoY ?? 20;
  const epsG = stock.epsGrowthYoY ?? 20;
  const fcfY = stock.freeCashFlowYield ?? 5;
  const cr = stock.currentRatio ?? 1.5;

  const fRoe = clamp((roe / 30) * 100);
  const fGm = clamp(((gm - 10) / 70) * 100);
  const fRev = clamp((revG / 40) * 100);
  const fEps = clamp((epsG / 40) * 100);
  const fFcf = clamp((fcfY / 10) * 100);
  const fCr = clamp(((cr - 0.5) / 2.5) * 100);
  const computedFund = Math.round(fRoe * 0.15 + fGm * 0.15 + fRev * 0.20 + fEps * 0.20 + fFcf * 0.20 + fCr * 0.10);
  const fundamentalScore = stock.fundamentalScore ?? computedFund;

  // Total Score = Fundamental Score + Technical Score
  const totalScore = stock.totalScore ?? (fundamentalScore + technicalScore);

  return {
    ...stock,
    technicalScore,
    fundamentalScore,
    totalScore,
  };
}

/**
 * Sort stocks by a given field and direction.
 */
export function sortStocks(
  stocks: StockMetrics[],
  sortBy: keyof StockMetrics,
  sortOrder: "asc" | "desc" = "desc"
): StockMetrics[] {
  const enriched = stocks.map(enrichStockScores);
  return [...enriched].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];

    // Nulls go to the end
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    }

    // String comparison
    const aStr = String(aVal);
    const bStr = String(bVal);
    return sortOrder === "asc"
      ? aStr.localeCompare(bStr)
      : bStr.localeCompare(aStr);
  });
}

/**
 * Full screener pipeline: filter → sort → paginate.
 */
export function executeScreener(
  allStocks: StockMetrics[],
  request: ScreenerRequest
): ScreenerResponse {
  // 1. Apply filters
  const filtered = applyFilters(allStocks, request.filters);

  // 2. Enrich & Sort by totalScore (SUM of Fundamental + Technical Score) by default
  const sortBy = request.sortBy ?? "totalScore";
  const sortOrder = request.sortOrder ?? "desc";
  const sorted = sortStocks(filtered, sortBy, sortOrder);

  // 3. Paginate
  const limit = request.limit ?? 20;
  const offset = request.offset ?? 0;
  const paginated = sorted.slice(offset, offset + limit);

  return {
    stocks: paginated,
    total: filtered.length,
    limit,
    offset,
    strategy: request.strategy,
    appliedFilters: request.filters,
  };
}
