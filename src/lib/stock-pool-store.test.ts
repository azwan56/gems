// ============================================================
// Tests: Stock Pool Store — isPoolFresh utility
// (Firestore-dependent functions are tested via integration
//  tests with real/emulator Firestore, not unit tests.)
// ============================================================

import { describe, it, expect, vi } from "vitest";
import { isPoolFresh, type StockPoolMeta } from "@/lib/stock-pool-store";

function makeMeta(updatedAt: string): StockPoolMeta {
  return {
    updatedAt,
    symbolCount: 100,
    source: "fmp",
    apiCallsUsed: 600,
  };
}

describe("isPoolFresh", () => {
  it("should return true for recently updated pool", () => {
    const meta = makeMeta(new Date().toISOString());
    expect(isPoolFresh(meta)).toBe(true);
  });

  it("should return false for pool older than 12 hours", () => {
    const thirteenHoursAgo = new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString();
    const meta = makeMeta(thirteenHoursAgo);
    expect(isPoolFresh(meta)).toBe(false);
  });

  it("should return true for pool updated exactly 11 hours ago", () => {
    const elevenHoursAgo = new Date(Date.now() - 11 * 60 * 60 * 1000).toISOString();
    const meta = makeMeta(elevenHoursAgo);
    expect(isPoolFresh(meta)).toBe(true);
  });

  it("should support custom maxAgeHours", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const meta = makeMeta(twoHoursAgo);

    expect(isPoolFresh(meta, 1)).toBe(false);  // 2hr old, max 1hr → stale
    expect(isPoolFresh(meta, 3)).toBe(true);   // 2hr old, max 3hr → fresh
  });

  it("should return false for very old dates", () => {
    const meta = makeMeta("2024-01-01T00:00:00Z");
    expect(isPoolFresh(meta)).toBe(false);
  });

  it("should handle edge case: maxAgeHours = 0", () => {
    // Even a just-created pool is "stale" with 0-hour max age
    // (unless Date.now is exactly the same ms, which is extremely unlikely)
    const meta = makeMeta(new Date(Date.now() - 1).toISOString());
    expect(isPoolFresh(meta, 0)).toBe(false);
  });

  it("should differentiate mock vs fmp source", () => {
    const mockMeta: StockPoolMeta = {
      updatedAt: new Date().toISOString(),
      symbolCount: 24,
      source: "mock",
      apiCallsUsed: 0,
    };
    // isPoolFresh only checks time, not source
    expect(isPoolFresh(mockMeta)).toBe(true);
  });
});
