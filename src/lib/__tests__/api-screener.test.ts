// ============================================================
// Integration Tests: /api/screener route (POST)
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

// ---- Mock stock-pool-store ----
vi.mock("@/lib/stock-pool-store", () => ({
  loadStockPool: vi.fn().mockResolvedValue({
    meta: {
      updatedAt: "2026-01-01T00:00:00.000Z",
      symbolCount: 1,
      source: "mock" as const,
      apiCallsUsed: 0,
    },
    stocks: [
      {
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
      },
    ],
  }),
}));

// ---- Mock mock-data ----
vi.mock("@/lib/mock-data", () => ({
  generateMockStocks: vi.fn().mockReturnValue([
    {
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
    },
  ]),
}));

// ---- Mock seeking-alpha-store ----
vi.mock("@/lib/seeking-alpha-store", () => ({
  loadSAList: vi.fn().mockResolvedValue({
    symbols: ["AAPL"],
    updatedAt: "2026-01-01T00:00:00.000Z",
  }),
}));

// ---- Mock fmp-client (for seeking_alpha on-demand) ----
vi.mock("@/lib/fmp-client", () => ({
  fetchOnDemandStocks: vi.fn().mockResolvedValue([]),
}));

import { POST } from "@/app/api/screener/route";

describe("/api/screener POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 400 when strategy is missing", async () => {
    const req = new NextRequest("http://localhost/api/screener", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filters: [{ field: "peRatio", operator: "lt", value: 20 }] }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("MISSING_FIELDS");
  });

  it("should return 400 when filters is missing", async () => {
    const req = new NextRequest("http://localhost/api/screener", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategy: "value" }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("MISSING_FIELDS");
  });

  it("should return paginated results for valid request", async () => {
    const req = new NextRequest("http://localhost/api/screener", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        strategy: "large_growth",
        filters: [{ field: "marketCap", operator: "gt", value: 100000000 }],
      }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("stocks");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("limit");
    expect(body).toHaveProperty("offset");
    expect(body).toHaveProperty("dataSource");
    expect(Array.isArray(body.stocks)).toBe(true);
  });

  it("should use preset defaults when filters array is empty", async () => {
    const req = new NextRequest("http://localhost/api/screener", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        strategy: "value",
        filters: [],
      }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    // appliedFilters should have been populated from preset defaults
    expect(body.appliedFilters).toBeDefined();
    expect(body.appliedFilters.length).toBeGreaterThan(0);
  });

  it("should handle seeking_alpha strategy path", async () => {
    const req = new NextRequest("http://localhost/api/screener", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        strategy: "seeking_alpha",
        filters: [],
      }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("saListCount");
    expect(body.saListCount).toBe(1);
  });

  it("should include poolUpdatedAt in response", async () => {
    const req = new NextRequest("http://localhost/api/screener", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        strategy: "large_growth",
        filters: [{ field: "marketCap", operator: "gt", value: 0 }],
      }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.poolUpdatedAt).toBe("2026-01-01T00:00:00.000Z");
  });
});
