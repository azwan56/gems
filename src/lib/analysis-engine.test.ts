// ============================================================
// Tests: Analysis Engine
// ============================================================

import { describe, it, expect } from "vitest";
import { generateAnalysis, generateAnalysisBatch } from "@/lib/analysis-engine";
import type { StockAnalysisReport } from "@/lib/analysis-engine";
import { generateMockStocks } from "@/lib/mock-data";

const stocks = generateMockStocks();
const aapl = stocks.find((s) => s.symbol === "AAPL")!;
const nvda = stocks.find((s) => s.symbol === "NVDA")!;
const pfe = stocks.find((s) => s.symbol === "PFE")!;

describe("generateAnalysis", () => {
  it("should return a valid report for a value strategy", () => {
    const report = generateAnalysis(pfe, "value");
    expectValidReport(report, "PFE");
  });

  it("should return a valid report for a large_growth strategy", () => {
    const report = generateAnalysis(nvda, "large_growth");
    expectValidReport(report, "NVDA");
  });

  it("should return a valid report for a small_growth strategy", () => {
    const report = generateAnalysis(aapl, "small_growth");
    expectValidReport(report, "AAPL");
  });

  it("should produce deterministic results for the same stock", () => {
    const r1 = generateAnalysis(aapl, "large_growth");
    const r2 = generateAnalysis(aapl, "large_growth");
    expect(r1.analyst.targetPrice).toBe(r2.analyst.targetPrice);
    expect(r1.analyst.upside).toBe(r2.analyst.upside);
    expect(r1.analyst.consensus).toBe(r2.analyst.consensus);
  });

  it("should produce different target prices for different stocks", () => {
    const r1 = generateAnalysis(aapl, "large_growth");
    const r2 = generateAnalysis(nvda, "large_growth");
    // Different symbols should produce different reports
    expect(r1.analyst.targetPrice).not.toBe(r2.analyst.targetPrice);
  });

  it("should generate strategy-specific overview content", () => {
    const valueReport = generateAnalysis(pfe, "value");
    const growthReport = generateAnalysis(pfe, "large_growth");
    // Value report should mention discount/intrinsic value, growth should mention dominant/growth
    expect(valueReport.overview).not.toBe(growthReport.overview);
  });

  it("should generate strategy-specific rationale", () => {
    const valueReport = generateAnalysis(pfe, "value");
    const growthReport = generateAnalysis(nvda, "large_growth");
    // Different number of rationale points or different content
    expect(valueReport.rationale.length).toBe(3);
    expect(growthReport.rationale.length).toBe(3);
    expect(valueReport.rationale[0]).not.toBe(growthReport.rationale[0]);
  });

  it("should generate strategy-specific risks", () => {
    const valueReport = generateAnalysis(pfe, "value");
    const growthReport = generateAnalysis(nvda, "large_growth");
    expect(valueReport.risks.length).toBe(3);
    expect(growthReport.risks.length).toBe(3);
    expect(valueReport.risks[0]).not.toBe(growthReport.risks[0]);
  });

  it("analyst breakdown should have non-negative counts", () => {
    for (const stock of stocks) {
      const report = generateAnalysis(stock, "large_growth");
      expect(report.analyst.breakdown.buy).toBeGreaterThanOrEqual(0);
      expect(report.analyst.breakdown.hold).toBeGreaterThanOrEqual(0);
      expect(report.analyst.breakdown.sell).toBeGreaterThanOrEqual(0);
    }
  });

  it("target price should be higher than current price (positive upside)", () => {
    for (const stock of stocks) {
      const report = generateAnalysis(stock, "value");
      const target = parseFloat(report.analyst.targetPrice.replace("$", ""));
      expect(target).toBeGreaterThan(stock.price);
    }
  });
});

describe("generateAnalysisBatch", () => {
  it("should generate reports for all stocks in batch", () => {
    const reports = generateAnalysisBatch(stocks, "large_growth");
    expect(reports.length).toBe(stocks.length);
    for (const report of reports) {
      expectValidReport(report, report.symbol);
    }
  });

  it("should preserve stock order", () => {
    const reports = generateAnalysisBatch(stocks, "value");
    for (let i = 0; i < stocks.length; i++) {
      expect(reports[i].symbol).toBe(stocks[i].symbol);
    }
  });
});

// Shared assertion helper
function expectValidReport(report: StockAnalysisReport, expectedSymbol: string) {
  expect(report.symbol).toBe(expectedSymbol);
  expect(report.overview).toBeTruthy();
  expect(report.overview.length).toBeGreaterThan(50);
  expect(report.fundamentals).toBeTruthy();
  expect(report.fundamentals.length).toBeGreaterThan(50);
  expect(report.products).toBeTruthy();
  expect(report.products.length).toBeGreaterThan(50);
  expect(report.rationale).toBeInstanceOf(Array);
  expect(report.rationale.length).toBeGreaterThanOrEqual(3);
  expect(report.risks).toBeInstanceOf(Array);
  expect(report.risks.length).toBeGreaterThanOrEqual(3);

  // Analyst section
  expect(report.analyst.consensus).toBeTruthy();
  expect(["Strong Buy", "Buy", "Hold", "Sell", "Strong Sell"]).toContain(report.analyst.consensus);
  expect(report.analyst.targetPrice).toMatch(/^\$\d+/);
  expect(report.analyst.upside).toMatch(/^\+\d+/);
  expect(report.analyst.breakdown.buy).toBeGreaterThanOrEqual(0);
  expect(report.analyst.breakdown.hold).toBeGreaterThanOrEqual(0);
  expect(report.analyst.breakdown.sell).toBeGreaterThanOrEqual(0);
}
