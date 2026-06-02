// ============================================================
// Tests for screener-snapshot-store diff logic
// ============================================================

import { describe, it, expect } from "vitest";
import { diffSnapshots, toStockSummary, ScreenerSnapshot } from "./screener-snapshot-store";
import { StockMetrics } from "./types";

function makeStock(symbol: string, overrides?: Partial<StockMetrics>): StockMetrics {
  return {
    symbol,
    companyName: `${symbol} Corp`,
    sector: "Technology",
    industry: "Software",
    marketCap: 10_000_000_000,
    price: 100,
    peRatio: 15,
    pbRatio: 2.5,
    freeCashFlowYield: 5,
    dividendYield: 1.5,
    currentRatio: 1.5,
    debtToEquity: 0.5,
    revenueGrowthYoY: 20,
    epsGrowthYoY: 25,
    pegRatio: 1.2,
    roe: 18,
    grossMargin: 60,
    netMargin: 20,
    priceVs50SMA: 5,
    priceVs200SMA: 10,
    fiftyTwoWeekHigh: 110,
    fiftyTwoWeekLow: 80,
    ...overrides,
  };
}

function makeSnapshot(strategyId: string, symbols: string[]): ScreenerSnapshot {
  const metrics: Record<string, ReturnType<typeof toStockSummary>> = {};
  for (const sym of symbols) {
    metrics[sym.toUpperCase()] = toStockSummary(makeStock(sym));
  }
  return {
    strategyId,
    symbols: symbols.map((s) => s.toUpperCase()),
    metrics,
    symbolCount: symbols.length,
    updatedAt: new Date().toISOString(),
  };
}

describe("diffSnapshots", () => {
  it("detects newly added stocks", () => {
    const previous = makeSnapshot("value", ["AAPL", "MSFT"]);
    const currentStocks = [makeStock("AAPL"), makeStock("MSFT"), makeStock("INTC")];

    const diff = diffSnapshots(previous, currentStocks, "value", "Value Investing", "价值投资");

    expect(diff.added).toHaveLength(1);
    expect(diff.added[0].symbol).toBe("INTC");
    expect(diff.removed).toHaveLength(0);
    expect(diff.currentCount).toBe(3);
    expect(diff.previousCount).toBe(2);
  });

  it("detects removed stocks", () => {
    const previous = makeSnapshot("value", ["AAPL", "MSFT", "INTC"]);
    const currentStocks = [makeStock("AAPL"), makeStock("MSFT")];

    const diff = diffSnapshots(previous, currentStocks, "value", "Value Investing", "价值投资");

    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0]).toBe("INTC");
    expect(diff.currentCount).toBe(2);
    expect(diff.previousCount).toBe(3);
  });

  it("detects both added and removed stocks simultaneously", () => {
    const previous = makeSnapshot("large_growth", ["AAPL", "MSFT", "GOOG"]);
    const currentStocks = [makeStock("AAPL"), makeStock("NVDA"), makeStock("META")];

    const diff = diffSnapshots(previous, currentStocks, "large_growth", "Large-Cap Growth", "大型成长股");

    expect(diff.added).toHaveLength(2);
    expect(diff.added.map((s) => s.symbol).sort()).toEqual(["META", "NVDA"]);
    expect(diff.removed).toHaveLength(2);
    expect(diff.removed.sort()).toEqual(["GOOG", "MSFT"]);
  });

  it("returns no changes when stocks are identical", () => {
    const previous = makeSnapshot("value", ["AAPL", "MSFT"]);
    const currentStocks = [makeStock("AAPL"), makeStock("MSFT")];

    const diff = diffSnapshots(previous, currentStocks, "value", "Value Investing", "价值投资");

    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.currentCount).toBe(2);
    expect(diff.previousCount).toBe(2);
  });

  it("handles null previous snapshot (first run)", () => {
    const currentStocks = [makeStock("AAPL"), makeStock("MSFT")];

    const diff = diffSnapshots(null, currentStocks, "value", "Value Investing", "价值投资");

    // On first run, all stocks are "new"
    expect(diff.added).toHaveLength(2);
    expect(diff.removed).toHaveLength(0);
    expect(diff.previousCount).toBe(0);
    expect(diff.currentCount).toBe(2);
  });

  it("handles empty current results", () => {
    const previous = makeSnapshot("value", ["AAPL", "MSFT"]);
    const currentStocks: StockMetrics[] = [];

    const diff = diffSnapshots(previous, currentStocks, "value", "Value Investing", "价值投资");

    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(2);
    expect(diff.currentCount).toBe(0);
    expect(diff.previousCount).toBe(2);
  });

  it("is case-insensitive for symbol matching", () => {
    const previous = makeSnapshot("value", ["aapl", "msft"]);
    const currentStocks = [makeStock("AAPL"), makeStock("MSFT")];

    const diff = diffSnapshots(previous, currentStocks, "value", "Value Investing", "价值投资");

    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
  });

  it("preserves strategy metadata in diff result", () => {
    const diff = diffSnapshots(null, [], "small_growth", "Small/Mid-Cap Growth", "中小盘成长股");

    expect(diff.strategyId).toBe("small_growth");
    expect(diff.strategyName).toBe("Small/Mid-Cap Growth");
    expect(diff.strategyNameZh).toBe("中小盘成长股");
  });
});

describe("toStockSummary", () => {
  it("extracts correct fields from StockMetrics", () => {
    const stock = makeStock("AAPL", { peRatio: 28.5, grossMargin: 45.2 });
    const summary = toStockSummary(stock);

    expect(summary.symbol).toBe("AAPL");
    expect(summary.companyName).toBe("AAPL Corp");
    expect(summary.peRatio).toBe(28.5);
    expect(summary.grossMargin).toBe(45.2);
    // Should NOT include fields like price, sector, industry
    expect(summary).not.toHaveProperty("price");
    expect(summary).not.toHaveProperty("sector");
  });
});
