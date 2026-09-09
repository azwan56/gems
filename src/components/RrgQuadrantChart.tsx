"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Compass,
  Layers,
  Info,
  Maximize2,
  Minimize2,
  X,
  TrendingUp,
  TrendingDown,
  Activity,
  Sparkles,
  Search,
} from "lucide-react";
import type {
  SectorRotationData,
  SectorRotationItem,
  SubIndustryRotationItem,
  RrgPoint,
} from "@/lib/sector-rotation";

interface RrgQuadrantChartProps {
  data?: SectorRotationData | null;
  highlightETF?: string | null;
  highlightSubETF?: string | null;
  symbol?: string | null;
  isModal?: boolean;
  onClose?: () => void;
  className?: string;
}

type FilterScope = "all" | "sectors" | "sub_industries";
type QuadrantFilter = "all" | "Leading" | "Improving" | "Weakening" | "Lagging";

interface ChartNode {
  symbol: string;
  name: string;
  isSubIndustry: boolean;
  parentSector?: string;
  quadrant: "Leading" | "Weakening" | "Lagging" | "Improving" | "Unknown";
  action: "ACCUMULATE" | "HOLD" | "REDUCE" | "AVOID" | "NEUTRAL";
  macroAlignment?: "favored" | "neutral" | "avoid";
  rsRatio: number;
  rsMomentum: number;
  velocity: number;
  directionAngle: number;
  trajectory: RrgPoint[];
  recommendedStocks?: string[];
  trimStocks?: string[];
  netScore?: number;
}

