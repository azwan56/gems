// ============================================================
// Unit + Integration Tests: Screener Engine
// Tests the core filter, sort, and pagination logic
// ============================================================

import { describe, it, expect } from "vitest";
import { evaluateFilter, applyFilters, sortStocks, executeScreener } from "@/lib/screener-engine";
import { StockMetrics, FilterCriterion, ScreenerRequest } from "@/lib/types";

// ---- Test fixtures ----
const makeStock = (overrides: Partial<StockMetrics> = {}): StockMetrics => ({
  symbol: "TEST",
  companyName: "Test Corp",
  sector: "Technology",
  industry: "Software",
  marketCap: 10_000_000_000,
  price: 100,
  peRatio: 15,
  pbRatio: 2.0,
  freeCashFlowYield: 5,
  dividendYield: 1.5,
  currentRatio: 1.5,
  debtToEquity: 0.5,
  revenueGrowthYoY: 25,
  epsGrowthYoY: 20,
  pegRatio: 0.8,
  roe: 18,
  grossMargin: 60,
  netMargin: 20,
  priceVs50SMA: 3,
  priceVs200SMA: 10,
  fiftyTwoWeekHigh: 120,
  fiftyTwoWeekLow: 80,
  ...overrides,
});

const stockPool: StockMetrics[] = [
  makeStock({ symbol: "VAL1", peRatio: 8, pbRatio: 0.9, freeCashFlowYield: 10, currentRatio: 2.0, marketCap: 5_000_000_000 }),
  makeStock({ symbol: "VAL2", peRatio: 12, pbRatio: 1.2, freeCashFlowYield: 7, currentRatio: 1.5, marketCap: 3_000_000_000 }),
  makeStock({ symbol: "GROW1", peRatio: 60, pbRatio: 20, revenueGrowthYoY: 50, epsGrowthYoY: 80, pegRatio: 0.7, roe: 30, marketCap: 800_000_000 }),
  makeStock({ symbol: "GROW2", peRatio: 45, pbRatio: 15, revenueGrowthYoY: 25, epsGrowthYoY: 18, pegRatio: 1.2, roe: 20, marketCap: 2_000_000_000 }),
  makeStock({ symbol: "JUNK", peRatio: -5, pbRatio: 0.3, freeCashFlowYield: -3, currentRatio: 0.5, revenueGrowthYoY: -20, epsGrowthYoY: -50, pegRatio: -1, roe: -5, marketCap: 200_000_000 }),
  makeStock({ symbol: "NULLS", peRatio: null, pbRatio: null, freeCashFlowYield: null, currentRatio: null, revenueGrowthYoY: null, epsGrowthYoY: null, pegRatio: null, roe: null }),
];

// ---- evaluateFilter ----
describe("evaluateFilter", () => {
  it("should return true for gt operator when value is greater", () => {
    const stock = makeStock({ peRatio: 20 });
    expect(evaluateFilter(stock, { field: "peRatio", operator: "gt", value: 15 })).toBe(true);
  });

  it("should return false for gt operator when value is equal", () => {
    const stock = makeStock({ peRatio: 15 });
    expect(evaluateFilter(stock, { field: "peRatio", operator: "gt", value: 15 })).toBe(false);
  });

  it("should return true for lt operator when value is less", () => {
    const stock = makeStock({ peRatio: 10 });
    expect(evaluateFilter(stock, { field: "peRatio", operator: "lt", value: 15 })).toBe(true);
  });

  it("should return true for gte operator when value is equal", () => {
    const stock = makeStock({ roe: 15 });
    expect(evaluateFilter(stock, { field: "roe", operator: "gte", value: 15 })).toBe(true);
  });

  it("should return true for lte operator when value is equal", () => {
    const stock = makeStock({ pbRatio: 1.5 });
    expect(evaluateFilter(stock, { field: "pbRatio", operator: "lte", value: 1.5 })).toBe(true);
  });

  it("should return true for eq operator when values match", () => {
    const stock = makeStock({ peRatio: 15 });
    expect(evaluateFilter(stock, { field: "peRatio", operator: "eq", value: 15 })).toBe(true);
  });

  it("should return true for between operator when value is in range", () => {
    const stock = makeStock({ peRatio: 12 });
    expect(evaluateFilter(stock, { field: "peRatio", operator: "between", value: 10, valueTo: 15 })).toBe(true);
  });

  it("should return false for between operator when value is out of range", () => {
    const stock = makeStock({ peRatio: 20 });
    expect(evaluateFilter(stock, { field: "peRatio", operator: "between", value: 10, valueTo: 15 })).toBe(false);
  });

  it("should return false when metric is null", () => {
    const stock = makeStock({ peRatio: null });
    expect(evaluateFilter(stock, { field: "peRatio", operator: "gt", value: 0 })).toBe(false);
  });

  it("should return false for non-numeric fields", () => {
    const stock = makeStock({ symbol: "AAPL" });
    // symbol is a string, so numeric operators should fail
    expect(evaluateFilter(stock, { field: "symbol", operator: "gt", value: 0 })).toBe(false);
  });
});

