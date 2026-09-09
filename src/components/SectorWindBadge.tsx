"use client";

import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { MACRO_SECTOR_NAMES_ZH } from "@/lib/sector-map";

interface SectorWindBadgeProps {
  wind?: "tailwind" | "neutral" | "headwind" | null;
  quadrant?: string | null;
  etf?: string | null;
  sectorName?: string | null;
  size?: "sm" | "md";
  className?: string;
  // Sub-industry props
  subIndustryETF?: string | null;
  subIndustryName?: string | null;
  subIndustryQuadrant?: string | null;
  subIndustryWind?: "tailwind" | "neutral" | "headwind" | null;
}

export const SectorWindBadge: React.FC<SectorWindBadgeProps> = ({
  wind,
  quadrant,
  etf,
  sectorName,
  size = "sm",
  className = "",
  subIndustryETF,
  subIndustryName,
  subIndustryQuadrant,
  subIndustryWind,
}) => {
  const effectiveWind = subIndustryWind ?? wind;
  const effectiveQuad = subIndustryQuadrant ?? quadrant;
  const displayETF = subIndustryETF || etf;
  const macroNameZh = (sectorName && MACRO_SECTOR_NAMES_ZH[sectorName]) || (etf && MACRO_SECTOR_NAMES_ZH[etf]) || null;
  const displayName = subIndustryName || macroNameZh;

  if (!effectiveWind && !effectiveQuad) return null;

  const isTailwind = effectiveWind === "tailwind" || effectiveQuad === "Leading" || effectiveQuad === "Improving";
  const isHeadwind = effectiveWind === "headwind" || effectiveQuad === "Lagging" || effectiveQuad === "Weakening";

  let badgeColor = "bg-slate-800/80 text-slate-300 border-slate-700";
  let icon = <Minus className="w-3 h-3 text-slate-400" />;
  let label = displayName ? `${displayName} —` : "中性";

  if (isTailwind) {
    badgeColor = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    icon = <TrendingUp className="w-3 h-3 text-emerald-400" />;
    label = displayName
      ? `${displayName} ↗`
      : (effectiveQuad === "Improving" ? "改善 ↗" : "顺风 ↗");
  } else if (isHeadwind) {
    badgeColor = "bg-rose-500/15 text-rose-400 border-rose-500/30";
    icon = <TrendingDown className="w-3 h-3 text-rose-400" />;
    label = displayName
      ? `${displayName} ↘`
      : (effectiveQuad === "Weakening" ? "转弱 ↘" : "逆风 ↘");
  }

  // Dual-tier hover tooltip
  let tooltip = "";
  if (subIndustryETF && etf && subIndustryETF !== etf) {
    tooltip = `细分赛道: ${displayName ? `${displayName} (${subIndustryETF})` : subIndustryETF} [RRG ${subIndustryQuadrant || "中性"}]\n大类板块: ${etf} [RRG ${quadrant || "中性"}]\n综合权重: 65% 细分 + 35% 宏观大类`;
  } else {
    tooltip = `行业 ETF: ${etf || "SPY"} (RRG: ${quadrant || "中性"})`;
  }

  const paddingClass = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs";

  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1 font-medium rounded border cursor-help transition-colors ${badgeColor} ${paddingClass} ${className}`}
    >
      {icon}
      <span>{label}</span>
      {displayETF && <span className="opacity-60 text-[9px] font-mono">({displayETF})</span>}
    </span>
  );
};

export default SectorWindBadge;
