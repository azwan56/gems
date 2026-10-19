"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { StockMetrics, StrategyPreset } from "@/lib/types";
import { applyFilters } from "@/lib/screener-engine";
import {
  ShieldCheck, TrendingUp, Rocket, Castle, Zap, ChevronRight,
  Activity, ArrowUpRight, Plus, Check, Briefcase, Radio, BookOpen
} from "lucide-react";
import Link from "next/link";
import PremiumGate from "@/components/PremiumGate";
import UserMenu from "@/components/UserMenu";

// Mock data fallback if fetch fails
const FALLBACK_STOCKS: StockMetrics[] = [];

// Helper to get strategy icon
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

// Map color strings to tailwind classes statically
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

  // Load full stock pool + existing watchlist in parallel
  useEffect(() => {
    if (authLoading || !user) return;

    async function loadData() {
      try {
        const token = await getIdToken();
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

        // Fetch stock pool, watchlist, SA list, and presets in parallel
        const [poolRes, wlRes, saRes, presetsRes] = await Promise.all([
          fetch("/api/stock-pool?include=stocks", { headers }),
          fetch("/api/watchlist", { headers }),
          fetch("/api/seeking-alpha", { headers }),
          fetch("/api/strategies", { headers })
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
            setWatchlist(new Set(wlData.watchlist.map((w: any) => w.symbol)));
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

  // Compute matrix
  const matrixStocks = useMemo(() => {
    if (stocks.length === 0 || presets.length === 0) return [];

    const stockMap = new Map<string, MultiStrategyStock>();

    // Apply each strategy and accumulate matches
    presets.forEach(preset => {
      const passed = preset.id === "seeking_alpha"
        ? stocks.filter(s => saList.has(s.symbol.toUpperCase()))
        : applyFilters(stocks, preset.defaultFilters);
      passed.forEach(s => {
        let entry = stockMap.get(s.symbol);
        if (!entry) {
          entry = { ...s, matchedStrategies: [], matchCount: 0 };
          stockMap.set(s.symbol, entry);
        }
        entry.matchedStrategies.push({
          id: preset.id,
          name: preset.name,
          nameZh: preset.nameZh || preset.name,
          color: preset.color
        });
        entry.matchCount += 1;
      });
    });

    // Filter to only stocks matching >= 2 strategies and sort by count descending, then market cap
    return Array.from(stockMap.values())
      .filter(s => s.matchCount >= 2)
      .sort((a, b) => {
        if (a.matchCount !== b.matchCount) return b.matchCount - a.matchCount;
        return (b.marketCap || 0) - (a.marketCap || 0);
      });
  }, [stocks, presets, saList]);

  const handleAnalyze = (stock: MultiStrategyStock) => {
    window.open(`/report/${stock.symbol}?strategy=multi_strategy`, '_blank');
  };

  const addToPortfolio = useCallback(async (symbol: string) => {
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
        setWatchlist(prev => new Set(prev).add(symbol));
      } else {
        console.error("Failed to add to watchlist:", res.status);
      }
    } catch (err) {
      console.error("addToPortfolio error:", err);
    } finally {
      setAddingSymbol(null);
    }
  }, [user, getIdToken]);

  const removeFromPortfolio = useCallback(async (symbol: string) => {
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
        setWatchlist(prev => {
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
  }, [user, getIdToken]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-12 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors shrink-0">
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 rotate-180" />
            </Link>
            <h1 className="text-sm sm:text-lg font-bold text-white flex items-center gap-1.5 sm:gap-2 truncate whitespace-nowrap">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400 shrink-0" />
              <span className="truncate">{t("Super Screener Matrix", "多策略共振矩阵")}</span>
            </h1>
          </div>
          {/* Stock count + Watchlist link + UserMenu in header */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {!loading && matrixStocks.length > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 whitespace-nowrap">
                <Activity className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="text-xs sm:text-sm font-semibold text-indigo-400">
                  {matrixStocks.length} {t("stocks", "只")}
                </span>
              </div>
            )}
            {watchlist.size > 0 && (
              <Link
                href="/watchlist"
                className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors whitespace-nowrap"
              >
                <Briefcase className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="text-xs sm:text-sm font-semibold">{watchlist.size}</span>
              </Link>
            )}
            <UserMenu />
          </div>
        </div>
      </header>

      <PremiumGate featureName={t("Super Screener Matrix", "多策略共振矩阵")}>
        <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 pb-24 sm:py-8">
          <div className="mb-3.5 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1 sm:mb-2">
                  <h2 className="text-base sm:text-2xl font-bold text-white truncate">
                    {t("High Conviction Stocks", "高确信度标的")}
                  </h2>
                  {/* Mobile inline count badge */}
                  {!loading && matrixStocks.length > 0 && (
                    <div className="flex sm:hidden items-baseline gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 shrink-0">
                      <span className="text-base font-black bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                        {matrixStocks.length}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {t("Selected", "只个股入选")}
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-xs sm:text-base text-slate-400 leading-snug sm:leading-normal">
                  {t(
                    "These stocks simultaneously pass multiple stringent quantitative models, representing our highest conviction ideas.",
                    "这些股票同时通过了多个严苛的量化筛选模型，是我们确信度最高的投资标的。"
                  )}
                </p>
              </div>
              {/* Desktop Count summary pill */}
              {!loading && matrixStocks.length > 0 && (
                <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-3xl font-black bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                      {matrixStocks.length}
                    </div>
                    <div className="text-xs text-slate-500 uppercase tracking-wider">
                      {t("Stocks Selected", "只个股入选")}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="grid gap-3 sm:gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-slate-900 rounded-xl animate-pulse border border-slate-800" />
              ))}
            </div>
          ) : matrixStocks.length === 0 ? (
            <div className="text-center py-16 sm:py-20 text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-800/50">
              <Activity className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
              <p className="text-xs sm:text-base">{t("No stocks passed 2 or more strategies.", "当前没有任何股票满足 2 个及以上策略。")}</p>
            </div>
          ) : (
            <div className="space-y-2.5 sm:space-y-4">
              {matrixStocks.map((stock, idx) => {
                const inWatchlist = watchlist.has(stock.symbol);
                const isAdding = addingSymbol === stock.symbol;

                return (
                  <div key={stock.symbol} className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 hover:border-slate-700 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-4">
                      
                      {/* Left: Rank + Ticker & Info */}
                      <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
                        {/* Rank number */}
                        <div className="w-5 sm:w-8 text-center flex-shrink-0">
                          <span className="text-xs sm:text-sm font-bold text-slate-500">#{idx + 1}</span>
                        </div>
                        <div className="w-11 h-10 sm:w-14 sm:h-14 px-1 rounded-lg sm:rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-purple-500/5 opacity-50" />
                          <span className="text-xs sm:text-lg font-extrabold tracking-tight text-white z-10">{stock.symbol}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm sm:text-base font-semibold text-white line-clamp-1">{stock.companyName}</h3>
                          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-slate-400 mt-0.5">
                            <span className="truncate">{stock.sector}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-700 shrink-0" />
                            <span className="font-mono shrink-0">
                              {stock.marketCap 
                                ? `$${(stock.marketCap / 1e9).toFixed(1)}B`
                                : "N/A"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Middle: Strategy Badges */}
                      <div className="flex-1 flex flex-wrap gap-1.5 sm:gap-2 md:justify-center">
                        {stock.matchedStrategies.map(strat => {
                          const Icon = getStrategyIcon(strat.id);
                          return (
                            <div 
                              key={strat.id}
                              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-medium border ${badgeColors[strat.color] || badgeColors.slate}`}
                            >
                              <Icon className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                              <span>{lang === 'zh' ? strat.nameZh : strat.name}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Right: Score & Actions */}
                      <div className="flex items-center justify-between md:justify-end gap-2 sm:gap-3 border-t md:border-t-0 border-slate-800/80 pt-2.5 sm:pt-4 md:pt-0">
                        <div className="flex items-baseline gap-1.5 md:block md:text-center">
                          <div className="text-[11px] sm:text-xs text-slate-500 uppercase tracking-wider md:mb-1">{t("Matrix Score", "共振得分")}</div>
                          <div className="text-base sm:text-2xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                            {stock.matchCount} / 6
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Add to Portfolio button */}
                          <button
                            onClick={() => inWatchlist ? removeFromPortfolio(stock.symbol) : addToPortfolio(stock.symbol)}
                            disabled={isAdding}
                            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                              inWatchlist
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30"
                                : "bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white"
                            } ${isAdding ? "opacity-50 cursor-wait" : ""}`}
                            title={inWatchlist ? t("Remove from portfolio", "从投资组合移除") : t("Add to portfolio", "加入投资组合")}
                          >
                            {isAdding ? (
                              <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : inWatchlist ? (
                              <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            ) : (
                              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            )}
                            <span className="hidden sm:inline">
                              {inWatchlist ? t("Added", "已加入") : t("Portfolio", "组合")}
                            </span>
                          </button>

                          {/* Deep Dive button */}
                          <button
                            onClick={() => handleAnalyze(stock)}
                            className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors"
                          >
                            {t("Deep Dive", "深度研报")}
                            <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bottom: go to watchlist */}
          {!loading && watchlist.size > 0 && (
            <div className="mt-6 sm:mt-8 text-center">
              <Link
                href="/watchlist"
                className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl text-xs sm:text-base font-bold shadow-lg shadow-purple-500/20 transition-all hover:scale-105"
              >
                <Briefcase className="w-4 h-4 sm:w-5 sm:h-5" />
                {t(`View Portfolio Dashboard (${watchlist.size})`, `查看投资组合面板 (${watchlist.size})`)}
              </Link>
            </div>
          )}
        </main>
      </PremiumGate>
    </div>
  );
}