// ---- applyFilters ----
describe("applyFilters", () => {
  it("should return all stocks when no filters applied", () => {
    const result = applyFilters(stockPool, []);
    expect(result).toHaveLength(stockPool.length);
  });

  it("should filter value stocks with P/E < 15 and P/E > 0", () => {
    const filters: FilterCriterion[] = [
      { field: "peRatio", operator: "gt", value: 0 },
      { field: "peRatio", operator: "lt", value: 15 },
    ];
    const result = applyFilters(stockPool, filters);
    expect(result.every((s) => s.peRatio !== null && s.peRatio > 0 && s.peRatio < 15)).toBe(true);
    expect(result.map((s) => s.symbol)).toContain("VAL1");
    expect(result.map((s) => s.symbol)).toContain("VAL2");
    expect(result.map((s) => s.symbol)).not.toContain("GROW1");
    expect(result.map((s) => s.symbol)).not.toContain("JUNK");
    expect(result.map((s) => s.symbol)).not.toContain("NULLS");
  });

  it("should correctly apply full value strategy filters", () => {
    const filters: FilterCriterion[] = [
      { field: "peRatio", operator: "gt", value: 0 },
      { field: "peRatio", operator: "lt", value: 15 },
      { field: "pbRatio", operator: "gt", value: 0 },
      { field: "pbRatio", operator: "lt", value: 1.5 },
      { field: "freeCashFlowYield", operator: "gt", value: 5 },
      { field: "currentRatio", operator: "gt", value: 1.2 },
    ];
    const result = applyFilters(stockPool, filters);
    // Only VAL1 should pass all filters (VAL2's P/B is 1.2, not < 1.5 but lte would pass. lt means strictly less)
    expect(result.map((s) => s.symbol)).toContain("VAL1");
  });

  it("should correctly apply growth strategy filters", () => {
    const filters: FilterCriterion[] = [
      { field: "revenueGrowthYoY", operator: "gt", value: 20 },
      { field: "epsGrowthYoY", operator: "gt", value: 15 },
      { field: "pegRatio", operator: "gt", value: 0 },
      { field: "pegRatio", operator: "lt", value: 1.5 },
      { field: "roe", operator: "gt", value: 15 },
    ];
    const result = applyFilters(stockPool, filters);
    expect(result.map((s) => s.symbol)).toContain("GROW1");
    expect(result.map((s) => s.symbol)).toContain("GROW2");
    expect(result.map((s) => s.symbol)).not.toContain("JUNK");
  });

  it("should exclude stocks with null metrics", () => {
    const filters: FilterCriterion[] = [
      { field: "peRatio", operator: "gt", value: 0 },
    ];
    const result = applyFilters(stockPool, filters);
    expect(result.map((s) => s.symbol)).not.toContain("NULLS");
  });
});

// ---- sortStocks ----
describe("sortStocks", () => {
  it("should sort by marketCap descending by default", () => {
    const sorted = sortStocks(stockPool, "marketCap", "desc");
    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = sorted[i].marketCap;
      const next = sorted[i + 1].marketCap;
      expect(curr).toBeGreaterThanOrEqual(next);
    }
  });

  it("should sort by peRatio ascending", () => {
    // Filter out nulls for clean test
    const nonNull = stockPool.filter((s) => s.peRatio !== null);
    const sorted = sortStocks(nonNull, "peRatio", "asc");
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].peRatio!).toBeLessThanOrEqual(sorted[i + 1].peRatio!);
    }
  });

  it("should push null values to the end", () => {
    const sorted = sortStocks(stockPool, "peRatio", "desc");
    const lastItem = sorted[sorted.length - 1];
    expect(lastItem.peRatio).toBeNull();
  });

  it("should sort strings (symbol) alphabetically", () => {
    const sorted = sortStocks(stockPool, "symbol", "asc");
    expect(sorted[0].symbol.localeCompare(sorted[1].symbol)).toBeLessThanOrEqual(0);
  });
});

// ---- executeScreener ----
describe("executeScreener", () => {
  it("should filter, sort, and paginate in one call", () => {
    const request: ScreenerRequest = {
      strategy: "value",
      filters: [
        { field: "peRatio", operator: "gt", value: 0 },
        { field: "peRatio", operator: "lt", value: 15 },
      ],
      sortBy: "peRatio",
      sortOrder: "asc",
      limit: 10,
      offset: 0,
    };
    const result = executeScreener(stockPool, request);

    expect(result.strategy).toBe("value");
    expect(result.total).toBeGreaterThan(0);
    expect(result.stocks.length).toBeLessThanOrEqual(10);
    expect(result.appliedFilters).toEqual(request.filters);
    // Should be sorted ascending
    for (let i = 0; i < result.stocks.length - 1; i++) {
      expect(result.stocks[i].peRatio!).toBeLessThanOrEqual(result.stocks[i + 1].peRatio!);
    }
  });

  it("should handle pagination correctly", () => {
    const baseRequest: ScreenerRequest = {
      strategy: "large_growth",
      filters: [],
      limit: 2,
      offset: 0,
    };
    const page1 = executeScreener(stockPool, baseRequest);
    expect(page1.stocks.length).toBe(2);
    expect(page1.total).toBe(stockPool.length);

    const page2 = executeScreener(stockPool, { ...baseRequest, offset: 2 });
    expect(page2.stocks.length).toBe(2);
    // Pages should not overlap
    expect(page1.stocks[0].symbol).not.toBe(page2.stocks[0].symbol);
  });

  it("should default to marketCap desc sorting when no sortBy given", () => {
    const request: ScreenerRequest = {
      strategy: "value",
      filters: [],
    };
    const result = executeScreener(stockPool, request);
    for (let i = 0; i < result.stocks.length - 1; i++) {
      expect(result.stocks[i].marketCap).toBeGreaterThanOrEqual(result.stocks[i + 1].marketCap);
    }
  });
});
