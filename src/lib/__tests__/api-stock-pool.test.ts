// ============================================================
// Integration Tests: /api/stock-pool route (GET & POST)
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { StockPoolMeta } from "@/lib/stock-pool-store";

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

const mockMeta: StockPoolMeta = {
  updatedAt: new Date().toISOString(),
  symbolCount: 5,
  source: "mock",
  apiCallsUsed: 0,
};

const mockStocks = [
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
];

// ---- Mock stock-pool-store ----
vi.mock("@/lib/stock-pool-store", () => ({
  loadStockPool: vi.fn().mockResolvedValue({
    meta: {
      updatedAt: new Date().toISOString(),
      symbolCount: 5,
      source: "mock",
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
  getPoolStatus: vi.fn().mockResolvedValue({
    updatedAt: new Date().toISOString(),
    symbolCount: 5,
    source: "mock",
    apiCallsUsed: 0,
  }),
  isPoolFresh: vi.fn().mockReturnValue(true),
  saveStockPool: vi.fn().mockResolvedValue({
    updatedAt: new Date().toISOString(),
    symbolCount: 5,
    source: "mock",
    apiCallsUsed: 0,
  }),
}));

// ---- Mock fmp-batch-fetcher ----
vi.mock("@/lib/fmp-batch-fetcher", () => ({
  fetchFullUniverse: vi.fn().mockResolvedValue({
    stocks: [],
    apiCallsUsed: 100,
    errors: [],
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

// ---- Mock api-utils (used in route) ----
vi.mock("@/lib/api-utils", () => ({
  hasRateLimitErrors: vi.fn().mockReturnValue(false),
  createErrorResponse: vi.fn(),
}));

import { GET, POST } from "@/app/api/stock-pool/route";
import { getPoolStatus, isPoolFresh, saveStockPool } from "@/lib/stock-pool-store";

describe("/api/stock-pool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.FMP_API_KEY;
  });

  // ---- GET Tests ----

  it("GET should return pool status (metadata only)", async () => {
    const req = new NextRequest("http://localhost/api/stock-pool");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.meta).toBeDefined();
    expect(body.meta.symbolCount).toBe(5);
    expect(body).toHaveProperty("fresh");
  });

  it("GET should return empty status when no pool exists", async () => {
    vi.mocked(getPoolStatus).mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost/api/stock-pool");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("empty");
  });

  it("GET with include=stocks should return full stock data", async () => {
    const req = new NextRequest("http://localhost/api/stock-pool?include=stocks");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.stocks).toBeDefined();
    expect(Array.isArray(body.stocks)).toBe(true);
    expect(body.stocks.length).toBeGreaterThan(0);
  });

  // ---- POST Tests ----

  it("POST should skip refresh when pool is still fresh", async () => {
    vi.mocked(isPoolFresh).mockReturnValue(true);

    const req = new NextRequest("http://localhost/api/stock-pool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("skipped");
  });

  it("POST without FMP_API_KEY should store mock data", async () => {
    delete process.env.FMP_API_KEY;
    vi.mocked(isPoolFresh).mockReturnValue(false);
    vi.mocked(getPoolStatus).mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost/api/stock-pool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.source).toBe("mock");
    expect(saveStockPool).toHaveBeenCalled();
  });

  it("POST with force=true should bypass freshness check", async () => {
    delete process.env.FMP_API_KEY;
    vi.mocked(isPoolFresh).mockReturnValue(true);

    const req = new NextRequest("http://localhost/api/stock-pool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: true }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    // Should NOT be "skipped" since we forced it
    expect(body.status).toBe("ok");
    expect(body.source).toBe("mock");
  });
});
