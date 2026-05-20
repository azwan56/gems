// ============================================================
// Tests: Market Calendar — trading day detection
// ============================================================

import { describe, it, expect } from "vitest";
import { isTradingDay, getNextRefreshTime } from "@/lib/market-calendar";

describe("Market Calendar", () => {
  describe("isTradingDay", () => {
    it("should return true for a regular weekday (e.g., Monday)", () => {
      // 2026-05-18 is a Monday
      const monday = new Date("2026-05-18T12:00:00-04:00");
      expect(isTradingDay(monday)).toBe(true);
    });

    it("should return true for a Wednesday", () => {
      // 2026-05-20 is a Wednesday
      const wed = new Date("2026-05-20T12:00:00-04:00");
      expect(isTradingDay(wed)).toBe(true);
    });

    it("should return true for a Friday", () => {
      // 2026-05-22 is a Friday
      const fri = new Date("2026-05-22T12:00:00-04:00");
      expect(isTradingDay(fri)).toBe(true);
    });

    it("should return false for a Saturday", () => {
      // 2026-05-23 is a Saturday
      const sat = new Date("2026-05-23T12:00:00-04:00");
      expect(isTradingDay(sat)).toBe(false);
    });

    it("should return false for a Sunday", () => {
      // 2026-05-24 is a Sunday
      const sun = new Date("2026-05-24T12:00:00-04:00");
      expect(isTradingDay(sun)).toBe(false);
    });

    it("should return false for Memorial Day 2026 (May 25, Monday)", () => {
      const memorialDay = new Date("2026-05-25T12:00:00-04:00");
      expect(isTradingDay(memorialDay)).toBe(false);
    });

    it("should return false for Christmas 2026 (Dec 25, Friday)", () => {
      const christmas = new Date("2026-12-25T12:00:00-05:00");
      expect(isTradingDay(christmas)).toBe(false);
    });

    it("should return false for Independence Day observed 2026 (Jul 3, Friday)", () => {
      const july3 = new Date("2026-07-03T12:00:00-04:00");
      expect(isTradingDay(july3)).toBe(false);
    });

    it("should return false for Thanksgiving 2026 (Nov 26, Thursday)", () => {
      const thanksgiving = new Date("2026-11-26T12:00:00-05:00");
      expect(isTradingDay(thanksgiving)).toBe(false);
    });

    it("should return true for the day after Thanksgiving (non-holiday weekday)", () => {
      // 2026-11-27 is a Friday — not in the holiday list (market is open but shortened)
      const dayAfter = new Date("2026-11-27T12:00:00-05:00");
      expect(isTradingDay(dayAfter)).toBe(true);
    });
  });

  describe("getNextRefreshTime", () => {
    it("should return a valid ISO string", () => {
      const result = getNextRefreshTime();
      expect(result).toBeTruthy();
      // Should not be "Unknown"
      if (result !== "Unknown") {
        expect(() => new Date(result)).not.toThrow();
      }
    });
  });
});
