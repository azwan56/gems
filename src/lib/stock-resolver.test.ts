// ============================================================
// Tests: Stock Resolver — mock data path (no FMP key)
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock Firestore-dependent modules to avoid Firestore init in tests
vi.mock("@/lib/stock-pool-store", () => ({
  loadStockPool: vi.fn().mockResolvedValue(null),
}));

// We test the mock-data path by ensuring FMP_API_KEY is not set
describe("resolveStock (mock path)", () => {
  beforeEach(() => {
    // Ensure no FMP key is set
    delete process.env.FMP_API_KEY;
  });

  it("should resolve a known mock symbol", async () => {
    const { resolveStock } = await import("@/lib/stock-resolver");
    const stock = await resolveStock("AAPL");
    expect(stock).toBeDefined();
    expect(stock!.symbol).toBe("AAPL");
    expect(stock!.companyName).toBeTruthy();
    expect(stock!.marketCap).toBeGreaterThan(0);
    expect(stock!.price).toBeGreaterThan(0);
  });

  it("should be case-insensitive", async () => {
    const { resolveStock } = await import("@/lib/stock-resolver");
    const stock = await resolveStock("aapl");
    expect(stock).toBeDefined();
    expect(stock!.symbol).toBe("AAPL");
  });

  it("should return undefined for unknown symbols", async () => {
    const { resolveStock } = await import("@/lib/stock-resolver");
    const stock = await resolveStock("ZZZZZZ");
    expect(stock).toBeUndefined();
  });

  it("should return a complete StockMetrics object", async () => {
    const { resolveStock } = await import("@/lib/stock-resolver");
    const stock = await resolveStock("NVDA");
    expect(stock).toBeDefined();
    // Check all required fields exist
    expect(stock!.symbol).toBe("NVDA");
    expect(typeof stock!.sector).toBe("string");
    expect(typeof stock!.industry).toBe("string");
    // Nullable fields should be number or null, never undefined
    const nullableFields = [
      "peRatio", "pbRatio", "freeCashFlowYield", "dividendYield",
      "currentRatio", "debtToEquity", "revenueGrowthYoY", "epsGrowthYoY",
      "pegRatio", "roe", "grossMargin", "netMargin",
      "priceVs50SMA", "priceVs200SMA", "fiftyTwoWeekHigh", "fiftyTwoWeekLow",
    ] as const;
    for (const field of nullableFields) {
      const val = stock![field];
      expect(val === null || typeof val === "number").toBe(true);
    }
  });
});
