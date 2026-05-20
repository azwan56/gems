// ============================================================
// Tests: Sector Map — static sector/industry lookups
// ============================================================

import { describe, it, expect } from "vitest";
import { getSectorInfo } from "@/lib/sector-map";

describe("getSectorInfo", () => {
  it("should return correct sector for known tech stocks", () => {
    const aapl = getSectorInfo("AAPL");
    expect(aapl.sector).toBe("Technology");
    expect(aapl.industry).toBe("Consumer Electronics");

    const nvda = getSectorInfo("NVDA");
    expect(nvda.sector).toBe("Technology");
    expect(nvda.industry).toBe("Semiconductors");
  });

  it("should return correct sector for financial stocks", () => {
    const jpm = getSectorInfo("JPM");
    expect(jpm.sector).toBe("Financial Services");
    expect(jpm.industry).toBe("Banks—Diversified");
  });

  it("should return correct sector for energy stocks", () => {
    const xom = getSectorInfo("XOM");
    expect(xom.sector).toBe("Energy");
    expect(xom.industry).toBe("Oil & Gas Integrated");
  });

  it("should return correct sector for healthcare stocks", () => {
    const lly = getSectorInfo("LLY");
    expect(lly.sector).toBe("Healthcare");
    expect(lly.industry).toBe("Drug Manufacturers");
  });

  it("should handle BRK-B style tickers", () => {
    const brk = getSectorInfo("BRK-B");
    expect(brk.sector).toBe("Financial Services");
    expect(brk.industry).toBe("Insurance—Diversified");
  });

  it("should be case-insensitive", () => {
    const lower = getSectorInfo("aapl");
    const upper = getSectorInfo("AAPL");
    expect(lower).toEqual(upper);
  });

  it("should return Unknown for unmapped symbols", () => {
    const unknown = getSectorInfo("ZZZZZ");
    expect(unknown.sector).toBe("Unknown");
    expect(unknown.industry).toBe("Unknown");
  });

  it("should return Unknown for empty string", () => {
    const result = getSectorInfo("");
    expect(result.sector).toBe("Unknown");
    expect(result.industry).toBe("Unknown");
  });

  it("should cover all major sectors", () => {
    const sectors = new Set([
      getSectorInfo("AAPL").sector,    // Technology
      getSectorInfo("JPM").sector,     // Financial Services
      getSectorInfo("XOM").sector,     // Energy
      getSectorInfo("LLY").sector,     // Healthcare
      getSectorInfo("NEE").sector,     // Utilities
      getSectorInfo("CAT").sector,     // Industrials
      getSectorInfo("KO").sector,      // Consumer Defensive
      getSectorInfo("AMZN").sector,    // Consumer Cyclical
      getSectorInfo("T").sector,       // Communication Services
    ]);
    expect(sectors.size).toBeGreaterThanOrEqual(7);
  });
});
