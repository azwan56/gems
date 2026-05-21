// ============================================================
// Integration Tests: /api/sync-dailystock route (GET & POST)
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---- Mock Auth (verifyAuth) ----
vi.mock("@/lib/auth-middleware", () => ({
  verifyAuth: vi.fn().mockResolvedValue({
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

// ---- Mock stock-resolver ----
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

// ---- Mock Firebase (getDb) ----
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockGet = vi.fn().mockResolvedValue({
  data: () => ({
    observe_list: [],
    plan_type: "paid",
  }),
});
const mockDoc = vi.fn().mockReturnValue({ get: mockGet, set: mockSet });
const mockCollection = vi.fn().mockReturnValue({ doc: mockDoc });

vi.mock("@/lib/firebase", () => ({
  getDb: vi.fn().mockReturnValue({
    collection: (...args: unknown[]) => mockCollection(...args),
  }),
  ensureInitialized: vi.fn(),
}));

import { GET, POST } from "@/app/api/sync-dailystock/route";
import { verifyAuth } from "@/lib/auth-middleware";

describe("/api/sync-dailystock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock to return empty observe_list
    mockGet.mockResolvedValue({
      data: () => ({
        observe_list: [],
        plan_type: "paid",
      }),
    });
  });

  // ---- GET Tests ----

  it("GET should return stock preview for valid symbol", async () => {
    const req = new NextRequest("http://localhost/api/sync-dailystock?symbol=AAPL");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.symbol).toBe("AAPL");
    expect(body.companyName).toBe("Apple Inc.");
    expect(body.sector).toBe("Technology");
    expect(body.alreadyInList).toBe(false);
    expect(body.observeListCount).toBe(0);
    expect(body.planType).toBe("paid");
  });

  it("GET should return 400 when symbol is missing", async () => {
    const req = new NextRequest("http://localhost/api/sync-dailystock");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("MISSING_FIELDS");
  });

  it("GET should show alreadyInList=true when symbol is already in observe_list", async () => {
    mockGet.mockResolvedValueOnce({
      data: () => ({
        observe_list: ["AAPL"],
        plan_type: "paid",
      }),
    });

    const req = new NextRequest("http://localhost/api/sync-dailystock?symbol=AAPL");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.alreadyInList).toBe(true);
    expect(body.observeListCount).toBe(1);
  });

  // ---- POST Tests ----

  it("POST should sync a symbol successfully", async () => {
    const req = new NextRequest("http://localhost/api/sync-dailystock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "GOOGL" }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("synced");
    expect(body.observe_list).toContain("GOOGL");
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ observe_list: ["GOOGL"] }),
      { merge: true }
    );
  });

  it("POST should return already_exists for duplicate symbol", async () => {
    mockGet.mockResolvedValueOnce({
      data: () => ({
        observe_list: ["AAPL"],
        plan_type: "paid",
      }),
    });

    const req = new NextRequest("http://localhost/api/sync-dailystock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "aapl" }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("already_exists");
    expect(body.observe_list).toContain("AAPL");
  });

  it("POST should return 403 when plan limit is exceeded", async () => {
    // Trial plan with 2 stocks already in the list
    vi.mocked(verifyAuth).mockResolvedValueOnce({
      success: true,
      user: {
        uid: "test-user",
        email: "test@test.com",
        planType: "trial",
        isPremium: false,
        isExpired: false,
      },
    });
    mockGet.mockResolvedValueOnce({
      data: () => ({
        observe_list: ["AAPL", "TSLA"],
        plan_type: "trial",
      }),
    });

    const req = new NextRequest("http://localhost/api/sync-dailystock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "GOOGL" }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("PLAN_LIMIT_EXCEEDED");
    expect(body.limit).toBe(2);
    expect(body.current).toBe(2);
  });

  it("POST should return 400 when symbol is missing", async () => {
    const req = new NextRequest("http://localhost/api/sync-dailystock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("MISSING_FIELDS");
  });
});
