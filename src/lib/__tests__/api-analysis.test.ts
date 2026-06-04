// ============================================================
// Integration Tests: /api/analysis route (GET & POST)
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { StockMetrics } from "@/lib/types";

// ---- Mock Auth ----
vi.mock("@/lib/auth-middleware", () => ({
  requirePremium: vi.fn().mockResolvedValue({
    success: true,
    user: {
      uid: "test-user",
      email: "test@test.com",
      planType: "paid",
      isPremium: true,
      isExpired: false,
    },
  }),
}));

// ---- Mock Stock Resolver ----
const mockStock: StockMetrics = {
  symbol: "AAPL",
  companyName: "Apple Inc.",
  sector: "Technology",
  industry: "Consumer Electronics",
  marketCap: 3000000000000,
  price: 200,
  peRatio: 30,
  pbRatio: 45,
  freeCashFlowYield: 3.5,
  dividendYield: 0.5,
  currentRatio: 1.1,
  debtToEquity: 1.8,
  revenueGrowthYoY: 8,
  epsGrowthYoY: 12,
  pegRatio: 2.5,
  roe: 150,
  grossMargin: 46,
  netMargin: 26,
  priceVs50SMA: 2.5,
  priceVs200SMA: 15,
  fiftyTwoWeekHigh: 220,
  fiftyTwoWeekLow: 160,
};

vi.mock("@/lib/stock-resolver", () => ({
  resolveStock: vi.fn().mockResolvedValue({
    symbol: "AAPL",
    companyName: "Apple Inc.",
    sector: "Technology",
    industry: "Consumer Electronics",
    marketCap: 3000000000000,
    price: 200,
    peRatio: 30,
    pbRatio: 45,
    freeCashFlowYield: 3.5,
    dividendYield: 0.5,
    currentRatio: 1.1,
    debtToEquity: 1.8,
    revenueGrowthYoY: 8,
    epsGrowthYoY: 12,
    pegRatio: 2.5,
    roe: 150,
    grossMargin: 46,
    netMargin: 26,
    priceVs50SMA: 2.5,
    priceVs200SMA: 15,
    fiftyTwoWeekHigh: 220,
    fiftyTwoWeekLow: 160,
  }),
}));

// ---- Mock Gemini Client ----
const mockReport = {
  symbol: "AAPL",
  overview: "Apple is a strong company.",
  fundamentals: "Great margins and growth.",
  products: "iPhone, Mac, Services.",
  rationale: ["Reason 1", "Reason 2", "Reason 3"],
  risks: ["Risk 1", "Risk 2", "Risk 3"],
  catalysts: ["Catalyst 1", "Catalyst 2"],
  positionSuggestion: "Hold with conviction.",
  technicalScore: 72,
  fundamentalScore: 65,
  analyst: {
    consensus: "Buy",
    targetPrice: "$250.00",
    upside: "+25.0%",
    breakdown: { buy: 20, hold: 5, sell: 2 },
  },
};

vi.mock("@/lib/gemini-client", () => ({
  generateGeminiAnalysis: vi.fn().mockResolvedValue({
    symbol: "AAPL",
    overview: "Apple is a strong company.",
    fundamentals: "Great margins and growth.",
    products: "iPhone, Mac, Services.",
    rationale: ["Reason 1", "Reason 2", "Reason 3"],
    risks: ["Risk 1", "Risk 2", "Risk 3"],
    catalysts: ["Catalyst 1", "Catalyst 2"],
    positionSuggestion: "Hold with conviction.",
    technicalScore: 72,
    fundamentalScore: 65,
    analyst: {
      consensus: "Buy",
      targetPrice: "$250.00",
      upside: "+25.0%",
      breakdown: { buy: 20, hold: 5, sell: 2 },
    },
  }),
}));

// ---- Mock fmp-cache (to prevent import errors from gemini-client) ----
vi.mock("@/lib/fmp-cache", () => ({
  getCached: vi.fn().mockReturnValue(null),
  setCache: vi.fn(),
  clearCache: vi.fn(),
}));

import { GET, POST } from "@/app/api/analysis/route";
import { resolveStock } from "@/lib/stock-resolver";

