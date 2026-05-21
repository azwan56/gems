// ============================================================
// Tests for shared FMP fetch module
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fmpFetch, parallelBatchFetch, sleep } from "./fmp-fetch";

// Mock fmp-config
vi.mock("./fmp-config", () => ({
  FMP_STABLE_URL: "https://fmp.example.com/stable",
  getApiKey: () => "test-api-key",
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("fmpFetch", () => {
  it("fetches data successfully on first attempt", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ symbol: "AAPL" }]),
    });

    const result = await fmpFetch<Array<{ symbol: string }>>("/quote", { symbol: "AAPL" });
    expect(result).toEqual([{ symbol: "AAPL" }]);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const calledUrl = new URL(mockFetch.mock.calls[0][0] as string);
    expect(calledUrl.pathname).toBe("/stable/quote");
    expect(calledUrl.searchParams.get("apikey")).toBe("test-api-key");
    expect(calledUrl.searchParams.get("symbol")).toBe("AAPL");
  });

  it("throws on non-429 HTTP errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    await expect(fmpFetch("/quote", { symbol: "AAPL" })).rejects.toThrow(
      "FMP API error: 500 Internal Server Error"
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries on 429 and succeeds", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 429, statusText: "Too Many Requests" })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: "ok" }),
      });

    const result = await fmpFetch("/ratios-ttm", { symbol: "TSLA" }, { backoffBaseMs: 10 });
    expect(result).toEqual({ data: "ok" });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting retries on persistent 429", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429, statusText: "Too Many Requests" });

    await expect(
      fmpFetch("/quote", { symbol: "X" }, { retries: 2, backoffBaseMs: 10 })
    ).rejects.toThrow("FMP 429: Rate Limited (after 2 retries)");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("passes query parameters correctly", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    await fmpFetch("/financial-growth", { symbol: "MSFT", limit: "1" });
    const calledUrl = new URL(mockFetch.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get("symbol")).toBe("MSFT");
    expect(calledUrl.searchParams.get("limit")).toBe("1");
  });
});

describe("parallelBatchFetch", () => {
  it("fetches all items in parallel batches", async () => {
    const fetcher = vi.fn(async (item: string) => ({
      key: item,
      value: { price: 100 },
    }));

    const { map, calls } = await parallelBatchFetch(
      ["AAPL", "TSLA", "MSFT"],
      fetcher,
      { batchSize: 2, delayMs: 0 }
    );

    expect(map.size).toBe(3);
    expect(calls).toBe(3);
    expect(map.get("AAPL")).toEqual({ price: 100 });
  });

  it("collects errors without failing", async () => {
    const errors: string[] = [];
    const fetcher = vi.fn(async (item: string) => {
      if (item === "BAD") throw new Error("Fetch failed");
      return { key: item, value: 42 };
    });

    const { map, calls } = await parallelBatchFetch(
      ["GOOD", "BAD", "OK"],
      fetcher,
      { batchSize: 3, delayMs: 0, errors }
    );

    expect(map.size).toBe(2);
    expect(calls).toBe(3);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("Fetch failed");
  });

  it("skips null results from fetcher", async () => {
    const fetcher = vi.fn(async (item: string) => {
      if (item === "SKIP") return null;
      return { key: item, value: "data" };
    });

    const { map } = await parallelBatchFetch(
      ["A", "SKIP", "B"],
      fetcher,
      { batchSize: 5, delayMs: 0 }
    );

    expect(map.size).toBe(2);
    expect(map.has("SKIP")).toBe(false);
  });

  it("handles empty input array", async () => {
    const fetcher = vi.fn(async () => ({ key: "X", value: 1 }));
    const { map, calls } = await parallelBatchFetch([], fetcher, { delayMs: 0 });
    expect(map.size).toBe(0);
    expect(calls).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("sleep", () => {
  it("resolves after the specified delay", async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40); // allow some tolerance
  });
});
