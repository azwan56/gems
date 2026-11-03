"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { StockMetrics, StrategyPreset } from "@/lib/types";
import { applyFilters } from "@/lib/screener-engine";
import {
  ShieldCheck, TrendingUp, Rocket, Castle, Zap, ChevronRight,
  Activity, ArrowUpRight, Plus, Check, Briefcase, Radio, Target,
  LayoutGrid, Table2, FileText, Compass, Sparkles
} from "lucide-react";
import Link from "next/link";
import PremiumGate from "@/components/PremiumGate";
import UserMenu from "@/components/UserMenu";
import { SectorWindBadge } from "@/components/SectorWindBadge";
import QuickThesisDialog from "@/components/QuickThesisDialog";
import StockChatAssistant from "@/components/StockChatAssistant";
import RrgQuadrantChart from "@/components/RrgQuadrantChart";

const FALLBACK_STOCKS: StockMetrics[] = [];

const getStrategyIcon = (strategyId: string) => {
  switch (strategyId) {
    case "value": return ShieldCheck;
    case "large_growth": return TrendingUp;
    case "small_growth": return Rocket;
    case "seeking_alpha": return Radio;
    case "garp": return TrendingUp;
    case "wide_moat": return Castle;
    case "short_term_catalyst": return Zap;
    default: return Activity;
  }
};

