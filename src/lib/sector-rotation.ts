// ============================================================
// Sector Rotation Models & Calculation Utilities
// Completely client-safe (no Node/Firebase dependencies)
// ============================================================

import { getSectorInfo, getSectorETF, getSubIndustryInfo } from "./sector-map";

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
  subIndustries?: Record<string, {
    name: string;
    parentSector?: string;
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

  // Level-2 Sub-Industry & Thematic Alpha
  subIndustryETF?: string | null;
  subIndustryName?: string | null;
  subIndustryNameZh?: string | null;
  subIndustryQuadrant?: "Leading" | "Weakening" | "Lagging" | "Improving" | "Unknown" | null;
  subIndustryWind?: "tailwind" | "neutral" | "headwind" | null;
  subIndustryScore?: number | null;
  subIndustryAction?: string | null;
  parentSectorScore?: number | null;
}

/**
 * Calculate the top-down sector wind and rotation score for a specific stock.
 * Supports both Level-1 Macro Sectors (e.g. XLK) and Level-2 Granular Sub-Industries (e.g. SMH, IGV).
 * Pure function: Safe to run on both client and server.
 */
export function getSectorRotationForStockSync(
  symbol: string,
  sectorName?: string,
  industryOrData?: string | SectorRotationData | null,
  maybeRotationData?: SectorRotationData | null,
  options?: { marketCap?: number | null; strategy?: string | null }
): StockSectorWind {
  const symUpper = symbol.toUpperCase();
  const info = getSectorInfo(symUpper);
  const resolvedSector = sectorName && sectorName !== "Unknown" ? sectorName : info.sector;
  const etf = getSectorETF(resolvedSector);

  // Normalize parameters for backward compatibility
  let industryName: string | undefined;
  let rotationData: SectorRotationData | null | undefined;
  if (typeof industryOrData === "string") {
    industryName = industryOrData;
    rotationData = maybeRotationData;
  } else {
    rotationData = industryOrData;
    industryName = undefined;
  }

  // Level-1 Parent Sector metrics
  const sectorState = rotationData?.sectors?.[etf];
  const quadrant = sectorState?.quadrant || "Unknown";
  const action = sectorState?.action || "NEUTRAL";
  const macroAlign = sectorState?.macroAlignment || "neutral";

  let parentWind: "tailwind" | "neutral" | "headwind" = "neutral";
  let parentScore = 50;

  if (quadrant === "Leading") {
    parentWind = macroAlign === "avoid" ? "neutral" : "tailwind";
    parentScore = 90;
  } else if (quadrant === "Improving") {
    parentWind = macroAlign === "avoid" ? "neutral" : "tailwind";
    parentScore = 78;
  } else if (quadrant === "Weakening") {
    parentWind = macroAlign === "favored" ? "neutral" : "headwind";
    parentScore = 45;
  } else if (quadrant === "Lagging") {
    parentWind = "headwind";
    parentScore = 25;
  }

  if (macroAlign === "favored") parentScore = Math.min(100, parentScore + 10);
  if (macroAlign === "avoid") parentScore = Math.max(0, parentScore - 15);

  // Level-2 Sub-Industry resolution (supports exact, semantic keyword, and Russell 2000 IWO fallback)
  const subInfo = getSubIndustryInfo(symUpper, industryName || info.industry, options);
  let subIndustryETF: string | null = null;
  let subIndustryName: string | null = null;
  let subIndustryNameZh: string | null = null;
  let subIndustryQuadrant: "Leading" | "Weakening" | "Lagging" | "Improving" | "Unknown" | null = null;
  let subIndustryWind: "tailwind" | "neutral" | "headwind" | null = null;
  let subIndustryScore: number | null = null;
  let subIndustryAction: string | null = null;

  if (subInfo && subInfo.etf) {
    subIndustryETF = subInfo.etf;
    subIndustryName = subInfo.name;
    subIndustryNameZh = subInfo.nameZh;

    const subState = rotationData?.subIndustries?.[subInfo.etf];
    subIndustryQuadrant = subState?.quadrant || "Unknown";
    subIndustryAction = subState?.action || "NEUTRAL";
    const subMacroAlign = subState?.macroAlignment || "neutral";

    let subBase = 50;
    if (subIndustryQuadrant === "Leading") {
      subIndustryWind = subMacroAlign === "avoid" ? "neutral" : "tailwind";
      subBase = 90;
    } else if (subIndustryQuadrant === "Improving") {
      subIndustryWind = subMacroAlign === "avoid" ? "neutral" : "tailwind";
      subBase = 78;
    } else if (subIndustryQuadrant === "Weakening") {
      subIndustryWind = subMacroAlign === "favored" ? "neutral" : "headwind";
      subBase = 45;
    } else if (subIndustryQuadrant === "Lagging") {
      subIndustryWind = "headwind";
      subBase = 25;
    } else {
      subIndustryWind = "neutral";
      subBase = 50;
    }

    if (subMacroAlign === "favored") subBase = Math.min(100, subBase + 10);
    if (subMacroAlign === "avoid") subBase = Math.max(0, subBase - 15);
    subIndustryScore = subBase;
  }

  // Blended scoring & effective wind:
  // When sub-industry exists: 65% sub-industry + 35% parent sector
  let effectiveScore = parentScore;
  let effectiveWind = parentWind;
  let effectiveAction = action;

  if (subIndustryScore !== null && subIndustryWind !== null) {
    effectiveScore = Math.round(0.35 * parentScore + 0.65 * subIndustryScore);
    effectiveWind = subIndustryWind;
    if (subIndustryAction && subIndustryAction !== "NEUTRAL") {
      effectiveAction = subIndustryAction as any;
    }
  }

  // Dual-tier advice generation
  let advice = "板块动能处于平稳期，按个股估值与形态正常操作。";
  if (subIndustryETF && subIndustryNameZh && subIndustryQuadrant && subIndustryQuadrant !== "Unknown") {
    const subWindLabel = subIndustryWind === "tailwind" ? "顺风" : subIndustryWind === "headwind" ? "逆风" : "中性";
    if (subIndustryWind === parentWind) {
      if (effectiveWind === "tailwind") {
        advice = `细分赛道【${subIndustryNameZh} (${subIndustryETF})】与大类【${resolvedSector} (${etf})】双重共振，处于 RRG ${subIndustryQuadrant} 象限，享有强劲行业顺风 Beta。`;
      } else if (effectiveWind === "headwind") {
        advice = `细分赛道【${subIndustryNameZh} (${subIndustryETF})】与大类【${resolvedSector} (${etf})】双双走弱，处于 RRG ${subIndustryQuadrant} 象限，防范行业杀估值风险，避免盲目追高。`;
      } else {
        advice = `细分赛道【${subIndustryNameZh} (${subIndustryETF})】处于 RRG ${subIndustryQuadrant} 象限，动能处于平衡期，按个股基本面精选。`;
      }
    } else {
      advice = `行业内部呈现结构性分化：所属细分【${subIndustryNameZh} (${subIndustryETF})】处于 RRG ${subIndustryQuadrant} (${subWindLabel})，与大盘大类【${resolvedSector} (${etf})】脱钩。综合评分以细分赛道占 65% 权重主导。`;
    }
  } else {
    if (parentWind === "tailwind") {
      advice = `所属 ${resolvedSector} (${etf}) 处于 RRG ${quadrant} 象限，主力资金净流入，享有行业 Beta 顺风红利。`;
    } else if (parentWind === "headwind") {
      advice = `所属 ${resolvedSector} (${etf}) 处于 RRG ${quadrant} 象限，行业动能滞后或失血，防范板块杀估值风险，避免盲目追高。`;
    }
  }

  return {
    symbol: symUpper,
    sectorName: resolvedSector,
    sectorETF: etf,
    quadrant,
    windStatus: effectiveWind,
    action: effectiveAction,
    sectorScore: effectiveScore,
    advice,
    subIndustryETF,
    subIndustryName,
    subIndustryNameZh,
    subIndustryQuadrant,
    subIndustryWind,
    subIndustryScore,
    subIndustryAction,
    parentSectorScore: parentScore,
  };
}
