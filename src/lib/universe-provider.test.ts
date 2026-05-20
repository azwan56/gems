// ============================================================
// Tests: Universe Provider — dynamic stock universe management
// ============================================================

import { describe, it, expect } from "vitest";
import { RUSSELL_MIDCAP_ADDITIONS, chunkUniverse } from "@/lib/universe-provider";

describe("Universe Provider", () => {
  describe("RUSSELL_MIDCAP_ADDITIONS", () => {
    it("should have a substantial number of symbols", () => {
      expect(RUSSELL_MIDCAP_ADDITIONS.length).toBeGreaterThan(200);
    });

    it("should contain only uppercase strings", () => {
      for (const sym of RUSSELL_MIDCAP_ADDITIONS) {
        expect(sym).toBe(sym.toUpperCase());
      }
    });

    it("should not have duplicates", () => {
      const unique = new Set(RUSSELL_MIDCAP_ADDITIONS.map(s => s.toUpperCase()));
      expect(unique.size).toBe(RUSSELL_MIDCAP_ADDITIONS.length);
    });

    it("should include well-known mid-cap stocks", () => {
      const set = new Set(RUSSELL_MIDCAP_ADDITIONS.map(s => s.toUpperCase()));
      // Tech
      expect(set.has("TWLO")).toBe(true);
      expect(set.has("ROKU")).toBe(true);
      // Biotech
      expect(set.has("CRSP")).toBe(true);
      // REITs
      expect(set.has("AMT")).toBe(true);
      // Energy
      expect(set.has("DVN")).toBe(true);
    });
  });

  describe("chunkUniverse", () => {
    const symbols = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];

    it("should split into 3 roughly equal chunks", () => {
      const chunk1 = chunkUniverse(symbols, 3, 0);
      const chunk2 = chunkUniverse(symbols, 3, 1);
      const chunk3 = chunkUniverse(symbols, 3, 2);

      // All chunks combined should equal original
      const combined = [...chunk1, ...chunk2, ...chunk3];
      expect(combined).toEqual(symbols);
    });

    it("should handle uneven splits", () => {
      const tenSymbols = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
      const c1 = chunkUniverse(tenSymbols, 3, 0); // 4
      const c2 = chunkUniverse(tenSymbols, 3, 1); // 4
      const c3 = chunkUniverse(tenSymbols, 3, 2); // 2
      
      expect(c1.length + c2.length + c3.length).toBe(10);
      expect([...c1, ...c2, ...c3]).toEqual(tenSymbols);
    });

    it("should return empty array for out-of-bounds chunk", () => {
      const result = chunkUniverse(symbols, 3, 5);
      expect(result).toEqual([]);
    });

    it("should handle single chunk (full list)", () => {
      const result = chunkUniverse(symbols, 1, 0);
      expect(result).toEqual(symbols);
    });
  });
});