const badgeColors: Record<string, string> = {
  blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  slate: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

interface MultiStrategyStock extends StockMetrics {
  matchedStrategies: { id: string; name: string; nameZh: string; color: string }[];
  matchCount: number;
}

export default function SuperScreenerMatrix() {
  const { t, lang } = useLanguage();
  const { user, getIdToken, loading: authLoading } = useAuth();
  const [stocks, setStocks] = useState<StockMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [saList, setSaList] = useState<Set<string>>(new Set());
  const [addingSymbol, setAddingSymbol] = useState<string | null>(null);
  const [presets, setPresets] = useState<StrategyPreset[]>([]);
  const [targetPrices, setTargetPrices] = useState<Record<string, { targetConsensus: number }>>({});

  // Focus controls to prevent information overload
  const [viewMode, setViewMode] = useState<"focus" | "table">("focus");
  const [minMatches, setMinMatches] = useState<2 | 3>(2);
  const [tailwindOnly, setTailwindOnly] = useState(false);

  // Native <dialog> drawer + AI assistant + RRG modal
  const [analyzingStock, setAnalyzingStock] = useState<StockMetrics | null>(null);
  const [chatStock, setChatStock] = useState<StockMetrics | null>(null);
  const [chatKey, setChatKey] = useState(0);
  const [showRrgModal, setShowRrgModal] = useState(false);
  const [rrgHighlight, setRrgHighlight] = useState<{ etf?: string | null; subEtf?: string | null; symbol?: string | null }>({});

  useEffect(() => {
    if (authLoading || !user) return;

    async function loadData() {
      try {
        const token = await getIdToken();
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

        const [poolRes, wlRes, saRes, presetsRes] = await Promise.all([
          fetch("/api/stock-pool?include=stocks", { headers }),
          fetch("/api/watchlist", { headers }),
          fetch("/api/seeking-alpha", { headers }),
          fetch("/api/strategies", { headers }),
        ]);

        if (presetsRes.ok) {
          const presetsData = await presetsRes.json();
          if (presetsData && Array.isArray(presetsData.strategies)) {
            setPresets(presetsData.strategies);
          }
        }

        if (poolRes.ok) {
          const poolData = await poolRes.json();
          if (poolData && Array.isArray(poolData.stocks)) {
            setStocks(poolData.stocks);
          }
        }

        if (wlRes.ok) {
          const wlData = await wlRes.json();
          if (wlData && Array.isArray(wlData.watchlist)) {
            setWatchlist(new Set(wlData.watchlist.map((w: { symbol: string }) => w.symbol)));
          }
        }

        if (saRes.ok) {
          const saData = await saRes.json();
          if (saData && Array.isArray(saData.symbols)) {
            setSaList(new Set(saData.symbols.map((s: string) => s.toUpperCase())));
          }
        }
      } catch (err) {
        console.error("Failed to load matrix data:", err);
        setStocks(FALLBACK_STOCKS);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [authLoading, user, getIdToken]);

  const matrixStocks = useMemo(() => {
    if (stocks.length === 0 || presets.length === 0) return [];

    const stockMap = new Map<string, MultiStrategyStock>();

    presets.forEach((preset) => {
      const passed =
        preset.id === "seeking_alpha"
          ? stocks.filter((s) => saList.has(s.symbol.toUpperCase()))
          : applyFilters(stocks, preset.defaultFilters);
      passed.forEach((s) => {
        let entry = stockMap.get(s.symbol);
        if (!entry) {
          entry = { ...s, matchedStrategies: [], matchCount: 0 };
          stockMap.set(s.symbol, entry);
        }
        entry.matchedStrategies.push({
          id: preset.id,
          name: preset.name,
          nameZh: preset.nameZh || preset.name,
          color: preset.color,
        });
        entry.matchCount += 1;
      });
    });

    return Array.from(stockMap.values())
      .filter((s) => s.matchCount >= 2)
      .sort((a, b) => {
        if (a.matchCount !== b.matchCount) return b.matchCount - a.matchCount;
        return (b.marketCap || 0) - (a.marketCap || 0);
      });
  }, [stocks, presets, saList]);

  const filteredStocks = useMemo(() => {
    return matrixStocks.filter((s) => {
      if (s.matchCount < minMatches) return false;
      if (tailwindOnly && s.sectorWind !== "tailwind") return false;
      return true;
    });
  }, [matrixStocks, minMatches, tailwindOnly]);

  // Fetch analyst consensus target prices for top 15 visible matrix stocks
  useEffect(() => {
    if (!user || matrixStocks.length === 0) return;
    let cancelled = false;
    const syms = matrixStocks.slice(0, 15).map((s) => s.symbol).join(",");

    getIdToken().then((token) => {
      fetch(`/api/target-prices?symbols=${encodeURIComponent(syms)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!cancelled && d?.targets) setTargetPrices(d.targets);
        })
        .catch(() => {});
    });

    return () => {
      cancelled = true;
    };
  }, [user, matrixStocks, getIdToken]);

  const addToPortfolio = useCallback(
    async (symbol: string) => {
      if (!user?.uid) return;
      setAddingSymbol(symbol);
      try {
        const token = await getIdToken();
        const res = await fetch("/api/watchlist", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ symbol, role: "core" }),
        });
        if (res.ok) {
          setWatchlist((prev) => new Set(prev).add(symbol));
        }
      } catch (err) {
        console.error("addToPortfolio error:", err);
      } finally {
        setAddingSymbol(null);
      }
    },
    [user, getIdToken]
  );

  const removeFromPortfolio = useCallback(
    async (symbol: string) => {
      if (!user?.uid) return;
      setAddingSymbol(symbol);
      try {
        const token = await getIdToken();
        const res = await fetch("/api/watchlist", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ symbol }),
        });
        if (res.ok) {
          setWatchlist((prev) => {
            const next = new Set(prev);
            next.delete(symbol);
            return next;
          });
        }
      } catch (err) {
        console.error("removeFromPortfolio error:", err);
      } finally {
        setAddingSymbol(null);
      }
    },
    [user, getIdToken]
  );

  const togglePortfolio = useCallback(
    (symbol: string) => {
      if (watchlist.has(symbol)) {
        removeFromPortfolio(symbol);
      } else {
        addToPortfolio(symbol);
      }
    },
    [watchlist, addToPortfolio, removeFromPortfolio]
  );

  const highConvictionCount = useMemo(
    () => matrixStocks.filter((s) => s.matchCount >= 3).length,
    [matrixStocks]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-12 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors shrink-0 p-1 rounded-lg hover:bg-slate-900">
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 rotate-180" />
            </Link>
            <h1 className="text-sm sm:text-lg font-bold text-white flex items-center gap-1.5 sm:gap-2 truncate whitespace-nowrap">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 shrink-0" />
              <span className="truncate">{t("Super Screener Matrix", "多策略共振矩阵")}</span>
            </h1>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setRrgHighlight({});
                setShowRrgModal(true);
              }}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-cyan-300 cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>{t("RRG Map", "RRG 四象限")}</span>
            </button>

            {watchlist.size > 0 && (
              <Link
                href="/watchlist"
                className="flex items-center gap-1 px-2.5 py-1 sm:py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 transition-colors whitespace-nowrap"
              >
                <Briefcase className="w-3.5 h-3.5 shrink-0" />
                <span className="text-xs font-semibold font-mono">{watchlist.size}</span>
              </Link>
            )}
            <UserMenu />
          </div>
        </div>
      </header>

      <PremiumGate featureName={t("Super Screener Matrix", "多策略共振矩阵")}>
        <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 pb-24 sm:py-8 space-y-5">
          {/* Top Focus Control Bar */}
          <div className="rounded-2xl bg-slate-900/75 border border-slate-800 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h2 className="text-base sm:text-xl font-extrabold text-white">
                  {t("Multi-Model Resonance Candidates", "多模型交叉验证 · 高确信度池")}
                </h2>
                {!loading && (
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-xs font-mono font-bold text-indigo-300">
                    {filteredStocks.length} / {matrixStocks.length}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-400">
                {t(
                  "Filter by resonance depth or RRG sector tailwinds. Click '5s Thesis' for instant slide-out valuation & risk breakdown.",
                  "支持按共振深度与板块顺风一键收敛焦点；点击「速览逻辑」即刻滑出双目标价与核心风险。"
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Resonance Depth Filter */}
              <div className="inline-flex p-0.5 rounded-xl bg-slate-950 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setMinMatches(2)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    minMatches === 2 ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {t("≥2 Models", "≥2 策略共振")} ({matrixStocks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMinMatches(3)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    minMatches === 3 ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {t("≥3 Elite", "≥3 极高确信")} ({highConvictionCount})
                </button>
              </div>

              {/* Sector Tailwind Toggle */}
              <button
                type="button"
                onClick={() => setTailwindOnly((v) => !v)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  tailwindOnly
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                ↑ {t("RRG Tailwind Only", "仅看顺风板块")}
              </button>

              {/* View Mode Switcher */}
              <div className="inline-flex p-0.5 rounded-xl bg-slate-950 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewMode("focus")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                    viewMode === "focus" ? "bg-slate-800 text-cyan-300" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>{t("Focus", "聚焦卡")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                    viewMode === "table" ? "bg-slate-800 text-cyan-300" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Table2 className="w-3.5 h-3.5" />
                  <span>{t("Table", "紧凑表")}</span>
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid gap-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-slate-900 rounded-xl animate-pulse border border-slate-800" />
              ))}
            </div>
          ) : filteredStocks.length === 0 ? (
            <div className="text-center py-16 text-slate-400 bg-slate-900/50 rounded-2xl border border-slate-800/60">
              <Activity className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">{t("No stocks match the current filter.", "当前过滤条件下暂无符合标的，可放宽过滤条件查看。")}</p>
            </div>
          ) : viewMode === "focus" ? (
            <div className="vp-contain-section space-y-2.5 sm:space-y-3">
              {filteredStocks.map((stock, idx) => {
                const inWatchlist = watchlist.has(stock.symbol);
                const isAdding = addingSymbol === stock.symbol;
                const tp = targetPrices[stock.symbol];
                const upsidePct =
                  tp?.targetConsensus && stock.price > 0
                    ? ((tp.targetConsensus - stock.price) / stock.price) * 100
                    : null;

                return (
                  <div
                    key={stock.symbol}
                    className="vp-contain-card bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 sm:p-4 hover:border-cyan-500/40 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
                      {/* Left: Rank + Ticker & Sector */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-6 text-center shrink-0">
                          <span className="text-xs font-mono font-bold text-slate-500">#{idx + 1}</span>
                        </div>
                        <div className="w-12 h-11 sm:w-14 sm:h-12 px-1 rounded-xl bg-slate-800/90 border border-slate-700/70 flex items-center justify-center shrink-0">
                          <span className="text-xs sm:text-base font-extrabold tracking-tight text-white">{stock.symbol}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm sm:text-base font-bold text-white truncate max-w-[200px] sm:max-w-[260px]">
                              {stock.companyName}
                            </h3>
                            <SectorWindBadge
                              wind={stock.sectorWind}
                              quadrant={stock.sectorQuadrant}
                              etf={stock.sectorETF}
                              sectorName={stock.sector}
                            />
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 font-mono">
                            <span>${stock.price.toFixed(2)}</span>
                            {upsidePct !== null && (
                              <span className={upsidePct >= 0 ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                                <Target className="w-3 h-3 inline mr-0.5" />
                                {t("Wall St", "共识")} {upsidePct >= 0 ? `+${upsidePct.toFixed(1)}%` : `${upsidePct.toFixed(1)}%`}
                              </span>
                            )}
                            <span className="text-slate-600">•</span>
                            <span>{stock.marketCap ? `$${(stock.marketCap / 1e9).toFixed(1)}B` : "—"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Middle: Strategy Resonance Pills */}
                      <div className="flex-1 flex flex-wrap gap-1.5 md:justify-center">
                        {stock.matchedStrategies.map((strat) => {
                          const Icon = getStrategyIcon(strat.id);
                          return (
                            <div
                              key={strat.id}
                              className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                                badgeColors[strat.color] || badgeColors.slate
                              }`}
                            >
                              <Icon className="w-3 h-3 shrink-0" />
                              <span>{lang === "zh" ? strat.nameZh : strat.name}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Right: Resonance Score + Drawer + Full Report */}
                      <div className="flex items-center justify-between md:justify-end gap-2.5 border-t md:border-t-0 border-slate-800/80 pt-2.5 md:pt-0">
                        <div className="flex items-baseline gap-1.5 md:block md:text-center mr-1">
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider">{t("Resonance", "共振数")}</div>
                          <div className="text-base sm:text-xl font-extrabold font-mono bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                            {stock.matchCount} / 6
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => togglePortfolio(stock.symbol)}
                            disabled={isAdding}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium text-xs transition-all cursor-pointer ${
                              inWatchlist
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                : "bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white"
                            }`}
                          >
                            {inWatchlist ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                            <span className="hidden sm:inline">{inWatchlist ? t("Saved", "已加") : t("Save", "自选")}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setAnalyzingStock(stock)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/35 text-cyan-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>{t("5s Thesis", "速览逻辑")}</span>
                          </button>

                          <Link
                            href={`/report/${stock.symbol}?strategy=multi_strategy`}
                            target="_blank"
                            title={t("Open Full PDF Report", "新窗口打开完整 PDF 研报")}
                            className="p-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/35 text-indigo-300 transition-colors"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Semantic Responsive Table View with Sticky Header + Row Header + Container Query */
            <div
              tabIndex={0}
              role="region"
              aria-label={t("Multi-Strategy Resonance Quantitative Table", "多策略共振量化数据表")}
              className="vp-table-region vp-table-stackable rounded-xl border border-slate-800 bg-slate-900/70"
            >
              <table className="text-xs sm:text-sm text-left">
                <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3.5 font-semibold">{t("Symbol", "代码")}</th>
                    <th className="p-3.5 font-semibold">{t("Price / Cap", "现价 / 市值")}</th>
                    <th className="p-3.5 font-semibold">{t("Resonance", "共振模型")}</th>
                    <th className="p-3.5 font-semibold">P/E · ROE · FCF</th>
                    <th className="p-3.5 font-semibold text-right">{t("Actions", "操作")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {filteredStocks.map((stock) => {
                    const inWatchlist = watchlist.has(stock.symbol);
                    return (
                      <tr key={stock.symbol} className="hover:bg-slate-800/40 transition-colors">
                        <th scope="row" className="p-3.5 font-bold text-white whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span>{stock.symbol}</span>
                            <SectorWindBadge
                              wind={stock.sectorWind}
                              quadrant={stock.sectorQuadrant}
                              etf={stock.sectorETF}
                              sectorName={stock.sector}
                            />
                          </div>
                          <div className="text-[11px] font-normal text-slate-400 truncate max-w-[180px]">
                            {stock.companyName}
                          </div>
                        </th>
                        <td data-label={t("Price / Cap", "现价/市值")} className="p-3.5 font-mono text-slate-200 whitespace-nowrap">
                          ${stock.price.toFixed(2)} · <span className="text-slate-400">{stock.marketCap ? `$${(stock.marketCap / 1e9).toFixed(1)}B` : "—"}</span>
                        </td>
                        <td data-label={t("Resonance", "共振数")} className="p-3.5">
                          <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/35 text-xs font-mono font-bold text-indigo-300">
                            {stock.matchCount} / 6
                          </span>
                        </td>
                        <td data-label="P/E · ROE · FCF" className="p-3.5 font-mono text-xs text-slate-300 whitespace-nowrap">
                          {stock.peRatio !== null ? `${stock.peRatio.toFixed(1)}x` : "—"} ·{" "}
                          {stock.roe !== null ? `${stock.roe.toFixed(1)}%` : "—"} ·{" "}
                          {stock.freeCashFlowYield !== null ? `${stock.freeCashFlowYield.toFixed(1)}%` : "—"}
                        </td>
                        <td data-label={t("Actions", "操作")} className="p-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => togglePortfolio(stock.symbol)}
                              className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-slate-300 hover:text-white cursor-pointer"
                            >
                              {inWatchlist ? "✓" : "+"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setAnalyzingStock(stock)}
                              className="px-2.5 py-1 rounded bg-cyan-500/15 border border-cyan-500/35 text-xs font-bold text-cyan-300 cursor-pointer"
                            >
                              {t("5s Thesis", "速览")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && watchlist.size > 0 && (
            <div className="pt-4 text-center">
              <Link
                href="/watchlist"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all"
              >
                <Briefcase className="w-4 h-4" />
                {t(`View Portfolio Dashboard (${watchlist.size})`, `查看投资组合面板 (${watchlist.size})`)}
              </Link>
            </div>
          )}
        </main>
      </PremiumGate>

      <QuickThesisDialog
        stock={analyzingStock}
        strategyId="large_growth"
        strategyLabel={t("Multi-Strategy Matrix", "多策略共振矩阵")}
        onClose={() => setAnalyzingStock(null)}
        inWatchlist={analyzingStock ? watchlist.has(analyzingStock.symbol) : false}
        onToggleWatchlist={user?.uid ? togglePortfolio : undefined}
        onAskAi={(stk) => {
          setChatStock(stk);
          setChatKey((k) => k + 1);
        }}
        onLocateRrg={(ctx) => {
          setRrgHighlight(ctx);
          setShowRrgModal(true);
        }}
      />

      {showRrgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto">
            <RrgQuadrantChart
              isModal={true}
              onClose={() => setShowRrgModal(false)}
              highlightETF={rrgHighlight.etf}
              highlightSubETF={rrgHighlight.subEtf}
              symbol={rrgHighlight.symbol}
            />
          </div>
        </div>
      )}

      {chatStock && (
        <StockChatAssistant
          key={`${chatStock.symbol}-${chatKey}`}
          symbol={chatStock.symbol}
          companyName={chatStock.companyName || chatStock.symbol}
          lang={lang}
          strategy="multi_strategy"
          initialOpen={true}
        />
      )}
    </div>
  );
}
