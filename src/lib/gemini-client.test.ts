// ============================================================
// Tests: Gemini Client — validates prompt construction & parsing
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StockMetrics } from "@/lib/types";

// Mock the @google/genai module with a proper class-based mock
const mockGenerateContent = vi.fn();

vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: class MockGoogleGenAI {
      models = {
        generateContent: mockGenerateContent,
      };
    },
    Type: {
      OBJECT: "OBJECT",
      STRING: "STRING",
      ARRAY: "ARRAY",
      INTEGER: "INTEGER",
    },
  };
});

// Mock the Firebase Admin SDK to bypass Firestore caching during tests
vi.mock("@/lib/firebase", () => {
  return {
    getDb: () => ({
      collection: () => ({
        doc: () => ({
          get: async () => ({ exists: false }),
          set: async () => {},
        }),
      }),
    }),
  };
});

const validResponse = {
  text: JSON.stringify({
    symbol: "TEST",
    overview: "Test overview paragraph about company moat and TAM.",
    fundamentals: "Test fundamentals analyzing margins and growth rates.",
    products: "Test products describing core revenue drivers.",
    rationale: ["Reason 1: Strong growth", "Reason 2: Market position", "Reason 3: Pricing power"],
    risks: ["Risk 1: Regulatory", "Risk 2: Competition", "Risk 3: Valuation"],
    analyst: {
      consensus: "Buy",
      targetPrice: "$165.00",
      upside: "+10.0%",
      breakdown: { buy: 20, hold: 5, sell: 2 },
    },
  }),
};

const testStock: StockMetrics = {
  symbol: "TEST",
  companyName: "Test Corp",
  sector: "Technology",
  industry: "Software",
  marketCap: 100_000_000_000,
  price: 150.0,
  peRatio: 25.0,
  pbRatio: 8.5,
  freeCashFlowYield: 5.0,
  dividendYield: 1.5,
  currentRatio: 2.1,
  debtToEquity: 0.3,
  revenueGrowthYoY: 25.0,
  epsGrowthYoY: 40.0,
  pegRatio: 1.2,
  roe: 35.0,
  grossMargin: 65.0,
  netMargin: 25.0,
  priceVs50SMA: 7.1,
  priceVs200SMA: 25.0,
  fiftyTwoWeekHigh: 160.0,
  fiftyTwoWeekLow: 100.0,
};

import { clearCache } from "@/lib/fmp-cache";

describe("generateGeminiAnalysis", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "dummy";
    mockGenerateContent.mockResolvedValue(validResponse);
    clearCache();
  });

  it("should return a valid StockAnalysisReport structure", async () => {
    const { generateGeminiAnalysis } = await import("@/lib/gemini-client");
    const report = await generateGeminiAnalysis(testStock, "large_growth");

    expect(report.symbol).toBe("TEST");
    expect(report.overview).toBeTruthy();
    expect(report.fundamentals).toBeTruthy();
    expect(report.products).toBeTruthy();
    expect(Array.isArray(report.rationale)).toBe(true);
    expect(report.rationale.length).toBe(3);
    expect(Array.isArray(report.risks)).toBe(true);
    expect(report.risks.length).toBe(3);
  });

  it("should return analyst consensus fields", async () => {
    const { generateGeminiAnalysis } = await import("@/lib/gemini-client");
    const report = await generateGeminiAnalysis(testStock, "value");

    expect(report.analyst).toBeDefined();
    expect(report.analyst.consensus).toBe("Buy");
    expect(report.analyst.targetPrice).toBe("$165.00");
    expect(report.analyst.upside).toBe("+10.0%");
    expect(report.analyst.breakdown.buy).toBe(20);
    expect(report.analyst.breakdown.hold).toBe(5);
    expect(report.analyst.breakdown.sell).toBe(2);
  });

  it("should always override symbol to match input stock", async () => {
    // Mock returns a different symbol, but function should override
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        ...JSON.parse(validResponse.text),
        symbol: "WRONG",
      }),
    });

    const { generateGeminiAnalysis } = await import("@/lib/gemini-client");
    const report = await generateGeminiAnalysis(testStock, "small_growth");
    expect(report.symbol).toBe("TEST");
  });

  it("should accept language parameter without error", async () => {
    const { generateGeminiAnalysis } = await import("@/lib/gemini-client");

    const reportEn = await generateGeminiAnalysis(testStock, "large_growth", "en");
    expect(reportEn.symbol).toBe("TEST");

    const reportZh = await generateGeminiAnalysis(testStock, "large_growth", "zh");
    expect(reportZh.symbol).toBe("TEST");
  });

  it("should call generateContent with the correct model", async () => {
    const { generateGeminiAnalysis } = await import("@/lib/gemini-client");
    await generateGeminiAnalysis(testStock, "large_growth");

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-3.1-flash-lite",
      })
    );
  });

  it("should throw if GEMINI_API_KEY is not set", async () => {
    delete process.env.GEMINI_API_KEY;
    const { generateGeminiAnalysis } = await import("@/lib/gemini-client");
    await expect(generateGeminiAnalysis(testStock, "large_growth")).rejects.toThrow("GEMINI_API_KEY");
  });

  it("should throw if Gemini returns empty text", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    mockGenerateContent.mockResolvedValue({ text: null });

    const { generateGeminiAnalysis } = await import("@/lib/gemini-client");
    await expect(generateGeminiAnalysis(testStock, "large_growth")).rejects.toThrow("Empty response");
  });

  it("should handle null metrics gracefully in prompt", async () => {
    const stockWithNulls: StockMetrics = {
      ...testStock,
      peRatio: null,
      pbRatio: null,
      freeCashFlowYield: null,
      dividendYield: null,
      revenueGrowthYoY: null,
      epsGrowthYoY: null,
      roe: null,
      grossMargin: null,
      netMargin: null,
      priceVs50SMA: null,
    };

    const { generateGeminiAnalysis } = await import("@/lib/gemini-client");
    const report = await generateGeminiAnalysis(stockWithNulls, "value");
    expect(report.symbol).toBe("TEST");
  });
});