export const RrgQuadrantChart: React.FC<RrgQuadrantChartProps> = ({
  data: initialData,
  highlightETF,
  highlightSubETF,
  symbol,
  isModal = false,
  onClose,
  className = "",
}) => {
  const [data, setData] = useState<SectorRotationData | null>(initialData || null);
  const [loading, setLoading] = useState<boolean>(!initialData);
  const [scope, setScope] = useState<FilterScope>("all");
  const [quadrantFilter, setQuadrantFilter] = useState<QuadrantFilter>("all");
  const [hoveredNode, setHoveredNode] = useState<ChartNode | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Fetch from API if data not provided
  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setLoading(false);
      return;
    }

    let isMounted = true;
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch("/api/sector-rotation");
        if (!res.ok) throw new Error("Failed to load sector rotation");
        const json = await res.json();
        if (isMounted && json.data) {
          setData(json.data);
        }
      } catch (err) {
        console.warn("[RrgQuadrantChart] Error loading rotation data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [initialData]);

  // Transform sectors and sub-industries into uniform nodes
  const allNodes: ChartNode[] = useMemo(() => {
    if (!data) return [];
    const list: ChartNode[] = [];

    // Macro sectors
    if (data.sectors) {
      for (const [sym, s] of Object.entries(data.sectors)) {
        list.push({
          symbol: sym,
          name: s.name,
          isSubIndustry: false,
          quadrant: s.quadrant,
          action: s.action,
          macroAlignment: s.macroAlignment,
          rsRatio: s.rsRatio ?? 100,
          rsMomentum: s.rsMomentum ?? 100,
          velocity: s.velocity ?? 0,
          directionAngle: s.directionAngle ?? 0,
          trajectory: s.trajectory || [],
          recommendedStocks: s.recommendedStocks,
          trimStocks: s.trimStocks,
          netScore: s.netScore,
        });
      }
    }

    // Sub-industries
    if (data.subIndustries) {
      for (const [sym, s] of Object.entries(data.subIndustries)) {
        list.push({
          symbol: sym,
          name: s.name,
          isSubIndustry: true,
          parentSector: s.parentSector,
          quadrant: s.quadrant,
          action: s.action,
          macroAlignment: s.macroAlignment,
          rsRatio: s.rsRatio ?? 100,
          rsMomentum: s.rsMomentum ?? 100,
          velocity: s.velocity ?? 0,
          directionAngle: s.directionAngle ?? 0,
          trajectory: s.trajectory || [],
          recommendedStocks: s.recommendedStocks,
          trimStocks: s.trimStocks,
          netScore: s.netScore,
        });
      }
    }

    return list;
  }, [data]);

  // Filtered nodes
  const filteredNodes = useMemo(() => {
    return allNodes.filter((n) => {
      // Scope filter
      if (scope === "sectors" && n.isSubIndustry) return false;
      if (scope === "sub_industries" && !n.isSubIndustry) return false;

      // Quadrant filter
      if (quadrantFilter !== "all" && n.quadrant !== quadrantFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesSym = n.symbol.toLowerCase().includes(q);
        const matchesName = n.name.toLowerCase().includes(q);
        const matchesParent = n.parentSector?.toLowerCase().includes(q);
        const matchesStock = n.recommendedStocks?.some((st) => st.toLowerCase().includes(q));
        if (!matchesSym && !matchesName && !matchesParent && !matchesStock) return false;
      }

      return true;
    });
  }, [allNodes, scope, quadrantFilter, searchQuery]);

  // Calculate dynamic axis ranges with padding
  const { minX, maxX, minY, maxY } = useMemo(() => {
    if (allNodes.length === 0) {
      return { minX: 96, maxX: 104, minY: 96, maxY: 104 };
    }

    let minRatio = 100;
    let maxRatio = 100;
    let minMom = 100;
    let maxMom = 100;

    for (const node of allNodes) {
      if (node.rsRatio < minRatio) minRatio = node.rsRatio;
      if (node.rsRatio > maxRatio) maxRatio = node.rsRatio;
      if (node.rsMomentum < minMom) minMom = node.rsMomentum;
      if (node.rsMomentum > maxMom) maxMom = node.rsMomentum;

      for (const t of node.trajectory) {
        if (t.rs_ratio < minRatio) minRatio = t.rs_ratio;
        if (t.rs_ratio > maxRatio) maxRatio = t.rs_ratio;
        if (t.rs_momentum < minMom) minMom = t.rs_momentum;
        if (t.rs_momentum > maxMom) maxMom = t.rs_momentum;
      }
    }

    // Ensure 100 is nicely in the middle or balanced
    const spanX = Math.max(Math.abs(100 - minRatio), Math.abs(maxRatio - 100), 2.5) * 1.15;
    const spanY = Math.max(Math.abs(100 - minMom), Math.abs(maxMom - 100), 2.5) * 1.15;

    return {
      minX: Number((100 - spanX).toFixed(2)),
      maxX: Number((100 + spanX).toFixed(2)),
      minY: Number((100 - spanY).toFixed(2)),
      maxY: Number((100 + spanY).toFixed(2)),
    };
  }, [allNodes]);

  // Coordinate mapper functions
  const width = 800;
  const height = 560;
  const padding = { top: 40, right: 40, bottom: 45, left: 55 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const toX = (val: number) => {
    return padding.left + ((val - minX) / (maxX - minX)) * plotWidth;
  };

  const toY = (val: number) => {
    // In SVG Y increases downwards, so maxY is at the top
    return padding.top + ((maxY - val) / (maxY - minY)) * plotHeight;
  };

  const centerX = toX(100);
  const centerY = toY(100);

  const isTargetNode = (node: ChartNode) => {
    if (highlightSubETF && node.symbol === highlightSubETF) return true;
    if (highlightETF && node.symbol === highlightETF) return true;
    return false;
  };

  return (
    <div
      className={`bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-6 text-slate-200 backdrop-blur-md shadow-2xl transition-all ${
        isFullscreen ? "fixed inset-2 z-50 overflow-auto sm:inset-6" : ""
      } ${className}`}
    >
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <Compass className="w-5 h-5" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide flex items-center gap-2">
              <span>RRG 相对旋转四象限图</span>
              <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                11 大类 + 16 细分
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            基准 SPY (100, 100) • 资金轮动规律：改善 (筑底) ➔ 领涨 (主升) ➔ 转弱 (见顶) ➔ 落后 (去杠杆)
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="搜索 ETF 或板块..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-800/90 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-36 sm:w-44"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-2 text-slate-500 hover:text-white text-xs"
              >
                ×
              </button>
            )}
          </div>

          {/* Scope Toggle */}
          <div className="flex bg-slate-800/90 p-0.5 rounded-lg border border-slate-700/80 text-xs">
            <button
              onClick={() => setScope("all")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                scope === "all" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              全部 ({allNodes.length})
            </button>
            <button
              onClick={() => setScope("sectors")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                scope === "sectors" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              大类 (11)
            </button>
            <button
              onClick={() => setScope("sub_industries")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                scope === "sub_industries" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              细分 (16)
            </button>
          </div>

          {/* Fullscreen / Close Buttons */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "还原窗口" : "全屏查看"}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {isModal && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-400 rounded-lg border border-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Quadrant Quick Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 py-2.5 text-xs">
        <span className="text-slate-500 mr-1 text-[11px]">象限速查:</span>
        <button
          onClick={() => setQuadrantFilter("all")}
          className={`px-2 py-0.5 rounded-full border text-[11px] transition-all ${
            quadrantFilter === "all"
              ? "bg-slate-700 border-slate-500 text-white"
              : "border-slate-800 text-slate-400 hover:bg-slate-800"
          }`}
        >
          全部象限
        </button>
        <button
          onClick={() => setQuadrantFilter("Leading")}
          className={`px-2 py-0.5 rounded-full border text-[11px] transition-all flex items-center gap-1 ${
            quadrantFilter === "Leading"
              ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold"
              : "border-emerald-500/20 text-emerald-400/70 hover:bg-emerald-500/10"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
          领涨 Leading
        </button>
        <button
          onClick={() => setQuadrantFilter("Improving")}
          className={`px-2 py-0.5 rounded-full border text-[11px] transition-all flex items-center gap-1 ${
            quadrantFilter === "Improving"
              ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-bold"
              : "border-cyan-500/20 text-cyan-400/70 hover:bg-cyan-500/10"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
          改善 Improving
        </button>
        <button
          onClick={() => setQuadrantFilter("Weakening")}
          className={`px-2 py-0.5 rounded-full border text-[11px] transition-all flex items-center gap-1 ${
            quadrantFilter === "Weakening"
              ? "bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold"
              : "border-amber-500/20 text-amber-400/70 hover:bg-amber-500/10"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
          转弱 Weakening
        </button>
        <button
          onClick={() => setQuadrantFilter("Lagging")}
          className={`px-2 py-0.5 rounded-full border text-[11px] transition-all flex items-center gap-1 ${
            quadrantFilter === "Lagging"
              ? "bg-rose-500/20 border-rose-500/50 text-rose-300 font-bold"
              : "border-rose-500/20 text-rose-400/70 hover:bg-rose-500/10"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" />
          落后 Lagging
        </button>
      </div>

      {/* Target Stock / ETF Highlight Alert Banner if provided */}
      {(highlightETF || highlightSubETF) && (
        <div className="mb-3 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              已定位标的{" "}
              {symbol ? <strong className="text-white font-mono">{symbol}</strong> : ""}：
              {highlightSubETF && (
                <span className="text-emerald-400 ml-1">
                  细分赛道 <strong>{highlightSubETF}</strong>
                </span>
              )}
              {highlightETF && (
                <span className="text-blue-400 ml-1">
                  大类板块 <strong>{highlightETF}</strong>
                </span>
              )}
              <span className="text-slate-400 text-[11px] ml-2 hidden sm:inline">
                (图中闪烁呼吸光晕标注)
              </span>
            </span>
          </div>
          <span className="text-slate-400 text-[11px]">顺时针演进中</span>
        </div>
      )}

      {/* SVG Canvas Area */}
      <div className="relative w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none font-sans"
          style={{ minHeight: "380px" }}
        >
          <defs>
            {/* Arrowhead marker for trajectory */}
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="4"
              markerHeight="4"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#94a3b8" />
            </marker>
            <marker
              id="arrow-highlight"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
            </marker>
          </defs>

          {/* Quadrant Shaded Backgrounds */}
          {/* Top-Right: Leading (X > 100, Y > 100 in math, Y < centerY in SVG) */}
          <rect
            x={centerX}
            y={padding.top}
            width={plotWidth - (centerX - padding.left)}
            height={centerY - padding.top}
            fill="rgba(16, 185, 129, 0.05)"
          />
          {/* Top-Left: Improving (X < 100, Y > 100) */}
          <rect
            x={padding.left}
            y={padding.top}
            width={centerX - padding.left}
            height={centerY - padding.top}
            fill="rgba(6, 182, 212, 0.05)"
          />
          {/* Bottom-Left: Lagging (X < 100, Y < 100) */}
          <rect
            x={padding.left}
            y={centerY}
            width={centerX - padding.left}
            height={plotHeight - (centerY - padding.top)}
            fill="rgba(244, 63, 94, 0.05)"
          />
          {/* Bottom-Right: Weakening (X > 100, Y < 100) */}
          <rect
            x={centerX}
            y={centerY}
            width={plotWidth - (centerX - padding.left)}
            height={plotHeight - (centerY - padding.top)}
            fill="rgba(245, 158, 11, 0.05)"
          />

          {/* Grid lines */}
          <line
            x1={padding.left}
            y1={centerY}
            x2={width - padding.right}
            y2={centerY}
            stroke="#334155"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <line
            x1={centerX}
            y1={padding.top}
            x2={centerX}
            y2={height - padding.bottom}
            stroke="#334155"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Quadrant Watermark Titles */}
          <text
            x={width - padding.right - 12}
            y={padding.top + 20}
            textAnchor="end"
            className="text-[13px] font-bold fill-emerald-500/60 tracking-wider"
          >
            领涨 Leading ↗
          </text>
          <text
            x={width - padding.right - 12}
            y={padding.top + 36}
            textAnchor="end"
            className="text-[9px] fill-emerald-400/40"
          >
            顺势持有 / 积极加仓
          </text>

          <text
            x={padding.left + 12}
            y={padding.top + 20}
            textAnchor="start"
            className="text-[13px] font-bold fill-cyan-500/60 tracking-wider"
          >
            ↖ 改善 Improving
          </text>
          <text
            x={padding.left + 12}
            y={padding.top + 36}
            textAnchor="start"
            className="text-[9px] fill-cyan-400/40"
          >
            拐点确立 / 逢低建仓
          </text>

          <text
            x={padding.left + 12}
            y={height - padding.bottom - 26}
            textAnchor="start"
            className="text-[13px] font-bold fill-rose-500/60 tracking-wider"
          >
            ↙ 落后 Lagging
          </text>
          <text
            x={padding.left + 12}
            y={height - padding.bottom - 12}
            textAnchor="start"
            className="text-[9px] fill-rose-400/40"
          >
            持续走弱 / 严格规避
          </text>

          <text
            x={width - padding.right - 12}
            y={height - padding.bottom - 26}
            textAnchor="end"
            className="text-[13px] font-bold fill-amber-500/60 tracking-wider"
          >
            转弱 Weakening ↘
          </text>
          <text
            x={width - padding.right - 12}
            y={height - padding.bottom - 12}
            textAnchor="end"
            className="text-[9px] fill-amber-400/40"
          >
            动能衰竭 / 逢高锁定
          </text>

          {/* Benchmark Center Marker (SPY = 100, 100) */}
          <circle cx={centerX} cy={centerY} r="4" fill="#64748b" />
          <text
            x={centerX + 6}
            y={centerY - 6}
            className="text-[10px] fill-slate-500 font-mono font-semibold"
          >
            SPY (100, 100)
          </text>

          {/* Axis Labels */}
          {/* X Axis: RS-Ratio */}
          <text
            x={centerX}
            y={height - 12}
            textAnchor="middle"
            className="text-[11px] fill-slate-400 font-medium tracking-wide"
          >
            ← 相对大盘弱势 (RS-Ratio &lt; 100) | 相对大盘强势 (RS-Ratio &gt; 100) →
          </text>
          {/* Y Axis: RS-Momentum */}
          <text
            x={-centerY}
            y={16}
            transform="rotate(-90)"
            textAnchor="middle"
            className="text-[11px] fill-slate-400 font-medium tracking-wide"
          >
            ← 动能减速 (RS-Mom &lt; 100) | 动能加速 (RS-Mom &gt; 100) →
          </text>

          {/* 1. Trajectory Tails (drawn first so nodes appear on top) */}
          {filteredNodes.map((node) => {
            if (!node.trajectory || node.trajectory.length < 2) return null;
            const isHovered = hoveredNode?.symbol === node.symbol;
            const isTarget = isTargetNode(node);

            // Path string
            const points = node.trajectory.map((p) => `${toX(p.rs_ratio)},${toY(p.rs_momentum)}`);
            const pathD = `M ${points.join(" L ")}`;

            return (
              <g key={`traj-${node.symbol}`} className="pointer-events-none">
                <path
                  d={pathD}
                  fill="none"
                  stroke={isTarget ? "#38bdf8" : isHovered ? "#94a3b8" : "#475569"}
                  strokeWidth={isTarget ? 2.5 : isHovered ? 2 : 1}
                  strokeOpacity={isTarget ? 0.9 : isHovered ? 0.7 : 0.25}
                  markerEnd={isTarget ? "url(#arrow-highlight)" : "url(#arrow)"}
                  strokeDasharray={node.isSubIndustry ? "2 2" : "none"}
                />
                {/* Historical point dots */}
                {node.trajectory.slice(0, -1).map((p, idx) => (
                  <circle
                    key={idx}
                    cx={toX(p.rs_ratio)}
                    cy={toY(p.rs_momentum)}
                    r={isTarget || isHovered ? 2 : 1.2}
                    fill={isTarget ? "#38bdf8" : "#64748b"}
                    opacity={0.3 + idx * 0.15}
                  />
                ))}
              </g>
            );
          })}

          {/* 2. Interactive Nodes */}
          {filteredNodes.map((node) => {
            const cx = toX(node.rsRatio);
            const cy = toY(node.rsMomentum);
            const isHovered = hoveredNode?.symbol === node.symbol;
            const isTarget = isTargetNode(node);

            // Colors based on quadrant
            let nodeColor = "#94a3b8";
            if (node.quadrant === "Leading") nodeColor = "#10b981";
            else if (node.quadrant === "Improving") nodeColor = "#06b6d4";
            else if (node.quadrant === "Weakening") nodeColor = "#f59e0b";
            else if (node.quadrant === "Lagging") nodeColor = "#f43f5e";

            return (
              <g
                key={node.symbol}
                className="cursor-pointer transition-transform duration-150"
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => setHoveredNode(node)}
              >
                {/* Pulsating target halo */}
                {isTarget && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="16"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2"
                    className="animate-ping opacity-60"
                  />
                )}

                {/* Outer halo on hover */}
                {isHovered && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="14"
                    fill={nodeColor}
                    opacity="0.25"
                  />
                )}

                {/* Node Shape: Circle for Macro Sector, Diamond for Sub-Industry */}
                {node.isSubIndustry ? (
                  // Diamond shape
                  <rect
                    x={cx - (isTarget || isHovered ? 7 : 5)}
                    y={cy - (isTarget || isHovered ? 7 : 5)}
                    width={isTarget || isHovered ? 14 : 10}
                    height={isTarget || isHovered ? 14 : 10}
                    transform={`rotate(45 ${cx} ${cy})`}
                    fill={nodeColor}
                    stroke={isTarget ? "#ffffff" : "#0f172a"}
                    strokeWidth={isTarget ? 2 : 1.5}
                    className="transition-all"
                  />
                ) : (
                  // Circular shape
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isTarget || isHovered ? 8 : 6}
                    fill={nodeColor}
                    stroke={isTarget ? "#ffffff" : "#0f172a"}
                    strokeWidth={isTarget ? 2 : 1.5}
                    className="transition-all"
                  />
                )}

                {/* Label */}
                <text
                  x={cx + (node.isSubIndustry ? 8 : 9)}
                  y={cy + 3}
                  className={`text-[10px] font-mono select-none ${
                    isTarget
                      ? "fill-sky-300 font-bold text-[11px]"
                      : isHovered
                      ? "fill-white font-bold"
                      : "fill-slate-300"
                  }`}
                  filter={isTarget ? "drop-shadow(0px 1px 2px rgba(0,0,0,0.9))" : undefined}
                >
                  {node.symbol}
                </text>
              </g>
            );
          })}
        </svg>

        {loading && (
          <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-blue-400">
              <Activity className="w-4 h-4 animate-spin" />
              正在加载板块 RRG 动能数据...
            </div>
          </div>
        )}
      </div>

      {/* Legend & Detail Drawer */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Legend and reading guide */}
        <div className="lg:col-span-1 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 flex flex-col justify-between">
          <div>
            <span className="text-slate-300 font-bold block mb-2 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-blue-400" /> 图例与旋转法则
            </span>
            <div className="space-y-1.5 mb-3 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-slate-400 inline-block shrink-0" />
                <span>● 宏观大类 (11个主要板块，如 XLK, XLF, XLE)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rotate-45 bg-slate-400 inline-block shrink-0 ml-0.5" />
                <span>◆ 细分赛道 (16个高Alpha赛道，如 SMH, IGV, XBI)</span>
              </div>
              <div className="flex items-center gap-2 text-sky-400">
                <span className="w-3 h-0.5 border-t border-dashed border-sky-400 inline-block shrink-0" />
                <span>虚线尾迹：过去 5 个交易日顺时针位移轨迹</span>
              </div>
            </div>
          </div>
          <div className="p-2 rounded bg-slate-900/80 border border-slate-800 text-[10px] text-slate-500">
            周期规律：资金从 <strong>改善</strong> ➔ 蓄力进入 <strong>领涨</strong> ➔ 见顶进入 <strong>转弱</strong> ➔ 出清至 <strong>落后</strong>，周而复始。
          </div>
        </div>

        {/* Right: Hovered / Selected Node Card */}
        <div className="lg:col-span-2 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
          {hoveredNode ? (
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${
                      hoveredNode.quadrant === "Leading"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : hoveredNode.quadrant === "Improving"
                        ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                        : hoveredNode.quadrant === "Weakening"
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                    }`}
                  >
                    {hoveredNode.symbol}
                  </span>
                  <strong className="text-white text-sm">{hoveredNode.name}</strong>
                  {hoveredNode.isSubIndustry && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      母板块: {hoveredNode.parentSector}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-[11px]">象限：</span>
                  <strong className="text-white">
                    {hoveredNode.quadrant === "Leading" && "领涨区 (Leading)"}
                    {hoveredNode.quadrant === "Improving" && "改善区 (Improving)"}
                    {hoveredNode.quadrant === "Weakening" && "转弱区 (Weakening)"}
                    {hoveredNode.quadrant === "Lagging" && "落后区 (Lagging)"}
                  </strong>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      hoveredNode.action === "ACCUMULATE"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : hoveredNode.action === "HOLD"
                        ? "bg-blue-500/20 text-blue-400"
                        : hoveredNode.action === "REDUCE"
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-rose-500/20 text-rose-400"
                    }`}
                  >
                    战术姿态: {hoveredNode.action}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-2.5">
                <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block">RS-Ratio (相对趋势)</span>
                  <span className="font-mono font-bold text-white text-sm">
                    {hoveredNode.rsRatio.toFixed(2)}
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block">RS-Momentum (动能)</span>
                  <span className="font-mono font-bold text-white text-sm">
                    {hoveredNode.rsMomentum.toFixed(2)}
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block">移动角 / 速度</span>
                  <span className="font-mono font-bold text-white text-sm">
                    {hoveredNode.directionAngle.toFixed(0)}° / {hoveredNode.velocity.toFixed(2)}
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block">宏观周期契合</span>
                  <span
                    className={`font-semibold capitalize ${
                      hoveredNode.macroAlignment === "favored"
                        ? "text-emerald-400"
                        : hoveredNode.macroAlignment === "avoid"
                        ? "text-rose-400"
                        : "text-slate-300"
                    }`}
                  >
                    {hoveredNode.macroAlignment === "favored"
                      ? "顺周期受惠"
                      : hoveredNode.macroAlignment === "avoid"
                      ? "逆周期承压"
                      : "中性"}
                  </span>
                </div>
              </div>

              {hoveredNode.recommendedStocks && hoveredNode.recommendedStocks.length > 0 && (
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <span className="text-emerald-400 font-semibold">首选领跑股:</span>
                  <span className="font-mono text-slate-200">
                    {hoveredNode.recommendedStocks.join(", ")}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-6 text-slate-500 text-center">
              <Compass className="w-8 h-8 mb-2 text-slate-600" />
              <p className="text-xs">将鼠标悬停或点击图中任意板块或细分节点</p>
              <p className="text-[10px] text-slate-600 mt-0.5">
                即可实时查看动能坐标、顺时针轨迹、战术建议及龙头标的
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RrgQuadrantChart;
