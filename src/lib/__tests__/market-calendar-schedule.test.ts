import { describe, it, expect } from "vitest";
import { tradingDaysUntilMonthEnd, isFirstTradingDayOfMonth } from "../market-calendar";

/**
 * Helper: create a date that is noon ET on the given calendar day.
 * 16:00 UTC = 12:00 ET (during EDT, Mar-Nov).
 */
function etDate(y: number, m: number, d: number): Date {
  return new Date(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T16:00:00Z`);
}

describe("tradingDaysUntilMonthEnd", () => {
  // May 2026: Memorial Day May 25 (Mon) is a holiday
  // Last trading day: May 29 (Fri)

  it("May 29 (Fri, last trading day) → 0", () => {
    expect(tradingDaysUntilMonthEnd(etDate(2026, 5, 29))).toBe(0);
  });

  it("May 28 (Thu) → 1 trading day remaining", () => {
    expect(tradingDaysUntilMonthEnd(etDate(2026, 5, 28))).toBe(1);
  });

  it("May 27 (Wed) → 2 trading days remaining (T-2 trigger)", () => {
    expect(tradingDaysUntilMonthEnd(etDate(2026, 5, 27))).toBe(2);
  });

  it("May 22 (Fri) → 4 trading days remaining (May 25 Mon is Memorial Day)", () => {
    // May 26 Tue, May 27 Wed, May 28 Thu, May 29 Fri → 4 trading days
    expect(tradingDaysUntilMonthEnd(etDate(2026, 5, 22))).toBe(4);
  });

  it("May 21 (Thu) → 5 trading days remaining (T-5 trigger)", () => {
    // May 22 Fri, May 26 Tue, May 27 Wed, May 28 Thu, May 29 Fri → 5
    expect(tradingDaysUntilMonthEnd(etDate(2026, 5, 21))).toBe(5);
  });

  // June 2026: last calendar day June 30 (Tue)
  it("June 30 (Tue, last trading day) → 0", () => {
    expect(tradingDaysUntilMonthEnd(etDate(2026, 6, 30))).toBe(0);
  });

  it("June 1 (Mon) → many trading days remaining", () => {
    // June has ~22 trading days, June 1 is the first
    const td = tradingDaysUntilMonthEnd(etDate(2026, 6, 1));
    expect(td).toBeGreaterThan(15);
  });
});

describe("isFirstTradingDayOfMonth", () => {
  it("June 1, 2026 (Mon) → true (first trading day)", () => {
    expect(isFirstTradingDayOfMonth(etDate(2026, 6, 1))).toBe(true);
  });

  it("June 2, 2026 (Tue) → false (second trading day)", () => {
    expect(isFirstTradingDayOfMonth(etDate(2026, 6, 2))).toBe(false);
  });

  // January 2026: Jan 1 is New Year's Day (holiday)
  it("Jan 1, 2026 (Thu, holiday) → false", () => {
    expect(isFirstTradingDayOfMonth(etDate(2026, 1, 1))).toBe(false);
  });

  it("Jan 2, 2026 (Fri) → true (first trading day after NYD)", () => {
    expect(isFirstTradingDayOfMonth(etDate(2026, 1, 2))).toBe(true);
  });

  // Weekend
  it("June 6, 2026 (Sat) → false", () => {
    expect(isFirstTradingDayOfMonth(etDate(2026, 6, 6))).toBe(false);
  });
});
