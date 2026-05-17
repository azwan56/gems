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

/**
 * Sort stocks by a given field and direction.
 */
export function sortStocks(
  stocks: StockMetrics[],
  sortBy: keyof StockMetrics,
  sortOrder: "asc" | "desc" = "desc"
): StockMetrics[] {
  return [...stocks].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];

    // Nulls go to the end
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;

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

  // 2. Sort
  const sortBy = request.sortBy ?? "marketCap";
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
