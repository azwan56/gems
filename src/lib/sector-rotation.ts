// ============================================================
// Sector Rotation Models & Calculation Utilities
// Completely client-safe (no Node/Firebase dependencies)
// ============================================================

import { getSectorInfo, getSectorETF } from "./sector-map";

export interface SectorRotationData {
  date: string;
  macroPhase: string;
  favoredSectors: string[];
  avoidSectors: string[];
  sectors: Record<string, {
    name: string;
    quadrant: "Leading" | "Weakening" | "Lagging" | "Improving" | "Unknown";
    action: "ACCUMULATE" | "HOLD" | "REDUCE" | "AVOID" | "NEUTRAL";
    macroAlignment?: "favored" | "neutral" | "avoid";
    netScore?: number;
    bullishScore?: number;
    bearishScore?: number;
    recommendedStocks?: string[];
    trimStocks?: string[];
  }>;
  narrative?: string;
  tacticalActionCards?: string;
}

export interface StockSectorWind {
  symbol: string;
  sectorName: string;
  sectorETF: string;
  quadrant: "Leading" | "Weakening" | "Lagging" | "Improving" | "Unknown";
  windStatus: "tailwind" | "neutral" | "headwind";
  action: "ACCUMULATE" | "HOLD" | "REDUCE" | "AVOID" | "NEUTRAL";
  sectorScore: number; // 0-100 normalized rotation score
  advice: string;
}

/**
 * Calculate the top-down sector wind and rotation score for a specific stock.
 * Pure function: Safe to run on both client and server.
 */
export function getSectorRotationForStockSync(
  symbol: string,
  sectorName?: string,
  rotationData?: SectorRotationData | null
): StockSectorWind {
  const symUpper = symbol.toUpperCase();
  const info = getSectorInfo(symUpper);
  const resolvedSector = sectorName && sectorName !== "Unknown" ? sectorName : info.sector;
  const etf = getSectorETF(resolvedSector);

  const sectorState = rotationData?.sectors?.[etf];
  const quadrant = sectorState?.quadrant || "Unknown";
  const action = sectorState?.action || "NEUTRAL";
  const macroAlign = sectorState?.macroAlignment || "neutral";

  // Determine Wind Status
  let windStatus: "tailwind" | "neutral" | "headwind" = "neutral";
  let baseScore = 50;

  if (quadrant === "Leading") {
    windStatus = macroAlign === "avoid" ? "neutral" : "tailwind";
    baseScore = 90;
  } else if (quadrant === "Improving") {
    windStatus = macroAlign === "avoid" ? "neutral" : "tailwind";
    baseScore = 78;
  } else if (quadrant === "Weakening") {
    windStatus = macroAlign === "favored" ? "neutral" : "headwind";
    baseScore = 45;
  } else if (quadrant === "Lagging") {
    windStatus = "headwind";
    baseScore = 25;
  }

  // Macro alignment modifier
  if (macroAlign === "favored") baseScore = Math.min(100, baseScore + 10);
  if (macroAlign === "avoid") baseScore = Math.max(0, baseScore - 15);

  let advice = "板块动能处于平稳期，按个股估值与形态正常操作。";
  if (windStatus === "tailwind") {
    advice = `所属 ${resolvedSector} (${etf}) 处于 RRG ${quadrant} 象限，主力资金净流入，享有行业 Beta 顺风红利。`;
  } else if (windStatus === "headwind") {
    advice = `所属 ${resolvedSector} (${etf}) 处于 RRG ${quadrant} 象限，行业动能滞后或失血，防范板块杀估值风险，避免盲目追高。`;
  }

  return {
    symbol: symUpper,
    sectorName: resolvedSector,
    sectorETF: etf,
    quadrant,
    windStatus,
    action,
    sectorScore: baseScore,
    advice,
  };
}
