import { describe, it, expect } from "vitest";
import { 
  calculateMacroDrift, 
  calculateCumulativeReturn,
  calculateConstituentReturns,
  getPeriodStartDate, 
  isWithinWarningWindow,
  identifyWindowDressing,
} from "../rebalance-engine";
import { HistoricalPrice } from "../rebalance-fetcher";

// Helper to create mock prices
function mockPrice(date: string, adjClose: number): HistoricalPrice {
  return {
    date,
    open: adjClose,
    high: adjClose,
    low: adjClose,
    close: adjClose,
    adjClose,
    volume: 1000,
    unadjustedVolume: 1000,
    change: 0,
    changePercent: 0,
    vwap: adjClose,
    label: date,
    changeOverTime: 0
  };
}

describe("rebalance-engine", () => {

  // ============================================================
  // calculateCumulativeReturn
  // ============================================================
  describe("calculateCumulativeReturn", () => {
    it("should return 0 for null/undefined input", () => {
      expect(calculateCumulativeReturn(null as unknown as HistoricalPrice[])).toBe(0);
      expect(calculateCumulativeReturn(undefined as unknown as HistoricalPrice[])).toBe(0);
    });

    it("should return 0 for empty array", () => {
      expect(calculateCumulativeReturn([])).toBe(0);
    });

    it("should return 0 for single price point", () => {
      expect(calculateCumulativeReturn([mockPrice("2026-03-01", 100)])).toBe(0);
    });

    it("should return 0 when start price is 0 (avoids division by zero)", () => {
      const prices = [
        mockPrice("2026-03-01", 0),
        mockPrice("2026-03-31", 100),
      ];
      expect(calculateCumulativeReturn(prices)).toBe(0);
    });

    it("should calculate positive return correctly", () => {
      const prices = [
        mockPrice("2026-03-01", 100),
        mockPrice("2026-03-31", 110),
      ];
      expect(calculateCumulativeReturn(prices)).toBeCloseTo(10.0);
    });

    it("should calculate negative return correctly", () => {
      const prices = [
        mockPrice("2026-03-01", 100),
        mockPrice("2026-03-31", 85),
      ];
      expect(calculateCumulativeReturn(prices)).toBeCloseTo(-15.0);
    });

    it("should handle prices provided in descending order (FMP default)", () => {
      // FMP returns newest first — our function should sort ascending internally
      const prices = [
        mockPrice("2026-03-31", 120),  // newest first
        mockPrice("2026-03-15", 110),
        mockPrice("2026-03-01", 100),  // oldest last
      ];
      expect(calculateCumulativeReturn(prices)).toBeCloseTo(20.0);
    });

    it("should handle prices provided in random order", () => {
      const prices = [
        mockPrice("2026-03-15", 110),
        mockPrice("2026-03-01", 100),
        mockPrice("2026-03-31", 120),
      ];
      expect(calculateCumulativeReturn(prices)).toBeCloseTo(20.0);
    });

    it("should return 0 for flat prices", () => {
      const prices = [
        mockPrice("2026-03-01", 100),
        mockPrice("2026-03-31", 100),
      ];
      expect(calculateCumulativeReturn(prices)).toBe(0);
    });
  });

  // ============================================================
  // calculateMacroDrift
  // ============================================================
  describe("calculateMacroDrift", () => {
    it("should signal SELL_EQUITY when equity significantly outperforms", () => {
      const spyPrices = [
        mockPrice("2026-03-01", 100),
        mockPrice("2026-03-31", 110),  // +10%
      ];
      const bndPrices = [
        mockPrice("2026-03-01", 100),
        mockPrice("2026-03-31", 102),  // +2%
      ];

      const result = calculateMacroDrift(spyPrices, bndPrices, 3.0);
      
      expect(result.spyReturn).toBeCloseTo(10.0);
      expect(result.bndReturn).toBeCloseTo(2.0);
      expect(result.spread).toBeCloseTo(8.0);
      expect(result.isEquityOutperforming).toBe(true);
      expect(result.thresholdExceeded).toBe(true);
      expect(result.signal).toBe("SELL_EQUITY");
    });

    it("should signal BUY_EQUITY when equity significantly underperforms", () => {
      const spyPrices = [
        mockPrice("2026-03-01", 100),
        mockPrice("2026-03-31", 95),   // -5%
      ];
      const bndPrices = [
        mockPrice("2026-03-01", 100),
        mockPrice("2026-03-31", 101),  // +1%
      ];

      const result = calculateMacroDrift(spyPrices, bndPrices, 3.0);
      
      expect(result.spyReturn).toBeCloseTo(-5.0);
      expect(result.bndReturn).toBeCloseTo(1.0);
      expect(result.spread).toBeCloseTo(-6.0);
      expect(result.isEquityOutperforming).toBe(false);
      expect(result.thresholdExceeded).toBe(true);
      expect(result.signal).toBe("BUY_EQUITY");
    });

    it("should signal NEUTRAL when drift is below threshold", () => {
      const spyPrices = [
        mockPrice("2026-03-01", 100),
        mockPrice("2026-03-31", 102),  // +2%
      ];
      const bndPrices = [
        mockPrice("2026-03-01", 100),
        mockPrice("2026-03-31", 101),  // +1%
      ];

      const result = calculateMacroDrift(spyPrices, bndPrices, 3.0);
      
      expect(result.spread).toBeCloseTo(1.0);
      expect(result.thresholdExceeded).toBe(false);
      expect(result.signal).toBe("NEUTRAL");
    });

    it("should signal SELL_EQUITY at exactly the threshold boundary", () => {
      // Spread of exactly 3.0% should trigger
      const spyPrices = [
        mockPrice("2026-03-01", 100),
        mockPrice("2026-03-31", 104),  // +4%
      ];
      const bndPrices = [
        mockPrice("2026-03-01", 100),
        mockPrice("2026-03-31", 101),  // +1%
      ];

      const result = calculateMacroDrift(spyPrices, bndPrices, 3.0);
      expect(result.spread).toBeCloseTo(3.0);
      expect(result.thresholdExceeded).toBe(true);
      expect(result.signal).toBe("SELL_EQUITY");
    });

    it("should handle both SPY and BND declining", () => {
      const spyPrices = [
        mockPrice("2026-03-01", 100),
        mockPrice("2026-03-31", 90),  // -10%
      ];
      const bndPrices = [
        mockPrice("2026-03-01", 100),
        mockPrice("2026-03-31", 95),  // -5%
      ];

      const result = calculateMacroDrift(spyPrices, bndPrices, 3.0);
      expect(result.spread).toBeCloseTo(-5.0);
      expect(result.signal).toBe("BUY_EQUITY");
    });

    it("should handle custom threshold", () => {
      const spyPrices = [
        mockPrice("2026-03-01", 100),
        mockPrice("2026-03-31", 104),  // +4%
      ];
      const bndPrices = [
        mockPrice("2026-03-01", 100),
        mockPrice("2026-03-31", 101),  // +1%
      ];

      // 3% spread with 5% threshold = NEUTRAL
      const result = calculateMacroDrift(spyPrices, bndPrices, 5.0);
      expect(result.thresholdExceeded).toBe(false);
      expect(result.signal).toBe("NEUTRAL");
    });
  });

  // ============================================================
  // identifyWindowDressing
  // ============================================================
  describe("identifyWindowDressing", () => {
    it("should correctly identify top and bottom deciles", () => {
      const returns = Array.from({ length: 100 }, (_, i) => ({
        symbol: `SYM${i}`,
        return: i - 50 // Returns from -50 to 49
      }));

      const result = identifyWindowDressing(returns, 0.1); // 10%
      
      expect(result.winners.length).toBe(10);
      expect(result.losers.length).toBe(10);
      
      // Top winner should be SYM99 (return 49)
      expect(result.winners[0].symbol).toBe("SYM99");
      expect(result.winners[0].return).toBe(49);
      
      // Worst loser should be SYM0 (return -50)
      expect(result.losers[0].symbol).toBe("SYM0");
      expect(result.losers[0].return).toBe(-50);
    });

    it("should return empty arrays for empty input", () => {
      const result = identifyWindowDressing([]);
      expect(result.winners).toEqual([]);
      expect(result.losers).toEqual([]);
    });

    it("should return empty arrays for null/undefined input", () => {
      const result = identifyWindowDressing(null as unknown as { symbol: string; return: number }[]);
      expect(result.winners).toEqual([]);
      expect(result.losers).toEqual([]);
    });

    it("should handle a single stock (cutoff = max(1, floor(1*0.1)) = 1)", () => {
      const returns = [{ symbol: "ONLY", return: 5.0 }];
      const result = identifyWindowDressing(returns, 0.1);
      // cutoff = max(1, floor(0.1)) = max(1, 0) = 1
      expect(result.winners.length).toBe(1);
      expect(result.losers.length).toBe(1);
      // Same stock is both winner and loser
      expect(result.winners[0].symbol).toBe("ONLY");
      expect(result.losers[0].symbol).toBe("ONLY");
    });

    it("should handle 5% percentile on small set", () => {
      const returns = Array.from({ length: 10 }, (_, i) => ({
        symbol: `S${i}`,
        return: i * 10
      }));
      // cutoff = max(1, floor(10*0.05)) = max(1, 0) = 1
      const result = identifyWindowDressing(returns, 0.05);
      expect(result.winners.length).toBe(1);
      expect(result.losers.length).toBe(1);
    });
  });

  // ============================================================
  // calculateConstituentReturns
  // ============================================================
  describe("calculateConstituentReturns", () => {
    it("should compute cumulative returns for a map of historical prices", () => {
      const priceMap = new Map<string, HistoricalPrice[]>();
      priceMap.set("AAPL", [
        mockPrice("2026-03-01", 100),
        mockPrice("2026-03-31", 150), // 50% return
      ]);
      priceMap.set("MSFT", [
        mockPrice("2026-03-01", 100),
        mockPrice("2026-03-31", 80),  // -20% return
      ]);
      priceMap.set("NO_DATA", [
        mockPrice("2026-03-31", 100) // Ignored, < 2 prices
      ]);

      const returns = calculateConstituentReturns(priceMap);
      
      expect(returns.length).toBe(2);
      
      const aapl = returns.find(r => r.symbol === "AAPL");
      expect(aapl?.return).toBe(50);
      
      const msft = returns.find(r => r.symbol === "MSFT");
      expect(msft?.return).toBe(-20);
    });

    it("should return empty array for empty map", () => {
      const priceMap = new Map<string, HistoricalPrice[]>();
      expect(calculateConstituentReturns(priceMap)).toEqual([]);
    });
  });

  // ============================================================
  // getPeriodStartDate
  // ============================================================
  describe("getPeriodStartDate", () => {
    it("should return 1st of month for MTD", () => {
      const date = new Date("2026-03-25T12:00:00Z");
      expect(getPeriodStartDate(date, "MTD")).toBe("2026-03-01");
    });

    it("should return start of Q1 for QTD in March", () => {
      expect(getPeriodStartDate(new Date("2026-03-25T12:00:00Z"), "QTD")).toBe("2026-01-01");
    });

    it("should return start of Q2 for QTD in June", () => {
      expect(getPeriodStartDate(new Date("2026-06-15T12:00:00Z"), "QTD")).toBe("2026-04-01");
    });

    it("should return start of Q3 for QTD in August", () => {
      expect(getPeriodStartDate(new Date("2026-08-15T12:00:00Z"), "QTD")).toBe("2026-07-01");
    });

    it("should return start of Q4 for QTD in December", () => {
      expect(getPeriodStartDate(new Date("2026-12-28T12:00:00Z"), "QTD")).toBe("2026-10-01");
    });

    it("should not mutate the input date", () => {
      const original = new Date("2026-03-25T12:00:00Z");
      const before = original.getTime();
      getPeriodStartDate(original, "QTD");
      expect(original.getTime()).toBe(before);
    });
  });

  // ============================================================
  // isWithinWarningWindow
  // ============================================================
  describe("isWithinWarningWindow", () => {
    it("should return true for the last day of the month", () => {
      const date = new Date(2026, 2, 31); // March 31
      expect(isWithinWarningWindow(date, 7, false)).toBe(true);
    });

    it("should return true if within last 7 days of month", () => {
      const date = new Date(2026, 2, 25); // March 25, 6 days before March 31
      expect(isWithinWarningWindow(date, 7, false)).toBe(true);
    });

    it("should return true at the boundary (exactly 7 days before end)", () => {
      const date = new Date(2026, 2, 24); // March 24, 7 days before March 31
      expect(isWithinWarningWindow(date, 7, false)).toBe(true);
    });

    it("should return false if outside the warning window", () => {
      const date = new Date(2026, 2, 15); // March 15, 16 days before March 31
      expect(isWithinWarningWindow(date, 7, false)).toBe(false);
    });

    it("should return false just outside the window (8 days before end)", () => {
      const date = new Date(2026, 2, 23); // March 23, 8 days before March 31
      expect(isWithinWarningWindow(date, 7, false)).toBe(false);
    });

    it("should handle February (28 days) correctly", () => {
      // Feb 2026 has 28 days
      const date = new Date(2026, 1, 22); // Feb 22, 6 days before Feb 28
      expect(isWithinWarningWindow(date, 7, false)).toBe(true);
      
      const early = new Date(2026, 1, 15); // Feb 15
      expect(isWithinWarningWindow(early, 7, false)).toBe(false);
    });

    it("should handle 30-day months (April) correctly", () => {
      const date = new Date(2026, 3, 24); // April 24, 6 days before April 30
      expect(isWithinWarningWindow(date, 7, false)).toBe(true);
    });

    // FIX VERIFICATION: ensure time-of-day doesn't cause off-by-one
    it("should not be affected by time-of-day (21:30 UTC cron bug)", () => {
      // The function zeros out time before diffing, so e.g. 23:59 on March 25
      // should be the same as 00:00 on March 25 → both 6 days from March 31.
      // Use local-time constructors since isWithinWarningWindow operates in local TZ.
      
      // March 25 at 23:59 local → should be 6 days from March 31 → inside window
      const late = new Date(2026, 2, 25, 23, 59, 59);
      expect(isWithinWarningWindow(late, 7, false)).toBe(true);
      
      // March 25 at 00:01 local → also 6 days → inside window
      const early = new Date(2026, 2, 25, 0, 1, 0);
      expect(isWithinWarningWindow(early, 7, false)).toBe(true);

      // March 23 at any time → 8 days from March 31 → outside window
      const outsideLate = new Date(2026, 2, 23, 23, 59, 59);
      expect(isWithinWarningWindow(outsideLate, 7, false)).toBe(false);
      
      const outsideEarly = new Date(2026, 2, 23, 0, 1, 0);
      expect(isWithinWarningWindow(outsideEarly, 7, false)).toBe(false);
    });

    describe("checkQuarterly", () => {
      it("should return true for end of Q1 (March)", () => {
        const marchEnd = new Date(2026, 2, 28);
        expect(isWithinWarningWindow(marchEnd, 7, true)).toBe(true);
      });

      it("should return true for end of Q2 (June)", () => {
        const juneEnd = new Date(2026, 5, 25);
        expect(isWithinWarningWindow(juneEnd, 7, true)).toBe(true);
      });

      it("should return true for end of Q3 (September)", () => {
        const sepEnd = new Date(2026, 8, 27);
        expect(isWithinWarningWindow(sepEnd, 7, true)).toBe(true);
      });

      it("should return true for end of Q4 (December)", () => {
        const decEnd = new Date(2026, 11, 28);
        expect(isWithinWarningWindow(decEnd, 7, true)).toBe(true);
      });

      it("should return false for non-quarter-end months even at month end", () => {
        // April is NOT end of quarter
        const aprilEnd = new Date(2026, 3, 28);
        expect(isWithinWarningWindow(aprilEnd, 7, true)).toBe(false);
        
        // But it IS within the monthly window
        expect(isWithinWarningWindow(aprilEnd, 7, false)).toBe(true);
      });

      it("should return false for quarter-end months outside the window", () => {
        const marchEarly = new Date(2026, 2, 10);
        expect(isWithinWarningWindow(marchEarly, 7, true)).toBe(false);
      });
    });
  });
});