describe("/api/analysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-key";
  });

  // ---- GET Tests ----

  describe("GET", () => {
    it("should return 400 MISSING_SYMBOL when no symbol param", async () => {
      const req = new NextRequest("http://localhost/api/analysis?strategy=value");
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe("MISSING_SYMBOL");
    });

    it("should return 400 INVALID_STRATEGY for invalid strategy", async () => {
      const req = new NextRequest("http://localhost/api/analysis?symbol=AAPL&strategy=invalid");
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe("INVALID_STRATEGY");
    });

    it("should return 404 when stock is not found", async () => {
      vi.mocked(resolveStock).mockResolvedValueOnce(undefined);

      const req = new NextRequest("http://localhost/api/analysis?symbol=ZZZZ&strategy=value");
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error).toBe("NOT_FOUND");
    });

    it("should return report for valid request with Gemini path", async () => {
      const req = new NextRequest("http://localhost/api/analysis?symbol=AAPL&strategy=large_growth&lang=en");
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.report).toBeDefined();
      expect(body.report.symbol).toBe("AAPL");
      expect(body.report.overview).toBeTruthy();
    });

    it("should default strategy to large_growth when not provided", async () => {
      const { generateGeminiAnalysis } = await import("@/lib/gemini-client");

      const req = new NextRequest("http://localhost/api/analysis?symbol=AAPL");
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(generateGeminiAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: "AAPL" }),
        "large_growth",
        "en"
      );
    });

    it("should use fallback analysis-engine when GEMINI_API_KEY is not set", async () => {
      delete process.env.GEMINI_API_KEY;
      const { generateGeminiAnalysis } = await import("@/lib/gemini-client");

      const req = new NextRequest("http://localhost/api/analysis?symbol=AAPL&strategy=value");
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.report).toBeDefined();
      // Should NOT have called Gemini
      expect(generateGeminiAnalysis).not.toHaveBeenCalled();
    });
  });

  // ---- POST Tests ----

  describe("POST", () => {
    it("should return 400 MISSING_SYMBOLS when no symbols array", async () => {
      const req = new NextRequest("http://localhost/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy: "value" }),
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe("MISSING_SYMBOLS");
    });

    it("should return 400 MISSING_SYMBOLS for empty symbols array", async () => {
      const req = new NextRequest("http://localhost/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: [], strategy: "value" }),
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe("MISSING_SYMBOLS");
    });

    it("should return reports for valid batch request", async () => {
      const req = new NextRequest("http://localhost/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: ["AAPL"], strategy: "value", lang: "en" }),
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.reports).toBeDefined();
      expect(Array.isArray(body.reports)).toBe(true);
      expect(body.reports.length).toBe(1);
    });

    it("should include notFound for unresolvable symbols", async () => {
      vi.mocked(resolveStock)
        .mockResolvedValueOnce(mockStock)
        .mockResolvedValueOnce(undefined);

      const req = new NextRequest("http://localhost/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: ["AAPL", "ZZZZ"], strategy: "value" }),
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.reports).toBeDefined();
      expect(body.notFound).toEqual(["ZZZZ"]);
    });

    it("should accept seeking_alpha strategy and map to large_growth", async () => {
      const { generateGeminiAnalysis } = await import("@/lib/gemini-client");

      const req = new NextRequest("http://localhost/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: ["AAPL"], strategy: "seeking_alpha", lang: "zh" }),
      });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.reports).toBeDefined();
      // Verify it was mapped to large_growth internally
      expect(generateGeminiAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: "AAPL" }),
        "large_growth",
        "zh"
      );
    });
  });

  // ---- seeking_alpha strategy mapping ----

  describe("seeking_alpha strategy", () => {
    it("GET should accept seeking_alpha and map to large_growth", async () => {
      const { generateGeminiAnalysis } = await import("@/lib/gemini-client");

      const req = new NextRequest("http://localhost/api/analysis?symbol=AAPL&strategy=seeking_alpha&lang=en");
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.report).toBeDefined();
      expect(generateGeminiAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: "AAPL" }),
        "large_growth",
        "en"
      );
    });

    it("GET should NOT reject seeking_alpha as invalid strategy", async () => {
      const req = new NextRequest("http://localhost/api/analysis?symbol=AAPL&strategy=seeking_alpha");
      const res = await GET(req);

      expect(res.status).not.toBe(400);
    });
  });
});
