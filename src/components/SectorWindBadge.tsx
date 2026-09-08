"use client";

import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface SectorWindBadgeProps {
  wind?: "tailwind" | "neutral" | "headwind" | null;
  quadrant?: string | null;
  etf?: string | null;
  size?: "sm" | "md";
  className?: string;
}

export const SectorWindBadge: React.FC<SectorWindBadgeProps> = ({
  wind,
  quadrant,
  etf,
  size = "sm",
  className = "",
}) => {
  if (!wind && !quadrant) return null;

  const isTailwind = wind === "tailwind" || quadrant === "Leading" || quadrant === "Improving";
  const isHeadwind = wind === "headwind" || quadrant === "Lagging" || quadrant === "Weakening";

  let badgeColor = "bg-slate-800/80 text-slate-300 border-slate-700";
  let icon = <Minus className="w-3 h-3 text-slate-400" />;
  let label = "中性";
  let tooltip = `行业 ETF: ${etf || "SPY"} (RRG: ${quadrant || "中性"})`;

  if (isTailwind) {
    badgeColor = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    icon = <TrendingUp className="w-3 h-3 text-emerald-400" />;
    label = quadrant === "Improving" ? "改善 ↗" : "顺风 ↗";
    tooltip = `行业 ETF: ${etf || "SPY"} 处于 RRG ${quadrant || "领涨"} 顺风期，机构资金流入`;
  } else if (isHeadwind) {
    badgeColor = "bg-rose-500/15 text-rose-400 border-rose-500/30";
    icon = <TrendingDown className="w-3 h-3 text-rose-400" />;
    label = quadrant === "Weakening" ? "转弱 ↘" : "逆风 ↘";
    tooltip = `行业 ETF: ${etf || "SPY"} 处于 RRG ${quadrant || "落后"} 逆风期，行业整体失血`;
  }

  const paddingClass = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs";

  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1 font-medium rounded border cursor-help transition-colors ${badgeColor} ${paddingClass} ${className}`}
    >
      {icon}
      <span>{label}</span>
      {etf && <span className="opacity-60 text-[9px] font-mono">({etf})</span>}
    </span>
  );
};

export default SectorWindBadge;
