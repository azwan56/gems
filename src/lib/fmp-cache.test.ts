// ============================================================
// Tests: FMP Cache — TTL cache utility
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";
import { getCached, setCache, clearCache, cacheSize, DEFAULT_TTL_MS } from "@/lib/fmp-cache";

beforeEach(() => {
  clearCache();
});

describe("FMP Cache", () => {
  it("should return null for missing keys", () => {
    expect(getCached("nonexistent")).toBeNull();
  });

  it("should store and retrieve values", () => {
    setCache("key1", { value: 42 });
    expect(getCached<{ value: number }>("key1")).toEqual({ value: 42 });
  });

  it("should support different value types", () => {
    setCache("string", "hello");
    setCache("number", 123);
    setCache("array", [1, 2, 3]);
    setCache("null_val", null);

    expect(getCached<string>("string")).toBe("hello");
    expect(getCached<number>("number")).toBe(123);
    expect(getCached<number[]>("array")).toEqual([1, 2, 3]);
    expect(getCached<null>("null_val")).toBeNull(); // null stored = null returned
  });

  it("should return null for expired entries", () => {
    // Set with very short TTL
    setCache("expiring", "data", 1); // 1ms TTL

    // Advance time
    vi.useFakeTimers();
    vi.advanceTimersByTime(10);

    expect(getCached("expiring")).toBeNull();

    vi.useRealTimers();
  });

  it("should not expire entries within TTL", () => {
    vi.useFakeTimers();
    setCache("fresh", "data", 60_000); // 1 minute TTL

    vi.advanceTimersByTime(30_000); // 30 seconds later
    expect(getCached<string>("fresh")).toBe("data");

    vi.useRealTimers();
  });

  it("should clear all entries", () => {
    setCache("a", 1);
    setCache("b", 2);
    setCache("c", 3);
    expect(cacheSize()).toBe(3);

    clearCache();
    expect(cacheSize()).toBe(0);
    expect(getCached("a")).toBeNull();
    expect(getCached("b")).toBeNull();
    expect(getCached("c")).toBeNull();
  });

  it("should overwrite existing keys", () => {
    setCache("key", "v1");
    expect(getCached<string>("key")).toBe("v1");

    setCache("key", "v2");
    expect(getCached<string>("key")).toBe("v2");
  });

  it("should use default TTL when none specified", () => {
    expect(DEFAULT_TTL_MS).toBe(30 * 60 * 1000); // 30 minutes
  });

  it("should report correct cache size", () => {
    expect(cacheSize()).toBe(0);
    setCache("x", 1);
    expect(cacheSize()).toBe(1);
    setCache("y", 2);
    expect(cacheSize()).toBe(2);
  });
});
