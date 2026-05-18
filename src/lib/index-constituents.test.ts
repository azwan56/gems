// ============================================================
// Tests: Index Constituents — symbol universe
// ============================================================

import { describe, it, expect } from "vitest";
import { UNIVERSE, getUniverseSymbols } from "@/lib/index-constituents";

describe("Index Constituents", () => {
  it("UNIVERSE should have ~80 symbols", () => {
    expect(UNIVERSE.length).toBeGreaterThanOrEqual(70);
    expect(UNIVERSE.length).toBeLessThanOrEqual(85);
  });

  it("all symbols should be uppercase strings", () => {
    for (const s of UNIVERSE) {
      expect(typeof s).toBe("string");
      expect(s.length).toBeGreaterThan(0);
      // Allow BRK-B style tickers
      expect(s).toMatch(/^[A-Z0-9-]+$/);
    }
  });

  it("should contain well-known tech stocks", () => {
    expect(UNIVERSE).toContain("AAPL");
    expect(UNIVERSE).toContain("MSFT");
    expect(UNIVERSE).toContain("NVDA");
    expect(UNIVERSE).toContain("GOOGL");
    expect(UNIVERSE).toContain("META");
    expect(UNIVERSE).toContain("TSLA");
  });

  it("should contain value/financial stocks", () => {
    expect(UNIVERSE).toContain("JPM");
    expect(UNIVERSE).toContain("BAC");
    expect(UNIVERSE).toContain("XOM");
    expect(UNIVERSE).toContain("BRK-B");
  });

  it("should contain small/mid-cap growth stocks", () => {
    expect(UNIVERSE).toContain("AXON");
    expect(UNIVERSE).toContain("DDOG");
    expect(UNIVERSE).toContain("IONQ");
    expect(UNIVERSE).toContain("SOUN");
  });

  it("getUniverseSymbols should deduplicate", () => {
    const universe = getUniverseSymbols();
    const uniqueSet = new Set(universe);
    expect(universe.length).toBe(uniqueSet.size);
  });

  it("universe should fit within FMP free tier (80×3 = 240 < 250)", () => {
    const universe = getUniverseSymbols();
    const estimatedCalls = universe.length * 3; // quote + ratios + growth
    expect(estimatedCalls).toBeLessThanOrEqual(250);
  });
});
