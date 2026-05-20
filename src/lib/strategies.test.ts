// ============================================================
// Unit Tests: Strategy Presets
// ============================================================

import { describe, it, expect } from "vitest";
import { getStrategyPreset, getAllStrategyPresets, STRATEGY_PRESETS } from "@/lib/strategies";

describe("Strategy Presets", () => {
  it("should have all 4 presets defined", () => {
    expect(STRATEGY_PRESETS.value).toBeDefined();
    expect(STRATEGY_PRESETS.large_growth).toBeDefined();
    expect(STRATEGY_PRESETS.small_growth).toBeDefined();
    expect(STRATEGY_PRESETS.seeking_alpha).toBeDefined();
  });

  it("should return a preset by ID", () => {
    const value = getStrategyPreset("value");
    expect(value).toBeDefined();
    expect(value!.id).toBe("value");
    expect(value!.name).toBe("Value Investing");
    expect(value!.nameZh).toBe("价值投资");
  });

  it("should return undefined for unknown ID", () => {
    expect(getStrategyPreset("unknown_strategy")).toBeUndefined();
  });

  it("should return all presets as an array", () => {
    const all = getAllStrategyPresets();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBe(4);
    const ids = all.map((p) => p.id);
    expect(ids).toContain("value");
    expect(ids).toContain("large_growth");
    expect(ids).toContain("small_growth");
    expect(ids).toContain("seeking_alpha");
  });

  it("large_growth preset should have correct default filters", () => {
    const growth = getStrategyPreset("large_growth")!;
    const fields = growth.defaultFilters.map((f) => f.field);
    expect(fields).toContain("revenueGrowthYoY");
    expect(fields).toContain("epsGrowthYoY");
    expect(fields).toContain("freeCashFlowYield");
    expect(fields).toContain("grossMargin");
    expect(fields).toContain("marketCap");
  });

  it("all presets should have required metadata fields", () => {
    for (const preset of getAllStrategyPresets()) {
      expect(preset.id).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.nameZh).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.descriptionZh).toBeTruthy();
      expect(preset.icon).toBeTruthy();
      expect(preset.color).toBeTruthy();
      // seeking_alpha has no default filters (bypasses screening)
      if (preset.id !== "seeking_alpha") {
        expect(preset.defaultFilters.length).toBeGreaterThan(0);
      }
    }
  });

  it("seeking_alpha preset should have empty default filters", () => {
    const sa = getStrategyPreset("seeking_alpha")!;
    expect(sa.defaultFilters).toEqual([]);
    expect(sa.name).toBe("Seeking Alpha Picks");
  });
});
