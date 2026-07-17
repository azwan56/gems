"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { 
  ArrowLeft, 
  Activity, 
  Plus, 
  Check, 
  TrendingUp, 
  Castle, 
  Zap, 
  ShieldCheck,
  Calendar,
  ChevronRight,
  ExternalLink,
  Search,
  Sparkles,
  Inbox
} from "lucide-react";
import UserMenu from "@/components/UserMenu";
import { getStrategyPreset } from "@/lib/strategies";

interface SnapshotStockSummary {
  symbol: string;
  companyName: string;
  marketCap: number;
  peRatio: number | null;
  pbRatio: number | null;
  freeCashFlowYield: number | null;
  revenueGrowthYoY: number | null;
  epsGrowthYoY: number | null;
  grossMargin: number | null;
  priceVs50SMA: number | null;
}

interface ScreenerChangeRecord {
  strategyId: string;
  strategyName: string;
  strategyNameZh: string;
  added: SnapshotStockSummary[];
  removed: string[];
  timestamp: string;
}

// Strategy details mapping for UI icons/colors
const STRATEGY_DETAILS: Record<string, { icon: any; color: string; bgClass: string; textClass: string; borderClass: string }> = {
  value: { 
    icon: ShieldCheck, 
    color: "blue", 
    bgClass: "bg-blue-500/10", 
    textClass: "text-blue-400", 
    borderClass: "border-blue-500/20" 
  },
  large_growth: { 
    icon: TrendingUp, 
    color: "indigo", 
    bgClass: "bg-indigo-500/10", 
    textClass: "text-indigo-400", 
    borderClass: "border-indigo-500/20" 
  },
  small_growth: { 
    icon: Zap, 
    color: "purple", 
    bgClass: "bg-purple-500/10", 
    textClass: "text-purple-400", 
    borderClass: "border-purple-500/20" 
  },
  garp: { 
    icon: TrendingUp, 
    color: "emerald", 
    bgClass: "bg-emerald-500/10", 
    textClass: "text-emerald-400", 
    borderClass: "border-emerald-500/20" 
  },
  wide_moat: { 
    icon: Castle, 
    color: "cyan", 
    bgClass: "bg-cyan-500/10", 
    textClass: "text-cyan-400", 
    borderClass: "border-cyan-500/20" 
  },
  short_term_catalyst: { 
    icon: Zap, 
    color: "rose", 
    bgClass: "bg-rose-500/10", 
    textClass: "text-rose-400", 
    borderClass: "border-rose-500/20" 
  },
  seeking_alpha: { 
    icon: Sparkles, 
    color: "amber", 
    bgClass: "bg-amber-500/10", 
    textClass: "text-amber-400", 
    borderClass: "border-amber-500/20" 
  },
};

