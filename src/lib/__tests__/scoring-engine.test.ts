// ============================================================
// Unit Tests: scoring-engine.ts
// ============================================================

import { describe, it, expect } from "vitest";
import { calculateFundamentalScore, calculateTechnicalScore } from "../scoring-engine";
import type { StockMetrics } from "../types";

/** Helper: creates a minimal StockMetrics with overrides */
function makeStock(overrides: Partial<StockMetrics> = {}): StockMetrics {
  return {
    symbol: "TEST",
    companyName: "Test Corp",
    sector: "Technology",
    industry: "Software",
    marketCap: 10_000_000_000,
    price: 100,
    peRatio: 20,
    pbRatio: 5,
    freeCashFlowYield: 5,
    dividendYield: 1,
    currentRatio: 1.5,
    debtToEquity: 0.8,
    revenueGrowthYoY: 15,
    epsGrowthYoY: 20,
    pegRatio: 1.2,
    roe: 18,
    grossMargin: 55,
    netMargin: 22,
    priceVs50SMA: 3,
    priceVs200SMA: 8,
    fiftyTwoWeekHigh: 120,
    fiftyTwoWeekLow: 80,
    ...overrides,
  };
}

describe("calculateFundamentalScore", () => {
  it("returns a score between 0 and 100 for a normal stock", () => {
    const score = calculateFundamentalScore(makeStock());
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("returns a higher score for a stock with excellent fundamentals", () => {
    const excellent = makeStock({
      roe: 35,
      grossMargin: 80,
      revenueGrowthYoY: 50,
      epsGrowthYoY: 50,
      freeCashFlowYield: 12,
      currentRatio: 3,
    });
    const mediocre = makeStock({
      roe: 5,
      grossMargin: 15,
      revenueGrowthYoY: 2,
      epsGrowthYoY: 2,
      freeCashFlowYield: 1,
      currentRatio: 0.5,
    });
    expect(calculateFundamentalScore(excellent)).toBeGreaterThan(calculateFundamentalScore(mediocre));
  });

  it("handles null metric values without crashing (defaults to 50)", () => {
    const nullStock = makeStock({
      roe: null,
      grossMargin: null,
      revenueGrowthYoY: null,
      epsGrowthYoY: null,
      freeCashFlowYield: null,
      currentRatio: null,
    });
    const score = calculateFundamentalScore(nullStock);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    // All nulls → normalize returns 50 → weighted sum ≈ 50
    expect(score).toBe(50);
  });

  it("clamps extreme negative values to 0 floor", () => {
    const terrible = makeStock({
      roe: -50,
      grossMargin: -20,
      revenueGrowthYoY: -30,
      epsGrowthYoY: -40,
      freeCashFlowYield: -5,
      currentRatio: 0,
    });
    const score = calculateFundamentalScore(terrible);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("calculateTechnicalScore", () => {
  it("returns a score between 0 and 100 for a normal stock", () => {
    const score = calculateTechnicalScore(makeStock());
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("scores high for a stock above both SMAs near 52w high", () => {
    const bullish = makeStock({
      priceVs50SMA: 15,
      priceVs200SMA: 18,
      price: 118,
      fiftyTwoWeekHigh: 120,
      fiftyTwoWeekLow: 80,
    });
    const score = calculateTechnicalScore(bullish);
    expect(score).toBeGreaterThan(75);
  });

  it("scores low for a stock below both SMAs near 52w low", () => {
    const bearish = makeStock({
      priceVs50SMA: -18,
      priceVs200SMA: -15,
      price: 82,
      fiftyTwoWeekHigh: 120,
      fiftyTwoWeekLow: 80,
    });
    const score = calculateTechnicalScore(bearish);
    expect(score).toBeLessThan(25);
  });

  it("handles null SMA values without crashing", () => {
    const nullSMA = makeStock({
      priceVs50SMA: null,
      priceVs200SMA: null,
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
    });
    const score = calculateTechnicalScore(nullSMA);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    // All nulls → normalize returns 50 for SMAs, highLowScore defaults to 50
    expect(score).toBe(50);
  });

  it("handles zero 52-week range (high == low) gracefully", () => {
    const flatStock = makeStock({
      price: 100,
      fiftyTwoWeekHigh: 100,
      fiftyTwoWeekLow: 100,
    });
    // range = 0, highLowScore should stay at default 50
    const score = calculateTechnicalScore(flatStock);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
