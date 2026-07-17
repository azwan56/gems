"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Gem, ArrowLeft, StarOff, Trash2, Shield, Sword, Rocket, CircleDollarSign, RefreshCcw, AlertTriangle, HelpCircle, ChevronDown, Languages, ArrowUpFromLine, Check, Loader2, X, FileText, TrendingUp, Activity, ActivitySquare, Target, Users, Zap, ShieldAlert, Download, Eye } from "lucide-react";
import type { WatchlistItem, StockMetrics } from "@/lib/types";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { getAllStrategyPresets } from "@/lib/strategies";
import { applyFilters } from "@/lib/screener-engine";
import UserMenu from "@/components/UserMenu";
import PremiumGate from "@/components/PremiumGate";

// Static badge colors for strategy tags
const strategyBadgeColors: Record<string, string> = {
  blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  slate: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

type RoleKey = "anchor" | "striker" | "rocket" | "core_dividend" | "turnaround" | "special_situation" | "unassigned";

export default function WatchlistPage() {
  const { lang, setLang, t } = useLanguage();
  const { user, getIdToken } = useAuth();

  const getRoleConfigs = () => ({
    anchor: { icon: Shield, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", label: t("Anchor", "压舱石"), desc: t("Low volatility, strong cash flow", "低波动，强现金流") },
    striker: { icon: Sword, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", label: t("Striker", "攻击手"), desc: t("High conviction, steady compounding", "高信念，稳健复利") },
    rocket: { icon: Rocket, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", label: t("Rocket", "火箭"), desc: t("High risk/reward, hyper-growth", "高风险高回报，超高速成长") },
    core_dividend: { icon: CircleDollarSign, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", label: t("Core Dividend", "核心收息"), desc: t("Value: Reliable yield", "价值：可靠收益率") },
    turnaround: { icon: RefreshCcw, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20", label: t("Turnaround", "困境反转"), desc: t("Value: Cyclical reversion", "价值：周期均值回归") },
    special_situation: { icon: AlertTriangle, color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20", label: t("Special Sit.", "特殊情况"), desc: t("Value: Event-driven", "价值：事件驱动") },
    unassigned: { icon: HelpCircle, color: "text-slate-400", bg: "bg-slate-800", border: "border-slate-700", label: t("Unassigned", "未分配"), desc: t("Needs allocation", "需要分配角色") }
  });

  const ROLE_CONFIGS = getRoleConfigs();

  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Track sync state per symbol: 'syncing' | 'synced' | 'already_exists' | 'error' | 'limit'
  const [syncState, setSyncState] = useState<Record<string, string>>({});

  // Live quotes from DailyStock backend (yfinance)
  interface QuoteData {
    symbol: string;
    price: number;
    change_percent: number;
    volume: number;
    company_name: string;
  }
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
  const [quotesLoading, setQuotesLoading] = useState(false);

  // Stock pool for strategy matching
  const [stockPool, setStockPool] = useState<StockMetrics[]>([]);
  const [poolUpdatedAt, setPoolUpdatedAt] = useState<string | null>(null);

  // Analyst target prices from FMP deep insights
  interface TargetPriceData {
    targetConsensus: number;
    targetHigh: number;
    targetLow: number;
    targetMedian: number;
  }
  const [targetPrices, setTargetPrices] = useState<Record<string, TargetPriceData>>({});
  const [targetPricesLoading, setTargetPricesLoading] = useState(false);

  // Observe list status — set of symbols already synced to DailyStock
  const [observeListSymbols, setObserveListSymbols] = useState<Set<string>>(new Set());
  const [saList, setSaList] = useState<Set<string>>(new Set());

  // Confirmation modal state
  interface SyncPreview {
    symbol: string;
    companyName: string;
    sector: string;
    industry: string;
    price: number | null;
    marketCap: number | null;
    alreadyInList: boolean;
    observeListCount: number;
    observeListLimit: number | null;
    planType: string;
  }
  const [confirmModal, setConfirmModal] = useState<{ loading: boolean; data: SyncPreview | null; error: string | null }>({ loading: false, data: null, error: null });

  // Load stock pool for strategy matching
  useEffect(() => {
    if (!user?.uid) return;
    async function loadPool() {
      try {
        const token = await getIdToken();
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const [poolRes, saRes] = await Promise.all([
          fetch("/api/stock-pool?include=stocks", { headers }),
          fetch("/api/seeking-alpha", { headers }),
        ]);

        if (poolRes.ok) {
          const data = await poolRes.json();
          if (data?.stocks) setStockPool(data.stocks);
          if (data?.meta?.updatedAt) setPoolUpdatedAt(data.meta.updatedAt);
        }

        if (saRes.ok) {
          const data = await saRes.json();
          if (data?.symbols) {
            setSaList(new Set(data.symbols.map((s: string) => s.toUpperCase())));
          }
        }
      } catch { /* non-critical */ }
    }
    loadPool();
  }, [user?.uid, getIdToken]);

  // Compute which strategies each watchlist stock matches
  const matchedStrategiesMap = useMemo(() => {
    if (stockPool.length === 0) return {} as Record<string, { id: string; name: string; nameZh: string; color: string }[]>;
    const presets = getAllStrategyPresets();
    const map: Record<string, { id: string; name: string; nameZh: string; color: string }[]> = {};
    presets.forEach(preset => {
      const passed = preset.id === "seeking_alpha"
        ? stockPool.filter(s => saList.has(s.symbol.toUpperCase()))
        : applyFilters(stockPool, preset.defaultFilters);
      passed.forEach(s => {
        if (!map[s.symbol]) map[s.symbol] = [];
        map[s.symbol].push({ id: preset.id, name: preset.name, nameZh: preset.nameZh || preset.name, color: preset.color });
      });
    });
    return map;
  }, [stockPool, saList]);

  useEffect(() => {
    if (user?.uid) fetchWatchlist();
  }, [user?.uid]);

  // Fetch live quotes whenever the watchlist changes
  useEffect(() => {
    if (watchlist.length === 0) {
      setQuotes({});
      return;
    }
    const symbols = watchlist.map((w) => w.symbol).join(",");
    const fetchQuotes = async () => {
      setQuotesLoading(true);
      try {
        const token = await getIdToken();
        const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbols)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setQuotes(data.quotes || {});
        }
      } catch { /* ignore — quotes are non-critical */ }
      setQuotesLoading(false);
    };
    fetchQuotes();
    // Refresh quotes every 60 seconds while the page is open
    const interval = setInterval(fetchQuotes, 60_000);
    return () => clearInterval(interval);
  }, [watchlist, getIdToken]);

  // Fetch analyst target prices via server-side proxy (avoids CORS)
  useEffect(() => {
    if (watchlist.length === 0) return;
    let cancelled = false;
    const fetchTargets = async () => {
      setTargetPricesLoading(true);
      try {
        const token = await getIdToken();
        const symbols = watchlist.map(w => w.symbol).join(",");
        const res = await fetch(`/api/target-prices?symbols=${encodeURIComponent(symbols)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setTargetPrices(data.targets || {});
        }
      } catch { /* ignore — target prices are non-critical */ }
      if (!cancelled) setTargetPricesLoading(false);
    };
    fetchTargets();
    return () => { cancelled = true; };
  }, [watchlist, getIdToken]);

  // Fetch observe list status (which stocks are synced to DailyStock)
  useEffect(() => {
    if (!user?.uid) return;
    async function loadObserveList() {
      try {
        // Use the first watchlist symbol to check observe list, or just fetch user doc
        const token = await getIdToken();
        // We can check any symbol — the GET returns observeListCount and the full list
        // But we need to check each symbol — simpler: use the first symbol to get the observe list shape
        // Actually the sync-dailystock GET returns alreadyInList per symbol, so batch check:
        const checks = await Promise.allSettled(
          watchlist.map(async (item) => {
            const res = await fetch(`/api/sync-dailystock?symbol=${encodeURIComponent(item.symbol)}`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (res.ok) {
              const data = await res.json();
              return { symbol: item.symbol, inList: data.alreadyInList };
            }
            return { symbol: item.symbol, inList: false };
          })
        );
        const synced = new Set<string>();
        checks.forEach(r => {
          if (r.status === 'fulfilled' && r.value.inList) {
            synced.add(r.value.symbol);
          }
        });
        setObserveListSymbols(synced);
      } catch { /* non-critical */ }
    }
    if (watchlist.length > 0) loadObserveList();
  }, [watchlist, user?.uid, getIdToken]);

  const fetchWatchlist = async () => {
    if (!user?.uid) return;
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/watchlist?userId=${user.uid}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setWatchlist(data.watchlist);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  const removeItem = async (symbol: string) => {
    if (!user?.uid) return;
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
        setWatchlist((prev) => prev.filter((w) => w.symbol !== symbol));
      }
    } catch { /* ignore */ }
  };

  const updateRole = async (symbol: string, newRole: RoleKey) => {
    if (!user?.uid) return;
    const roleToSend = newRole === "unassigned" ? undefined : newRole;
    try {
      // Optimistic UI update
      setWatchlist(prev => prev.map(item => 
        item.symbol === symbol ? { ...item, role: roleToSend } : item
      ));

      const token = await getIdToken();
      await fetch("/api/watchlist", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId: user.uid, symbol, role: roleToSend }),
      });
    } catch { 
      // Revert on failure by refetching
      fetchWatchlist();
    }
  };

  // Step 1: Open confirm modal — fetch stock preview info
  const openSyncConfirm = useCallback(async (symbol: string) => {
    if (!user?.uid) return;
    setConfirmModal({ loading: true, data: null, error: null });
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/sync-dailystock?symbol=${encodeURIComponent(symbol)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setConfirmModal({ loading: false, data, error: null });
      } else {
        setConfirmModal({ loading: false, data: null, error: t("Failed to load stock info", "无法加载股票信息") });
      }
    } catch {
      setConfirmModal({ loading: false, data: null, error: t("Network error", "网络错误") });
    }
  }, [user?.uid, getIdToken, t]);

  // Step 2: Confirm sync — actually write to observe_list
  const confirmSync = useCallback(async () => {
    const symbol = confirmModal.data?.symbol;
    if (!symbol || !user?.uid) return;
    
    // Find the current role in the watchlist
    const currentRole = watchlist.find(w => w.symbol === symbol)?.role;
    
    setConfirmModal(prev => ({ ...prev, loading: true }));
    try {
      const token = await getIdToken();
      const res = await fetch("/api/sync-dailystock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ symbol, role: currentRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setSyncState(prev => ({ ...prev, [symbol]: data.status === 'already_exists' ? 'already_exists' : 'synced' }));
      } else if (res.status === 403) {
        setSyncState(prev => ({ ...prev, [symbol]: 'limit' }));
      } else {
        setSyncState(prev => ({ ...prev, [symbol]: 'error' }));
      }
    } catch {
      setSyncState(prev => ({ ...prev, [symbol]: 'error' }));
    }
    setConfirmModal({ loading: false, data: null, error: null });
    // Reset transient states after 3 seconds
    setTimeout(() => {
      setSyncState(prev => {
        const current = prev[symbol];
        if (current === 'error' || current === 'limit' || current === 'already_exists') {
          const { [symbol]: _, ...rest } = prev;
          return rest;
        }
        return prev;
      });
    }, 3000);
  }, [confirmModal.data, user?.uid, getIdToken]);

  const closeSyncModal = useCallback(() => {
    setConfirmModal({ loading: false, data: null, error: null });
  }, []);

  const formatMarketCap = (mc: number | null) => {
    if (!mc) return '—';
    if (mc >= 1e12) return `$${(mc / 1e12).toFixed(2)}T`;
    if (mc >= 1e9) return `$${(mc / 1e9).toFixed(1)}B`;
    if (mc >= 1e6) return `$${(mc / 1e6).toFixed(0)}M`;
    return `$${mc.toLocaleString()}`;
  };

  // Analysis report slide-out panel — uses the shared type with scores + catalysts
  type AnalysisReport = import("@/lib/analysis-engine").StockAnalysisReport;
  const [analysisPanel, setAnalysisPanel] = useState<{ symbol: string; loading: boolean; report: AnalysisReport | null } | null>(null);
  const [shareCardUrl, setShareCardUrl] = useState<string | null>(null);
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);

  const openAnalysis = useCallback(async (symbol: string) => {
    setAnalysisPanel({ symbol, loading: true, report: null });
    try {
      const token = await getIdToken();
      // Determine strategy based on role
      const item = watchlist.find(w => w.symbol === symbol);
      const role = item?.role;
      const strategy = (role === 'core_dividend' || role === 'turnaround' || role === 'special_situation') ? 'value' : 'large_growth';
      const res = await fetch(`/api/analysis?symbol=${symbol}&strategy=${strategy}&lang=${lang}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setAnalysisPanel({ symbol, loading: false, report: data.report });
      } else {
        setAnalysisPanel({ symbol, loading: false, report: null });
      }
    } catch {
      setAnalysisPanel({ symbol, loading: false, report: null });
    }
  }, [getIdToken, watchlist, lang]);

  // Share card generation effect
  useEffect(() => {
    if (!analysisPanel?.report || !analysisPanel.symbol) {
      setShareCardUrl(null);
      return;
    }
    let cancelled = false;
    const generateCard = async () => {
      setIsGeneratingCard(true);
      try {
        const { generateShareCardDataURL } = await import("@/lib/share-card");

        // 1. Fetch real metrics from stock pool (needs auth token)
        let stockData: import("@/lib/types").StockMetrics | null = null;
        try {
          const token = await getIdToken();
          const metricsRes = await fetch(`/api/stock-metrics?symbol=${encodeURIComponent(analysisPanel.symbol)}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (metricsRes.ok) {
            const metricsJson = await metricsRes.json();
            stockData = metricsJson.metrics;
          }
        } catch (err) {
          console.error("Failed to fetch stock metrics, using fallback:", err);
        }

        // Fallback: use live quote price from watchlist quotes (not analyst target!)
        if (!stockData) {
          const liveQuote = quotes[analysisPanel.symbol];
          const livePrice = liveQuote?.price || 0;
          stockData = {
            symbol: analysisPanel.symbol,
            companyName: liveQuote?.company_name || analysisPanel.symbol,
            sector: "",
            industry: "",
            marketCap: 0,
            price: livePrice,
            peRatio: null,
            pbRatio: null,
            freeCashFlowYield: null,
            dividendYield: null,
            currentRatio: null,
            debtToEquity: null,
            revenueGrowthYoY: null,
            epsGrowthYoY: null,
            pegRatio: null,
            roe: null,
            grossMargin: null,
            netMargin: null,
            priceVs50SMA: null,
            priceVs200SMA: null,
            fiftyTwoWeekHigh: null,
            fiftyTwoWeekLow: null,
          };
        }

        const report = { ...analysisPanel.report!, symbol: analysisPanel.symbol, positionSuggestion: "" };
        
        let shareId = "";
        const strategyName = lang === "en" ? "Watchlist Deep Dive" : "自选股深度分析";

        // 2. Create share link in Firestore
        try {
          const res = await fetch("/api/share", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              symbol: analysisPanel.symbol,
              strategy: "watchlist",
              strategyName,
              report,
              metrics: stockData,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            shareId = data.shareId;
          }
        } catch (err) {
          console.error("Failed to create share link", err);
        }

        // 3. Generate Canvas Card
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const url = await generateShareCardDataURL(stockData, report as any, lang, strategyName, shareId);
        if (!cancelled) setShareCardUrl(url);
      } catch (e) {
        console.error("Failed to generate share card", e);
      } finally {
        if (!cancelled) setIsGeneratingCard(false);
      }
    };
    generateCard();
    return () => { cancelled = true; };
  }, [analysisPanel?.symbol, analysisPanel?.report, lang, watchlist]);

  // Group items
  const grouped = watchlist.reduce((acc, item) => {
    const role = item.role || "unassigned";
    if (!acc[role]) acc[role] = [];
    acc[role].push(item);
    return acc;
  }, {} as Record<string, WatchlistItem[]>);

  // Growth layout vs Value layout vs Unassigned
  const growthRoles: RoleKey[] = ["anchor", "striker", "rocket"];
  const valueRoles: RoleKey[] = ["core_dividend", "turnaround", "special_situation"];

  const renderStockCard = (item: WatchlistItem) => {
    const q = quotes[item.symbol];
    const hasQuote = q && q.price > 0;
    const changeColor = q && q.change_percent > 0 ? "text-emerald-400" : q && q.change_percent < 0 ? "text-red-400" : "text-slate-400";
    const changePrefix = q && q.change_percent > 0 ? "+" : "";

    return (
    <div key={item.symbol} className="bg-slate-800/40 border border-slate-700/60 rounded-xl px-3 py-2 flex items-center justify-between hover:bg-slate-800 hover:border-slate-600 transition-all group">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="font-bold text-white text-base tracking-wide">{item.symbol}</span>
        {hasQuote ? (
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-mono text-slate-300">${q.price.toFixed(2)}</span>
            <span className={`text-xs font-semibold font-mono ${changeColor}`}>
              {changePrefix}{q.change_percent.toFixed(2)}%
            </span>
          </div>
        ) : quotesLoading ? (
          <div className="w-16 h-3 bg-slate-700/50 rounded animate-pulse" />
        ) : null}
      </div>
      <div className="flex items-center gap-1.5">
        <div className="relative">
          <select
            value={item.role || "unassigned"}
            onChange={(e) => updateRole(item.symbol, e.target.value as RoleKey)}
            className="appearance-none bg-slate-900/60 border border-slate-700/50 hover:border-slate-600 text-xs text-slate-400 hover:text-slate-300 rounded-lg pl-2 pr-6 py-1 outline-none cursor-pointer transition-colors"
          >
            <option value="unassigned">--</option>
            <option value="anchor">{t("Anchor", "压舱石")}</option>
            <option value="striker">{t("Striker", "攻击手")}</option>
            <option value="rocket">{t("Rocket", "火箭")}</option>
            <option value="core_dividend">{t("Dividend", "收息")}</option>
            <option value="turnaround">{t("Turnaround", "反转")}</option>
            <option value="special_situation">{t("Special", "特殊")}</option>
          </select>
          <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2 top-2 pointer-events-none" />
        </div>
        {/* Sync to DailyStock observe_list */}
        {syncState[item.symbol] === 'synced' ? (
          <span className="p-1 rounded-md text-emerald-400" title={t("Synced to DailyStock", "已同步到 DailyStock")}>
            <Check className="w-3.5 h-3.5" />
          </span>
        ) : syncState[item.symbol] === 'already_exists' ? (
          <span className="p-1 rounded-md text-amber-400" title={t("Already in DailyStock observe list", "已在 DailyStock 观察清单中")}>
            <Check className="w-3.5 h-3.5" />
          </span>
        ) : syncState[item.symbol] === 'limit' ? (
          <span className="p-1 rounded-md text-red-400 cursor-help" title={t("Observe list limit reached. Upgrade your plan.", "观察清单已满，请升级计划。")}>
            <AlertTriangle className="w-3.5 h-3.5" />
          </span>
        ) : (
          <button
            onClick={() => openSyncConfirm(item.symbol)}
            className="p-1 rounded-md text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
            title={t("Sync to DailyStock observe list", "同步到 DailyStock 观察清单")}
          >
            <ArrowUpFromLine className="w-3.5 h-3.5" />
          </button>
        )}
        {/* Stock info / analysis report */}
        <button
          onClick={() => openAnalysis(item.symbol)}
          className="p-1 rounded-md text-slate-500 hover:text-purple-400 hover:bg-purple-500/10 transition-colors"
          title={t("View stock report", "查看股票报告")}
        >
          <FileText className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => removeItem(item.symbol)}
          className="p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title={t("Remove from portfolio", "从投资组合中移除")}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
    );
  };

  const renderColumn = (roleKey: RoleKey) => {
    const config = ROLE_CONFIGS[roleKey];
    const items = grouped[roleKey] || [];
    const Icon = config.icon;

    return (
      <div key={roleKey} className={`flex flex-col rounded-2xl border ${config.border} bg-slate-900/50 overflow-hidden`}>
        <div className={`p-4 border-b ${config.border} ${config.bg} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-slate-900 ${config.color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h2 className={`font-bold ${config.color}`}>{config.label}</h2>
              <p className="text-xs text-slate-400">{config.desc}</p>
            </div>
          </div>
          <span className="text-sm font-mono font-bold text-slate-500 bg-slate-900 px-2.5 py-1 rounded-md">{items.length}</span>
        </div>
        <div className="p-4 flex-1 space-y-3 min-h-[150px]">
          {items.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-600 border-2 border-dashed border-slate-800 rounded-xl p-6 text-center">
              {t("No stocks assigned to this role", "尚未有股票分配至此角色")}
            </div>
          ) : (
            items.map(renderStockCard)
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-4 sm:px-6 py-3 sm:py-4 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <Link href="/" className="flex items-center gap-1.5 sm:gap-2 text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <Gem className="w-5 h-5 text-blue-400" />
              <span className="font-bold text-white hidden sm:inline">Gems</span>
            </Link>
            <div className="h-5 w-px bg-slate-700 hidden sm:block" />
            <h1 className="text-sm font-semibold truncate">{t("Portfolio Dashboard", "投资组合面板")}</h1>
            <div className="ml-auto sm:hidden flex items-center gap-2">
              <button 
                onClick={() => setLang(lang === "en" ? "zh" : "en")}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors border border-slate-700"
              >
                <Languages className="w-3.5 h-3.5 text-blue-400" />
                {lang === "en" ? "中" : "EN"}
              </button>
              <UserMenu />
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-6 text-xs sm:text-sm w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
            <Link href="/updates" className="text-slate-400 hover:text-white transition-colors whitespace-nowrap">
              {t("Updates", "更新动态")}
            </Link>
            <div className="h-4 sm:h-5 w-px bg-slate-700 hidden sm:block" />
            <div className="text-slate-400 whitespace-nowrap">
              <span className="hidden sm:inline">{t("Total Conviction Picks:", "总计高信念优选：")}</span> <span className="text-white font-bold">{watchlist.length}</span> / 10
            </div>
            <div className="h-4 sm:h-5 w-px bg-slate-700 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-3">
              <button 
                onClick={() => setLang(lang === "en" ? "zh" : "en")}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors border border-slate-700"
              >
                <Languages className="w-4 h-4 text-blue-400" />
                {lang === "en" ? "中文" : "English"}
              </button>
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Content — Premium Only */}
      <PremiumGate featureName={t("Portfolio Dashboard", "投资组合面板")}>
      <div className="flex-1 px-4 sm:px-6 py-6 sm:py-8 overflow-x-auto">
        <div className="max-w-7xl mx-auto w-full">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : watchlist.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <StarOff className="w-16 h-16 text-slate-700 mb-6" />
              <h2 className="text-2xl font-bold text-slate-300 mb-3">{t("Your Portfolio is Empty", "您的投资组合为空")}</h2>
              <p className="text-slate-500 mb-8 max-w-md">
                {t("Run a screening strategy to find high-conviction stocks and assign them to your portfolio formation.", "运行选股策略以寻找高信念股票，并将其分配到您的投资组合阵型中。")}
              </p>
              <Link
                href="/"
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all hover:scale-105 shadow-lg shadow-blue-500/20"
              >
                {t("Browse Strategies", "浏览策略")}
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Date Header Block */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t("Market Active", "美股交易跟踪")}</span>
                </div>
                <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
                  <span>
                    {t("Current Date:", "当前日期：")}
                    <span className="text-slate-200 font-bold ml-1">{new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
                  </span>
                  {poolUpdatedAt && (
                    <>
                      <span className="text-slate-700">|</span>
                      <span>
                        {t("Data Updated:", "行情更新时间：")}
                        <span className="text-slate-200 font-bold ml-1">{new Date(poolUpdatedAt).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Table header */}
              <div className="hidden md:grid md:grid-cols-[2.5rem_1.2fr_1.3fr_1fr_1fr_5rem_8rem] gap-4 items-center px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <span>#</span>
                <span>{t("Stock", "股票")}</span>
                <span>{t("Matched Strategies", "入选策略")}</span>
                <span>{t("Prev Close Price", "前收盘价")}</span>
                <span className="text-right">{t("Target Price", "目标价")}</span>
                <span className="text-right">Beta</span>
                <span className="text-right">{t("Actions", "操作")}</span>
              </div>

              {watchlist.map((item, idx) => {
                const q = quotes[item.symbol];
                const hasQuote = q && q.price > 0;
                const changeColor = q && q.change_percent > 0 ? "text-emerald-400" : q && q.change_percent < 0 ? "text-red-400" : "text-slate-400";
                const changePrefix = q && q.change_percent > 0 ? "+" : "";

                // Determine matched strategies from stock pool
                const stockData = stockPool.find(s => s.symbol === item.symbol);
                const matched = stockData ? matchedStrategiesMap[item.symbol] || [] : [];
                const companyName = stockData?.companyName || q?.company_name || item.symbol;
                const sector = stockData?.sector || "";
                const industry = stockData?.industry || "";
                const isObserved = observeListSymbols.has(item.symbol);
                const tp = targetPrices[item.symbol];
                const prevClosePrice = stockData?.price || 0;
                const upsidePercent = tp && prevClosePrice > 0 ? ((tp.targetConsensus - prevClosePrice) / prevClosePrice * 100) : null;

                return (
                  <div key={item.symbol} className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
                    <div className="grid grid-cols-1 md:grid-cols-[2.5rem_1.2fr_1.3fr_1fr_1fr_5rem_8rem] gap-3 md:gap-4 items-center">
                      
                      {/* Rank */}
                      <div className="hidden md:block">
                        <span className="text-sm font-bold text-slate-600">#{idx + 1}</span>
                      </div>

                      {/* Stock Info — enriched with company, sector/industry, observe status */}
                      <div className="flex items-center gap-3">
                        <span className="md:hidden text-xs font-bold text-slate-600">#{idx + 1}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-base">{item.symbol}</span>
                            {isObserved && (
                              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20" title={t("Synced to DailyStock observe list", "已同步至观察清单")}>
                                <Eye className="w-3 h-3 text-cyan-400" />
                                <span className="text-[9px] font-medium text-cyan-400 hidden sm:inline">{t("Observed", "观察中")}</span>
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 line-clamp-1">{companyName}</p>
                          {(sector || industry) && (
                            <p className="text-[10px] text-slate-600 line-clamp-1 mt-0.5">
                              {sector}{sector && industry ? " · " : ""}{industry}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Matched Strategies */}
                      <div className="flex flex-wrap gap-1.5">
                        {matched.length > 0 ? (
                          matched.map(strat => (
                            <span
                              key={strat.id}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${strategyBadgeColors[strat.color] || strategyBadgeColors.slate}`}
                            >
                              {lang === 'zh' ? strat.nameZh : strat.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-600 italic">{t("Not screened", "暂无策略匹配")}</span>
                        )}
                      </div>

                      {/* Previous Close Price — from stock pool or live quote */}
                      <div>
                        {stockData?.price !== undefined ? (
                          <span className="text-lg font-bold font-mono text-white">${stockData.price.toFixed(2)}</span>
                        ) : quotes[item.symbol]?.price !== undefined && quotes[item.symbol]?.price > 0 ? (
                          <span className="text-lg font-bold font-mono text-white">${quotes[item.symbol].price.toFixed(2)}</span>
                        ) : (
                          <span className="text-sm text-slate-600">—</span>
                        )}
                      </div>

                      {/* Target Price — from FMP analyst consensus */}
                      <div className="md:text-right">
                        {tp ? (
                          <div>
                            <span className="text-sm font-bold font-mono text-blue-400">
                              ${tp.targetConsensus.toFixed(2)}
                            </span>
                            {upsidePercent !== null && (
                              <div className={`text-[10px] font-semibold font-mono ${upsidePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {upsidePercent >= 0 ? "↑" : "↓"} {Math.abs(upsidePercent).toFixed(1)}%
                              </div>
                            )}
                          </div>
                        ) : targetPricesLoading ? (
                          <div className="w-16 h-5 bg-slate-800 rounded animate-pulse ml-auto" />
                        ) : (
                          <span className="text-sm text-slate-600">—</span>
                        )}
                      </div>

                      {/* Beta Value Column */}
                      <div className="md:text-right">
                        <span className="text-xs font-semibold text-slate-500 md:hidden block mb-1">Beta</span>
                        {stockData?.beta !== undefined && stockData.beta !== null ? (
                          <span className={`text-base font-bold font-mono ${stockData.beta > 1.0 ? "text-orange-400" : "text-cyan-400"}`}>
                            {stockData.beta.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-600">—</span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 md:justify-end">
                        {/* Sync to DailyStock */}
                        {syncState[item.symbol] === 'synced' ? (
                          <span className="p-1.5 rounded-md text-emerald-400" title={t("Synced to DailyStock", "已同步到 DailyStock")}>
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        ) : syncState[item.symbol] === 'already_exists' ? (
                          <span className="p-1.5 rounded-md text-amber-400" title={t("Already in DailyStock observe list", "已在 DailyStock 观察清单中")}>
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        ) : syncState[item.symbol] === 'limit' ? (
                          <span className="p-1.5 rounded-md text-red-400 cursor-help" title={t("Observe list limit reached. Upgrade your plan.", "观察清单已满，请升级计划。")}>
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <button
                            onClick={() => openSyncConfirm(item.symbol)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                            title={t("Sync to DailyStock observe list", "同步到 DailyStock 观察清单")}
                          >
                            <ArrowUpFromLine className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {/* Stock analysis report */}
                        <button
                          onClick={() => openAnalysis(item.symbol)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-purple-400 hover:bg-purple-500/10 transition-colors"
                          title={t("View stock report", "查看股票报告")}
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        {/* Remove */}
                        <button
                          onClick={() => removeItem(item.symbol)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title={t("Remove from portfolio", "从投资组合中移除")}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      </PremiumGate>

      {/* Sync Confirmation Modal */}
      {(confirmModal.loading || confirmModal.data || confirmModal.error) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={closeSyncModal}>
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/50 w-full max-w-md mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Loading state */}
            {confirmModal.loading && !confirmModal.data && (
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-4" />
                <p className="text-slate-400 text-sm">{t("Loading stock info...", "正在加载股票信息...")}</p>
              </div>
            )}

            {/* Error state */}
            {confirmModal.error && (
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <AlertTriangle className="w-8 h-8 text-red-400 mb-4" />
                <p className="text-red-400 text-sm mb-4">{confirmModal.error}</p>
                <button onClick={closeSyncModal} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors">
                  {t("Close", "关闭")}
                </button>
              </div>
            )}

            {/* Confirmation with stock info */}
            {confirmModal.data && (
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                  <h3 className="text-base font-bold text-white">{t("Sync to DailyStock", "同步到 DailyStock")}</h3>
                  <button onClick={closeSyncModal} className="p-1 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Stock Info */}
                <div className="px-6 py-5">
                  <div className="flex items-start gap-4 mb-5">
                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      <ArrowUpFromLine className="w-6 h-6 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-xl font-bold text-white">{confirmModal.data.symbol}</span>
                        {confirmModal.data.price && (
                          <span className="text-sm font-mono text-slate-400">${confirmModal.data.price.toFixed(2)}</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400 truncate">{confirmModal.data.companyName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {confirmModal.data.sector} · {confirmModal.data.industry}
                        {confirmModal.data.marketCap && <> · {formatMarketCap(confirmModal.data.marketCap)}</>}
                      </p>
                    </div>
                  </div>

                  {/* Observe list status */}
                  <div className="bg-slate-800/60 rounded-xl px-4 py-3 mb-5 border border-slate-700/50">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">{t("Observe List", "观察清单")}</span>
                      <span className="text-white font-mono font-bold">
                        {confirmModal.data.observeListCount}
                        {confirmModal.data.observeListLimit && <span className="text-slate-500"> / {confirmModal.data.observeListLimit}</span>}
                      </span>
                    </div>
                    {confirmModal.data.alreadyInList && (
                      <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        {t("This stock is already in your observe list", "该股票已在你的观察清单中")}
                      </p>
                    )}
                  </div>

                  {/* Action hint */}
                  <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                    {t(
                      `This will add ${confirmModal.data.symbol} to your DailyStock observe list. You will receive daily observation reports for this stock.`,
                      `此操作将把 ${confirmModal.data.symbol} 添加到你的 DailyStock 观察清单。你将收到该股票的每日观察研报。`
                    )}
                  </p>

                  {/* Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={closeSyncModal}
                      className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors border border-slate-700"
                    >
                      {t("Cancel", "取消")}
                    </button>
                    <button
                      onClick={confirmSync}
                      disabled={confirmModal.loading || confirmModal.data.alreadyInList}
                      className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 disabled:shadow-none flex items-center justify-center gap-2"
                    >
                      {confirmModal.loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : confirmModal.data.alreadyInList ? (
                        t("Already Synced", "已同步")
                      ) : (
                        <>{t("Confirm Sync", "确认同步")}</>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* AI Analysis Slide-out Panel */}
      {analysisPanel && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAnalysisPanel(null)} />
          <div className="relative w-full sm:max-w-2xl h-full bg-slate-900 border-l border-slate-800 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300">
            <div className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-4 sm:py-6 flex justify-between items-start">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-0.5 sm:mb-1">{analysisPanel.symbol}</h2>
                <p className="text-xs sm:text-sm text-slate-400">{t("AI Investment Analysis", "AI 投资分析报告")}</p>
              </div>
              <div className="flex items-center gap-2">
                {analysisPanel.report && (
                  <button
                    onClick={async () => {
                      if (shareCardUrl && analysisPanel) {
                        const { downloadShareCard } = await import("@/lib/share-card");
                        downloadShareCard(shareCardUrl, analysisPanel.symbol);
                      }
                    }}
                    disabled={!shareCardUrl || isGeneratingCard}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors"
                    title={t("Download Share Card", "下载分享卡片")}
                  >
                    {isGeneratingCard ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {t("Share", "分享")}
                  </button>
                )}
                <button onClick={() => setAnalysisPanel(null)} className="p-1.5 sm:p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
            </div>

            {/* Panel Content */}
            <div className="px-4 sm:px-8 py-4 sm:py-6 space-y-6 sm:space-y-8 pb-20">
              {analysisPanel.loading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-4" />
                  <p className="text-slate-400 text-sm">{t("Generating investment analysis...", "正在生成投资分析报告...")}</p>
                </div>
              ) : analysisPanel.report ? (
                <>
                  {/* Analyst Pricing & Targets */}
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-gradient-to-br from-blue-900/30 to-indigo-900/30 border border-blue-500/20 rounded-xl p-4">
                      <div className="flex items-center gap-1.5 text-blue-400 mb-2">
                        <Target className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">{t("Price Target", "目标价")}</span>
                      </div>
                      <div className="text-xl sm:text-2xl font-bold text-white truncate">{analysisPanel.report.analyst.targetPrice}</div>
                      <div className="text-xs font-semibold text-emerald-400 mt-1">{analysisPanel.report.analyst.upside}</div>
                    </div>
                    
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                      <div className="flex items-center gap-1.5 text-slate-400 mb-2">
                        <Users className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">{t("Consensus", "市场共识")}</span>
                      </div>
                      <div className="text-lg sm:text-xl font-bold text-emerald-400 mb-1 truncate">{t(analysisPanel.report.analyst.consensus, analysisPanel.report.analyst.consensus)}</div>
                      <div className="text-[10px] text-slate-500 flex flex-wrap gap-x-2">
                        <span>{t("Buy", "买入")}: {analysisPanel.report.analyst.breakdown.buy}</span>
                        <span>{t("Hold", "持有")}: {analysisPanel.report.analyst.breakdown.hold}</span>
                        <span>{t("Sell", "卖出")}: {analysisPanel.report.analyst.breakdown.sell}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quantitative Scores */}
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                      <div className="flex items-center gap-1.5 text-purple-400 mb-2">
                        <ActivitySquare className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">{t("Technical", "技术面评分")}</span>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl sm:text-2xl font-bold text-white">{analysisPanel.report.technicalScore}</span>
                        <span className="text-[10px] text-slate-500">/ 100</span>
                      </div>
                      <div className="w-full bg-slate-900 h-1.5 mt-2 rounded-full overflow-hidden">
                        <div className="bg-purple-500 h-full rounded-full" style={{ width: `${analysisPanel.report.technicalScore}%` }} />
                      </div>
                    </div>

                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                      <div className="flex items-center gap-1.5 text-amber-400 mb-2">
                        <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">{t("Fundamental", "基本面评分")}</span>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl sm:text-2xl font-bold text-white">{analysisPanel.report.fundamentalScore}</span>
                        <span className="text-[10px] text-slate-500">/ 100</span>
                      </div>
                      <div className="w-full bg-slate-900 h-1.5 mt-2 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-full rounded-full" style={{ width: `${analysisPanel.report.fundamentalScore}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Overview */}
                  <section>
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400" /> {t("Company Overview", "公司概况")}
                    </h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{analysisPanel.report.overview}</p>
                  </section>

                  {/* Fundamentals */}
                  <section>
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" /> {t("Fundamentals", "基本面")}
                    </h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{analysisPanel.report.fundamentals}</p>
                  </section>

                  {/* Products & Services */}
                  <section>
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-purple-400" /> {t("Products & Services", "产品与服务")}
                    </h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{analysisPanel.report.products}</p>
                  </section>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 pt-2 sm:pt-4">
                    {/* Rationale */}
                    <section className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-5">
                      <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Zap className="w-4 h-4" /> {t("Why We Like It", "看多理由")}
                      </h3>
                      <ul className="space-y-2 text-sm text-slate-400">
                        {analysisPanel.report.rationale.map((line, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-emerald-500 mt-0.5 shrink-0">•</span>
                            <span className="leading-relaxed">{line}</span>
                          </li>
                        ))}
                      </ul>
                    </section>

                    {/* Risks */}
                    <section className="bg-red-500/5 border border-red-500/10 rounded-xl p-5">
                      <h3 className="text-sm font-bold text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4" /> {t("Key Risks", "主要风险")}
                      </h3>
                      <ul className="space-y-2 text-sm text-slate-400">
                        {analysisPanel.report.risks.map((line, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-red-500 mt-0.5 shrink-0">•</span>
                            <span className="leading-relaxed">{line}</span>
                          </li>
                        ))}
                      </ul>
                    </section>

                    {/* Catalysts */}
                    <section className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-5">
                      <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Rocket className="w-4 h-4" /> {t("Key Catalysts", "核心催化剂")}
                      </h3>
                      <ul className="space-y-2 text-sm text-slate-400">
                        {analysisPanel.report.catalysts && analysisPanel.report.catalysts.length > 0 ? (
                          analysisPanel.report.catalysts.map((line, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="text-blue-500 mt-0.5 shrink-0">•</span>
                              <span className="leading-relaxed">{line}</span>
                            </li>
                          ))
                        ) : (
                          <li className="text-slate-600 italic">{t("No near-term catalysts identified.", "暂无近期催化事件。")}</li>
                        )}
                      </ul>
                    </section>
                  </div>

                  {/* Position Suggestion */}
                  {analysisPanel.report.positionSuggestion && (
                    <section className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t("Position Suggestion", "持仓建议")}</h3>
                      <p className="text-sm text-slate-300 leading-relaxed">{analysisPanel.report.positionSuggestion}</p>
                    </section>
                  )}

                  {/* Full PDF Report Link */}
                  <div className="flex justify-center">
                    <Link
                      href={`/report/${analysisPanel.symbol}?strategy=${(() => { const item = watchlist.find(w => w.symbol === analysisPanel!.symbol); const role = item?.role; return (role === 'core_dividend' || role === 'turnaround' || role === 'special_situation') ? 'value' : 'large_growth'; })()}&lang=${lang}`}
                      target="_blank"
                      className="px-5 py-2.5 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-lg font-semibold flex items-center gap-2 transition-colors text-sm"
                    >
                      <FileText className="w-4 h-4" /> {t("Full PDF Report", "完整 PDF 研报")}
                    </Link>
                  </div>

                  {/* Share Card Section */}
                  <div className="mt-8 pt-6 border-t border-slate-800">
                    <div className="flex justify-between items-end mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-white mb-1">{t("Share Report", "分享报告")}</h3>
                        <p className="text-sm text-slate-400">{t("Download this deep dive as a shareable image.", "将此深度研报下载为图片分享。")}</p>
                      </div>
                      <button
                        onClick={async () => {
                          if (shareCardUrl && analysisPanel) {
                            const { downloadShareCard } = await import("@/lib/share-card");
                            downloadShareCard(shareCardUrl, analysisPanel.symbol);
                          }
                        }}
                        disabled={!shareCardUrl || isGeneratingCard}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors"
                      >
                        {isGeneratingCard ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        {t("Download Card", "下载分享卡片")}
                      </button>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex justify-center overflow-hidden relative">
                      {isGeneratingCard ? (
                         <div className="flex flex-col items-center justify-center py-12">
                           <Loader2 className="w-6 h-6 text-blue-400 animate-spin mb-3" />
                           <p className="text-sm text-slate-500">{t("Generating high-res card...", "正在生成高清分享卡片...")}</p>
                         </div>
                      ) : shareCardUrl ? (
                         <img src={shareCardUrl} alt="Share Card Preview" className="max-w-full h-auto rounded-lg border border-slate-800 shadow-2xl" style={{ maxHeight: "400px" }} />
                      ) : (
                         <div className="py-12 text-slate-600 text-sm">{t("Card preview unavailable", "暂无预览")}</div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-16 text-slate-500">{t("Failed to load analysis.", "分析报告加载失败。")}</div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
