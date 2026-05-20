// ============================================================
// Tests: FMP Config — shared FMP API configuration
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FMP_STABLE_URL, getApiKey, hasApiKey } from "@/lib/fmp-config";

describe("FMP Config", () => {
  const originalKey = process.env.FMP_API_KEY;

  afterEach(() => {
    // Restore original env
    if (originalKey !== undefined) {
      process.env.FMP_API_KEY = originalKey;
    } else {
      delete process.env.FMP_API_KEY;
    }
  });

  it("should export the correct FMP stable URL", () => {
    expect(FMP_STABLE_URL).toBe("https://financialmodelingprep.com/stable");
  });

  it("getApiKey should return the key when set", () => {
    process.env.FMP_API_KEY = "dummy";
    expect(getApiKey()).toBe("dummy");
  });

  it("getApiKey should throw when key is not set", () => {
    delete process.env.FMP_API_KEY;
    expect(() => getApiKey()).toThrow("FMP_API_KEY environment variable is not set");
  });

  it("hasApiKey should return true when key is set", () => {
    process.env.FMP_API_KEY = "some-key";
    expect(hasApiKey()).toBe(true);
  });

  it("hasApiKey should return false when key is not set", () => {
    delete process.env.FMP_API_KEY;
    expect(hasApiKey()).toBe(false);
  });

  it("hasApiKey should return false for empty string", () => {
    process.env.FMP_API_KEY = "";
    expect(hasApiKey()).toBe(false);
  });
});
