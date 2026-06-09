"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useLanguage } from "@/lib/language-context";
import { StockMetrics } from "@/lib/types";
import { getAllStrategyPresets } from "@/lib/strategies";
import { applyFilters } from "@/lib/screener-engine";
import { ShieldCheck, TrendingUp, Rocket, Castle, Zap, ChevronRight, Activity, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import PremiumGate from "@/components/PremiumGate";

// Mock data fallback if fetch fails
const FALLBACK_STOCKS: StockMetrics[] = [];

// Helper to get strategy icon
const getStrategyIcon = (strategyId: string) => {
  switch (strategyId) {
    case "value": return ShieldCheck;
    case "large_growth": return TrendingUp;
    case "small_growth": return Rocket;
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
  const [stocks, setStocks] = useState<StockMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStock, setSelectedStock] = useState<MultiStrategyStock | null>(null);

  // Load all stocks
  useEffect(() => {
    async function loadAllStocks() {
      try {
        const res = await fetch("/api/screener?strategy=large_growth&limit=2000");
        const data = await res.json();
        if (data && Array.isArray(data.stocks)) {
          setStocks(data.stocks);
        } else {
          setStocks(FALLBACK_STOCKS);
        }
      } catch (err) {
        console.error("Failed to fetch stocks for matrix:", err);
        setStocks(FALLBACK_STOCKS);
      } finally {
        setLoading(false);
      }
    }
    loadAllStocks();
  }, []);

  // Compute matrix
  const matrixStocks = useMemo(() => {
    if (stocks.length === 0) return [];

    const presets = getAllStrategyPresets().filter(p => p.id !== "seeking_alpha");
    const stockMap = new Map<string, MultiStrategyStock>();

    // Apply each strategy and accumulate matches
    presets.forEach(preset => {
      const passed = applyFilters(stocks, preset.defaultFilters);
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
  }, [stocks]);

  const handleAnalyze = (stock: MultiStrategyStock) => {
    // Generate AI Report opens in new tab for deep dive
    window.open(`/report/${stock.symbol}?strategy=multi_strategy`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors">
              <ChevronRight className="w-5 h-5 rotate-180" />
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-400" />
                {t("Super Screener Matrix", "多策略共振矩阵")}
              </h1>
            </div>
          </div>
        </div>
      </header>

      <PremiumGate featureName={t("Super Screener Matrix", "多策略共振矩阵")}>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">
              {t("High Conviction Stocks", "高确信度标的")}
            </h2>
            <p className="text-slate-400">
              {t(
                "These stocks simultaneously pass multiple stringent quantitative models, representing our highest conviction ideas.",
                "这些股票同时通过了多个严苛的量化筛选模型，是我们确信度最高的投资标的。"
              )}
            </p>
          </div>

          {loading ? (
            <div className="grid gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-slate-900 rounded-xl animate-pulse border border-slate-800" />
              ))}
            </div>
          ) : matrixStocks.length === 0 ? (
            <div className="text-center py-20 text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-800/50">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t("No stocks passed 2 or more strategies.", "当前没有任何股票满足 2 个及以上策略。")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {matrixStocks.map(stock => (
                <div key={stock.symbol} className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    
                    {/* Left: Ticker & Info */}
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                        {/* Score indicator background */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-purple-500/5 opacity-50" />
                        <span className="text-xl font-bold text-white z-10">{stock.symbol}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-white line-clamp-1">{stock.companyName}</h3>
                        <div className="flex items-center gap-2 text-sm text-slate-400 mt-0.5">
                          <span>{stock.sector}</span>
                          <span className="w-1 h-1 rounded-full bg-slate-700" />
                          <span>
                            {stock.marketCap 
                              ? `$${(stock.marketCap / 1e9).toFixed(1)}B`
                              : "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Middle: Strategy Badges */}
                    <div className="flex-1 flex flex-wrap gap-2 md:justify-center">
                      {stock.matchedStrategies.map(strat => {
                        const Icon = getStrategyIcon(strat.id);
                        return (
                          <div 
                            key={strat.id}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${badgeColors[strat.color] || badgeColors.slate}`}
                          >
                            <Icon className="w-3 h-3" />
                            <span>{lang === 'zh' ? strat.nameZh : strat.name}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Right: Score & Actions */}
                    <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-slate-800 pt-4 md:pt-0">
                      <div className="text-center">
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{t("Matrix Score", "共振得分")}</div>
                        <div className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                          {stock.matchCount} / 6
                        </div>
                      </div>
                      <button
                        onClick={() => handleAnalyze(stock)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors"
                      >
                        {t("Deep Dive", "深度研报")}
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </PremiumGate>
    </div>
  );
}
