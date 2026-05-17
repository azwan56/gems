// ============================================================
// Tests: Index Constituents — symbol universe
// ============================================================

import { describe, it, expect } from "vitest";
import { NASDAQ_100, SP500_EXTRA, getUniverseSymbols } from "@/lib/index-constituents";

describe("Index Constituents", () => {
  it("NASDAQ_100 should have exactly 100 symbols", () => {
    expect(NASDAQ_100.length).toBe(100);
  });

  it("SP500_EXTRA should have exactly 60 symbols", () => {
    expect(SP500_EXTRA.length).toBe(60);
  });

  it("all symbols should be uppercase strings", () => {
    for (const s of [...NASDAQ_100, ...SP500_EXTRA]) {
      expect(typeof s).toBe("string");
      expect(s.length).toBeGreaterThan(0);
      // Allow BRK-B style tickers
      expect(s).toMatch(/^[A-Z0-9-]+$/);
    }
  });

  it("NASDAQ_100 should contain well-known tech stocks", () => {
    expect(NASDAQ_100).toContain("AAPL");
    expect(NASDAQ_100).toContain("MSFT");
    expect(NASDAQ_100).toContain("NVDA");
    expect(NASDAQ_100).toContain("GOOGL");
    expect(NASDAQ_100).toContain("META");
    expect(NASDAQ_100).toContain("TSLA");
  });

  it("SP500_EXTRA should contain financials and industrials", () => {
    expect(SP500_EXTRA).toContain("JPM");
    expect(SP500_EXTRA).toContain("BAC");
    expect(SP500_EXTRA).toContain("GE");
    expect(SP500_EXTRA).toContain("XOM");
  });

  it("getUniverseSymbols should deduplicate", () => {
    const universe = getUniverseSymbols();
    const uniqueSet = new Set(universe);
    expect(universe.length).toBe(uniqueSet.size);
  });

  it("getUniverseSymbols should contain all NASDAQ_100 symbols", () => {
    const universe = getUniverseSymbols();
    for (const s of NASDAQ_100) {
      expect(universe).toContain(s);
    }
  });

  it("getUniverseSymbols should contain all SP500_EXTRA symbols", () => {
    const universe = getUniverseSymbols();
    for (const s of SP500_EXTRA) {
      expect(universe).toContain(s);
    }
  });
});