export default function UpdatesPage() {
  const { user, getIdToken, loading: authLoading } = useAuth();
  const { lang, t } = useLanguage();
  
  const [changes, setChanges] = useState<ScreenerChangeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [addingSymbol, setAddingSymbol] = useState<string | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Fetch changes and watchlist in parallel
  useEffect(() => {
    if (authLoading || !user) return;

    async function loadData() {
      try {
        const token = await getIdToken();
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

        const [changesRes, wlRes] = await Promise.all([
          fetch("/api/screener/changes?limit=40", { headers }),
          fetch("/api/watchlist", { headers }),
        ]);

        if (changesRes.ok) {
          const cData = await changesRes.json();
          if (cData && Array.isArray(cData.changes)) {
            setChanges(cData.changes);
          }
        }

        if (wlRes.ok) {
          const wlData = await wlRes.json();
          if (wlData && Array.isArray(wlData.watchlist)) {
            setWatchlist(new Set(wlData.watchlist.map((w: any) => w.symbol)));
          }
        }
      } catch (err) {
        console.error("Failed to load changes page data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [authLoading, user, getIdToken]);

  // Watchlist addition helper
  const handleAddToWatchlist = async (symbol: string) => {
    if (addingSymbol) return;
    setAddingSymbol(symbol);
    try {
      const token = await getIdToken();
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers,
        body: JSON.stringify({ symbol, role: "rocket" }), // default to rocket role
      });

      if (res.ok) {
        setWatchlist((prev) => {
          const next = new Set(prev);
          next.add(symbol);
          return next;
        });
      }
    } catch (err) {
      console.error("Failed to add to watchlist:", err);
    } finally {
      setAddingSymbol(null);
    }
  };

  // Helper to format date
  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hrs = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day} ${hrs}:${mins}`;
  };

  const getRelativeTime = (isoStr: string) => {
    const ms = new Date().getTime() - new Date(isoStr).getTime();
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    const day = Math.floor(hr / 24);

    if (day > 0) return lang === "zh" ? `${day} 天前` : `${day}d ago`;
    if (hr > 0) return lang === "zh" ? `${hr} 小时前` : `${hr}h ago`;
    if (min > 0) return lang === "zh" ? `${min} 分钟前` : `${min}m ago`;
    return lang === "zh" ? "刚刚" : "Just now";
  };

  // Filter changes based on strategy selector and search query
  const filteredChanges = useMemo(() => {
    return changes.filter(record => {
      if (selectedStrategy !== "all" && record.strategyId !== selectedStrategy) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toUpperCase().trim();
        // Check if query matches any added or removed symbols in the change record
        const matchesAdded = record.added.some(s => s.symbol.includes(query) || s.companyName.toUpperCase().includes(query));
        const matchesRemoved = record.removed.some(s => s.includes(query));
        return matchesAdded || matchesRemoved;
      }
      return true;
    });
  }, [changes, selectedStrategy, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-400" />
                {t("Quantitative Strategy Updates", "策略选股动态更新")}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Main container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8">
        
        {/* Banner Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-slate-900/40 p-6 sm:p-8 mb-8 backdrop-blur-sm">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                {t("Track Model Additions & Removals", "模型个股流入/流出追踪")}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-xl">
                {t(
                  "Every day after the closing bell, our quantitative models re-screen 700+ equities. Below are the latest updates, directly linking to qualitative deep dives.",
                  "每日美股收盘结算后，量化模型自动重新扫描全市场。以下为最新的流入/流出变动明细，提供一键定性深研决策与快捷加仓操作。"
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400 font-medium">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span>{t("Updated Daily @ 21:35 UTC", "每日固定更替更新")}</span>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center mb-8 bg-slate-900/20 p-4 rounded-xl border border-slate-900">
          {/* Strategy Selectors */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: "all", name: t("All Strategies", "全部策略") },
              { id: "value", name: t("Value", "价值投资") },
              { id: "large_growth", name: t("Large Growth", "大型成长") },
              { id: "small_growth", name: t("Small Growth", "中小盘成长") },
              { id: "garp", name: t("GARP", "合理价格成长") },
              { id: "wide_moat", name: t("Wide Moat", "深宽护城河") },
              { id: "short_term_catalyst", name: t("Catalyst", "短线催化剂") },
              { id: "seeking_alpha", name: t("Seeking Alpha", "SA 导入") }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedStrategy(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all border ${
                  selectedStrategy === tab.id
                    ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[200px] flex-shrink-0">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-3.5 w-3.5 text-slate-500" />
            </span>
            <input
              type="text"
              placeholder={t("Search symbol/company...", "搜索代码/公司名称...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all font-medium"
            />
          </div>
        </div>

        {/* Timeline list */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
            <p className="text-xs text-slate-500 font-medium animate-pulse">{t("Loading updates timeline...", "正在加载模型变动记录...")}</p>
          </div>
        ) : filteredChanges.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/10">
            <Inbox className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <p className="text-sm font-semibold text-slate-500">{t("No updates found matching current filters", "当前筛选条件下无任何变动记录")}</p>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="mt-3 text-xs text-indigo-400 hover:underline font-bold"
              >
                {t("Clear Search", "清除搜索词")}
              </button>
            )}
          </div>
        ) : (
          <div className="relative border-l-2 border-slate-800 pl-6 sm:pl-8 ml-3 sm:ml-4 space-y-12">
            {filteredChanges.map((change, index) => {
              const details = STRATEGY_DETAILS[change.strategyId] || {
                icon: Activity,
                color: "slate",
                bgClass: "bg-slate-500/10",
                textClass: "text-slate-400",
                borderClass: "border-slate-500/20"
              };
              const StrategyIcon = details.icon;

              return (
                <div key={index} className="relative group/item">
                  
                  {/* Timeline point dot */}
                  <div className={`absolute -left-[45px] sm:-left-[53px] top-1.5 p-2 rounded-full border bg-slate-950 ${details.borderClass} ${details.textClass} transition-transform duration-300 group-hover/item:scale-110 shadow-lg shadow-slate-950`}>
                    <StrategyIcon className="w-4 h-4" />
                  </div>

                  {/* Header info */}
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${details.bgClass} ${details.textClass} ${details.borderClass}`}>
                        {lang === "zh" ? change.strategyNameZh : change.strategyName}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {getRelativeTime(change.timestamp)}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 font-mono">
                      {formatDate(change.timestamp)}
                    </div>
                  </div>

                  {/* Body Content card */}
                  <div className="rounded-xl border border-slate-800/80 bg-slate-900/20 p-5 sm:p-6 backdrop-blur-sm shadow-xl shadow-slate-950/20 hover:border-slate-700/60 transition-all duration-300">
                    
                    {/* Part A: Added Stocks */}
                    {change.added.length > 0 && (
                      <div className="mb-6 last:mb-0">
                        <div className="text-xs font-extrabold text-emerald-400 flex items-center gap-1.5 mb-4 tracking-wider uppercase">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          {t("Incoming Stocks / Qualified", "新增入选个股")} ({change.added.length})
                        </div>
                        
                        <div className="space-y-3">
                          {change.added.map((stock) => {
                            const isAdded = watchlist.has(stock.symbol);
                            
                            return (
                              <div 
                                key={stock.symbol}
                                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-lg bg-slate-950/60 border border-slate-850 hover:border-slate-800 hover:bg-slate-900/20 transition-all duration-200 gap-4"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="text-sm font-black font-mono bg-slate-900 text-white border border-slate-850 px-2.5 py-1 rounded">
                                    {stock.symbol}
                                  </div>
                                  <div>
                                    <div className="text-xs font-bold text-slate-200 line-clamp-1">{stock.companyName}</div>
                                    <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono mt-1">
                                      {stock.peRatio !== null && (
                                        <span>PE: <strong className="text-slate-400">{stock.peRatio.toFixed(1)}</strong></span>
                                      )}
                                      {stock.revenueGrowthYoY !== null && (
                                        <span>Rev YoY: <strong className="text-slate-400">+{stock.revenueGrowthYoY.toFixed(1)}%</strong></span>
                                      )}
                                      {stock.grossMargin !== null && (
                                        <span>Gross: <strong className="text-slate-400">{stock.grossMargin.toFixed(1)}%</strong></span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                                  {/* Deep Dive Qualitative Report Button */}
                                  <Link
                                    href={`/report/${stock.symbol}?strategy=${change.strategyId}`}
                                    target="_blank"
                                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/25 border border-indigo-500/25 text-indigo-400 rounded-lg text-xs font-bold transition-all"
                                  >
                                    <span>{t("Deep Report", "定性深研")}</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </Link>

                                  {/* Watchlist Toggle */}
                                  <button
                                    onClick={() => !isAdded && handleAddToWatchlist(stock.symbol)}
                                    disabled={isAdded || addingSymbol === stock.symbol}
                                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                      isAdded 
                                        ? "bg-slate-900 border-slate-850 text-emerald-400 cursor-default"
                                        : addingSymbol === stock.symbol 
                                          ? "bg-slate-900 border-slate-850 text-slate-600 animate-pulse"
                                          : "bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white"
                                    }`}
                                  >
                                    {isAdded ? (
                                      <>
                                        <Check className="w-3 h-3" />
                                        <span>{t("Added", "已入组合")}</span>
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="w-3 h-3" />
                                        <span>{t("Add to Watchlist", "加自选")}</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Part B: Removed Stocks */}
                    {change.removed.length > 0 && (
                      <div className="mt-6 border-t border-slate-850 pt-5">
                        <div className="text-xs font-extrabold text-slate-500 flex items-center gap-1.5 mb-3 tracking-wider uppercase">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                          {t("Outgoing Stocks / Disqualified", "移出策略个股")} ({change.removed.length})
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {change.removed.map((symbol) => (
                            <span 
                              key={symbol}
                              className="px-2.5 py-1 rounded bg-slate-950/40 border border-slate-850/50 text-xs font-mono font-medium text-slate-600 line-through"
                            >
                              {symbol}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
