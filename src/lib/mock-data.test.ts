// ============================================================
// Tests: Mock Data Module
// ============================================================

import { describe, it, expect } from "vitest";
import { generateMockStocks } from "@/lib/mock-data";
import { StockMetrics } from "@/lib/types";

describe("generateMockStocks", () => {
  const stocks = generateMockStocks();

  it("should return a non-empty array", () => {
    expect(Array.isArray(stocks)).toBe(true);
    expect(stocks.length).toBeGreaterThan(0);
  });

  it("should return 24 mock stocks", () => {
    expect(stocks.length).toBe(24);
  });

  it("should include known ticker symbols", () => {
    const symbols = stocks.map((s) => s.symbol);
    expect(symbols).toContain("AAPL");
    expect(symbols).toContain("NVDA");
    expect(symbols).toContain("MSFT");
    expect(symbols).toContain("JPM");
    expect(symbols).toContain("META");
  });

  it("every stock should have all required StockMetrics fields", () => {
    const requiredStringFields: (keyof StockMetrics)[] = ["symbol", "companyName", "sector", "industry"];
    const requiredNumberFields: (keyof StockMetrics)[] = ["marketCap", "price"];

    for (const stock of stocks) {
      for (const field of requiredStringFields) {
        expect(typeof stock[field]).toBe("string");
        expect((stock[field] as string).length).toBeGreaterThan(0);
      }
      for (const field of requiredNumberFields) {
        expect(typeof stock[field]).toBe("number");
        expect(stock[field] as number).toBeGreaterThan(0);
      }
    }
  });

  it("every stock should have nullable metric fields present (not undefined)", () => {
    const nullableFields: (keyof StockMetrics)[] = [
      "peRatio", "pbRatio", "freeCashFlowYield", "dividendYield",
      "currentRatio", "debtToEquity", "revenueGrowthYoY", "epsGrowthYoY",
      "pegRatio", "roe", "grossMargin", "netMargin",
      "priceVs50SMA", "priceVs200SMA", "fiftyTwoWeekHigh", "fiftyTwoWeekLow",
    ];

    for (const stock of stocks) {
      for (const field of nullableFields) {
        // Should be number or null, never undefined
        const val = stock[field];
        expect(val === null || typeof val === "number").toBe(true);
      }
    }
  });

  it("should have diverse sectors", () => {
    const sectors = new Set(stocks.map((s) => s.sector));
    expect(sectors.size).toBeGreaterThanOrEqual(3);
  });

  it("should have a wide range of market caps", () => {
    const caps = stocks.map((s) => s.marketCap).sort((a, b) => a - b);
    const smallest = caps[0];
    const largest = caps[caps.length - 1];
    // At least 10x difference between smallest and largest
    expect(largest / smallest).toBeGreaterThan(10);
  });

  it("should include stocks with negative metrics (for filter testing)", () => {
    const negativeEarnings = stocks.filter((s) => s.peRatio !== null && s.peRatio < 0);
    expect(negativeEarnings.length).toBeGreaterThan(0);
  });
});
