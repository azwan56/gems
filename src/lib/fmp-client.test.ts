// ============================================================
// Tests: FMP Client — buildStockMetrics transformer
// ============================================================

import { describe, it, expect } from "vitest";
import { buildStockMetrics } from "@/lib/fmp-client";

describe("buildStockMetrics", () => {
  const baseScreener = {
    symbol: "TEST",
    companyName: "Test Corp",
    marketCap: 100_000_000_000,
    sector: "Technology",
    industry: "Software",
    price: 150.0,
    volume: 5_000_000,
    exchangeShortName: "NASDAQ",
    country: "US",
    isEtf: false,
    isActivelyTrading: true,
  };

  it("should build basic metrics from screener data alone", () => {
    const result = buildStockMetrics(baseScreener);
    expect(result.symbol).toBe("TEST");
    expect(result.companyName).toBe("Test Corp");
    expect(result.marketCap).toBe(100_000_000_000);
    expect(result.price).toBe(150.0);
    expect(result.sector).toBe("Technology");
    expect(result.industry).toBe("Software");
  });

  it("should set nullable fields to null when no supplementary data", () => {
    const result = buildStockMetrics(baseScreener);
    expect(result.peRatio).toBeNull();
    expect(result.pbRatio).toBeNull();
    expect(result.freeCashFlowYield).toBeNull();
    expect(result.dividendYield).toBeNull();
    expect(result.currentRatio).toBeNull();
    expect(result.debtToEquity).toBeNull();
    expect(result.revenueGrowthYoY).toBeNull();
    expect(result.epsGrowthYoY).toBeNull();
    expect(result.pegRatio).toBeNull();
    expect(result.roe).toBeNull();
    expect(result.grossMargin).toBeNull();
    expect(result.netMargin).toBeNull();
    expect(result.priceVs50SMA).toBeNull();
    expect(result.priceVs200SMA).toBeNull();
    expect(result.fiftyTwoWeekHigh).toBeNull();
    expect(result.fiftyTwoWeekLow).toBeNull();
  });

  it("should populate ratios from FMP ratios data", () => {
    const ratios = {
      peRatioTTM: 25.0,
      priceToBookRatioTTM: 8.5,
      currentRatioTTM: 2.1,
      debtEquityRatioTTM: 0.3,
      dividendYieldTTM: 0.015, // 1.5% as decimal
      returnOnEquityTTM: 0.35, // 35% as decimal
      pegRatioTTM: 1.2,
      priceToFreeCashFlowsRatioTTM: 20.0, // FCF yield = 1/20 * 100 = 5%
      grossProfitMarginTTM: 0.65, // 65%
      netProfitMarginTTM: 0.25, // 25%
    };
    const result = buildStockMetrics(baseScreener, ratios);
    expect(result.peRatio).toBe(25.0);
    expect(result.pbRatio).toBe(8.5);
    expect(result.currentRatio).toBe(2.1);
    expect(result.debtToEquity).toBe(0.3);
    expect(result.dividendYield).toBeCloseTo(1.5, 1);
    expect(result.roe).toBeCloseTo(35.0, 1);
    expect(result.pegRatio).toBe(1.2);
    expect(result.freeCashFlowYield).toBeCloseTo(5.0, 1);
    expect(result.grossMargin).toBeCloseTo(65.0, 1);
    expect(result.netMargin).toBeCloseTo(25.0, 1);
  });

  it("should populate growth metrics from FMP growth data", () => {
    const growth = {
      revenueGrowth: 0.25, // 25%
      epsgrowth: 0.40,     // 40%
    };
    const result = buildStockMetrics(baseScreener, undefined, growth);
    expect(result.revenueGrowthYoY).toBeCloseTo(25.0, 1);
    expect(result.epsGrowthYoY).toBeCloseTo(40.0, 1);
  });

  it("should calculate price vs SMA from quote data", () => {
    const quote = {
      priceAvg50: 140.0,  // price is 150, so +7.14%
      priceAvg200: 120.0, // price is 150, so +25.0%
      yearHigh: 160.0,
      yearLow: 100.0,
    };
    const result = buildStockMetrics(baseScreener, undefined, undefined, quote);
    expect(result.priceVs50SMA).toBeCloseTo(7.14, 1);
    expect(result.priceVs200SMA).toBeCloseTo(25.0, 1);
    expect(result.fiftyTwoWeekHigh).toBe(160.0);
    expect(result.fiftyTwoWeekLow).toBe(100.0);
  });

  it("should handle zero price gracefully", () => {
    const zeroPrice = { ...baseScreener, price: 0 };
    const result = buildStockMetrics(zeroPrice);
    expect(result.price).toBe(0);
    // priceVs50SMA should be null since price is 0
  });

  it("should handle missing sector/industry with defaults", () => {
    const noSector = { ...baseScreener, sector: "", industry: "" };
    const result = buildStockMetrics(noSector);
    expect(result.sector).toBe("Unknown");
    expect(result.industry).toBe("Unknown");
  });

  it("should return null FCF yield when ratio is zero or negative", () => {
    const ratios = { priceToFreeCashFlowsRatioTTM: -5.0 };
    const result = buildStockMetrics(baseScreener, ratios);
    expect(result.freeCashFlowYield).toBeNull();
  });

  it("should combine all data sources into a complete metrics object", () => {
    const ratios = {
      peRatioTTM: 30.0,
      priceToBookRatioTTM: 10.0,
      currentRatioTTM: 1.5,
      debtEquityRatioTTM: 0.4,
      dividendYieldTTM: 0.01,
      returnOnEquityTTM: 0.28,
      pegRatioTTM: 1.5,
      priceToFreeCashFlowsRatioTTM: 25.0,
      grossProfitMarginTTM: 0.70,
      netProfitMarginTTM: 0.22,
    };
    const growth = { revenueGrowth: 0.20, epsgrowth: 0.35 };
    const quote = { priceAvg50: 145.0, priceAvg200: 130.0, yearHigh: 165.0, yearLow: 110.0 };

    const result = buildStockMetrics(baseScreener, ratios, growth, quote);

    // Verify no field is undefined
    const keys = Object.keys(result) as (keyof typeof result)[];
    for (const key of keys) {
      expect(result[key]).not.toBeUndefined();
    }
  });
});
