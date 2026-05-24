"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Gem, ArrowLeft, Star, Activity, BrainCircuit, LineChart, 
  ChevronRight, CheckCircle2, AlertCircle, Loader2, Play,
  FileText, X, Target, ShieldAlert, Zap, TrendingUp, Users, Languages,
  RefreshCw, Database, Cloud, BookOpen, Plus, Trash2, HelpCircle, Download
} from "lucide-react";
import type { StockMetrics, FilterCriterion, ScreenerResponse, StrategyType } from "@/lib/types";
import type { StockAnalysisReport } from "@/lib/analysis-engine";
import { STRATEGY_PRESETS } from "@/lib/strategies";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import UserMenu from "@/components/UserMenu";
import PremiumGate from "@/components/PremiumGate";

function formatMarketCap(val: number): string {
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val.toLocaleString()}`;
}
function formatNum(val: number | null, suffix = ""): string {
  return val === null || val === undefined ? "—" : `${val.toFixed(1)}${suffix}`;
}

export default function FunnelScreenerPage() {
  const params = useParams();
  const strategyId = params.strategy as StrategyType;
  const preset = STRATEGY_PRESETS[strategyId];

  const { lang, setLang, t } = useLanguage();
  const { user, firebaseUser, getIdToken, loading: authLoading } = useAuth();

  const [stocks, setStocks] = useState<StockMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [selectedInStep1, setSelectedInStep1] = useState<Set<string>>(new Set());
  const [selectedInStep2, setSelectedInStep2] = useState<Set<string>>(new Set());
  
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  
  // Data source tracking
  const [dataSource, setDataSource] = useState<"fmp" | "mock">("mock");
  const [poolUpdatedAt, setPoolUpdatedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Slide-out Analysis Panel State
  const [analyzingStock, setAnalyzingStock] = useState<StockMetrics | null>(null);
  const [analysisReport, setAnalysisReport] = useState<StockAnalysisReport | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [shareCardUrl, setShareCardUrl] = useState<string | null>(null);
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);

  // Seeking Alpha custom list management
  const [saSymbols, setSaSymbols] = useState<string[]>([]);
  const [saInput, setSaInput] = useState("");
  const [saLoading, setSaLoading] = useState(false);
  const isSA = strategyId === "seeking_alpha";

  // Load SA list on mount if strategy is seeking_alpha
  useEffect(() => {
    if (!isSA || authLoading || !user) return;
    const loadSA = async () => {
      try {
        const token = await getIdToken();
        const res = await fetch("/api/seeking-alpha", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setSaSymbols(data.symbols || []);
        }
      } catch {}
    };
    loadSA();
  }, [isSA, getIdToken, authLoading, user]);

  const addSASymbols = async () => {
    const raw = saInput.toUpperCase().trim();
    if (!raw) return;
    // Support comma, space, or newline separated
    const newSymbols = raw.split(/[,\s\n]+/).map((s) => s.trim()).filter(Boolean);
    if (newSymbols.length === 0) return;
    setSaLoading(true);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/seeking-alpha", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ symbols: newSymbols }),
      });
      if (res.ok) {
        const data = await res.json();
        setSaSymbols(data.symbols || []);
        setSaInput("");
        // Re-run screener
        await fetchStocks();
      }
    } catch { /* ignore */ }
    setSaLoading(false);
  };

  const removeSASymbol = async (symbol: string) => {
    try {
      const token = await getIdToken();
      const res = await fetch("/api/seeking-alpha", {
        method: "DELETE",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ symbol }),
      });
      if (res.ok) {
        const data = await res.json();
        setSaSymbols(data.symbols || []);
        await fetchStocks();
      }
    } catch { /* ignore */ }
  };

  const openAnalysis = async (stock: StockMetrics) => {
    setAnalyzingStock(stock);
    setAnalysisReport(null);
    setAnalysisLoading(true);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/analysis?symbol=${stock.symbol}&strategy=${strategyId}&lang=${lang}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setAnalysisReport(data.report);
      }
    } catch { /* ignore */ }
    setAnalysisLoading(false);
  };

  useEffect(() => {
    if (!analyzingStock || !analysisReport) {
      setShareCardUrl(null);
      return;
    }
    let cancelled = false;
    const generateCard = async () => {
      setIsGeneratingCard(true);
      try {
        const { generateShareCardDataURL } = await import("@/lib/share-card");
        const url = await generateShareCardDataURL(analyzingStock, analysisReport, lang, strategyId);
        if (!cancelled) setShareCardUrl(url);
      } catch (e) {
        console.error("Failed to generate share card", e);
      } finally {
        if (!cancelled) setIsGeneratingCard(false);
      }
    };
    generateCard();
    return () => { cancelled = true; };
  }, [analyzingStock, analysisReport, lang]);

  const fetchStocks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters = preset?.defaultFilters ?? [];
      const body = JSON.stringify({ strategy: strategyId, filters, limit: 200 });

      const doFetch = async (token: string | null) => {
        return fetch("/api/screener", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body,
        });
      };

      let token = await getIdToken();
      let res = await doFetch(token);

      // On 401, force-refresh the token and retry once
      if (res.status === 401 && firebaseUser) {
        console.warn("[screener] 401 received, force-refreshing token and retrying...");
        try {
          token = await firebaseUser.getIdToken(true);
          res = await doFetch(token);
        } catch (refreshErr) {
          console.error("[screener] Token refresh failed:", refreshErr);
        }
      }

      if (!res.ok) {
        let msg = `API error: ${res.status}`;
        try {
          const errBody = await res.json();
          if (errBody.message) msg = errBody.message;
        } catch { /* ignore parse error */ }
        throw new Error(msg);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: ScreenerResponse & { dataSource?: string; poolUpdatedAt?: string } = await res.json();
      setStocks(data.stocks);
      if (data.dataSource) setDataSource(data.dataSource as "fmp" | "mock");
      if (data.poolUpdatedAt) setPoolUpdatedAt(data.poolUpdatedAt);

      // SA strategy: auto-select all stocks and jump to Step 2
      if (isSA && data.stocks.length > 0) {
        setSelectedInStep1(new Set(data.stocks.map(s => s.symbol)));
        setCurrentStep(2);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [strategyId, preset, isSA, getIdToken, firebaseUser]);

  const refreshPool = async () => {
    setRefreshing(true);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/stock-pool", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ force: true }),
      });
      if (res.ok) {
        // Re-run screener with fresh data
        await fetchStocks();
      }
    } catch { /* ignore */ }
    setRefreshing(false);
  };

  useEffect(() => { if (!authLoading && user) fetchStocks(); }, [fetchStocks, authLoading, user]);

  useEffect(() => {
    if (authLoading || !user?.uid) return;
    getIdToken().then(token => {
      fetch(`/api/watchlist?userId=${user.uid}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then(r => r.json())
        .then(d => setWatchlist(new Set(d.watchlist.map((w: any) => w.symbol))))
        .catch(() => {});
    });
  }, [user?.uid, authLoading, getIdToken]);

  const toggleSelection = (step: 1 | 2, symbol: string) => {
    const setter = step === 1 ? setSelectedInStep1 : setSelectedInStep2;
    setter(prev => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  const addToPortfolio = async (symbol: string, role?: string) => {
    if (!user?.uid) return;
    try {
      const token = await getIdToken();
      const payload: any = { symbol };
      if (role && role !== "unassigned") payload.role = role;
      
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setWatchlist(prev => new Set(prev).add(symbol));
      } else {
        console.error("Failed to add to watchlist:", res.status, await res.text());
      }
    } catch (err) {
      console.error("addToPortfolio error:", err);
    }
  };

  if (!preset) return <div className="p-20 text-center">Strategy Not Found</div>;

  const isValue = strategyId === "value";
  const isLarge = strategyId === "large_growth";

  const step1Columns = useMemo(() => {
    if (isValue) return [
      { key: "peRatio", label: t("P/E", "市盈率 (P/E)"), suffix: "x", desc: t("Price to Earnings ratio. A lower value may indicate undervaluation.", "市盈率：公司市值与净利润的比例，较低通常代表估值较便宜。") },
      { key: "pbRatio", label: t("P/B", "市净率 (P/B)"), suffix: "x", desc: t("Price to Book ratio. Useful for valuing asset-heavy companies.", "市净率：公司市值与净资产的比例，常用于评估重资产公司。") },
      { key: "freeCashFlowYield", label: t("FCF Yield", "自由现金流收益率"), suffix: "%", desc: t("Free cash flow per share divided by share price. Shows cash generation efficiency.", "自由现金流收益率：公司每股自由现金流与股价的比例，代表产生真实现金的能力。") },
      { key: "dividendYield", label: t("Div Yield", "股息率"), suffix: "%", desc: t("Annual dividend compared to share price. Shows dividend return.", "股息率：年度分红与股价的比率，体现分红回报水平。") },
    ];
    if (isLarge) return [
      { key: "revenueGrowthYoY", label: t("Rev Growth", "营收增长"), suffix: "%", desc: t("Revenue growth year-over-year. Indicates business expansion.", "营收增长：营业收入同比上一年的增长率，反映业务扩张速度。") },
      { key: "epsGrowthYoY", label: t("EPS Growth", "EPS增长"), suffix: "%", desc: t("Earnings per share growth. Shows profitability growth.", "EPS增长：每股收益同比增长率，反映盈利增长速度。") },
      { key: "freeCashFlowYield", label: t("FCF Yield", "自由现金流收益率"), suffix: "%", desc: t("Free cash flow per share divided by share price. Shows cash generation efficiency.", "自由现金流收益率：公司每股自由现金流与股价的比例，代表产生真实现金的能力。") },
      { key: "roe", label: t("ROE", "净资产收益率"), suffix: "%", desc: t("Return on Equity. Measures profitability relative to shareholder's equity.", "净资产收益率：净利润与股东权益的比率，衡量资本运作效率。") },
    ];
    return [
      { key: "revenueGrowthYoY", label: t("Rev Growth", "营收增长"), suffix: "%", desc: t("Revenue growth year-over-year. Indicates business expansion.", "营收增长：营业收入同比上一年的增长率，反映业务扩张速度。") },
      { key: "epsGrowthYoY", label: t("EPS Growth", "EPS增长"), suffix: "%", desc: t("Earnings per share growth. Shows profitability growth.", "EPS增长：每股收益同比增长率，反映盈利增长速度。") },
      { key: "pegRatio", label: t("PEG", "PEG比率"), suffix: "x", desc: t("P/E ratio divided by growth rate. A lower PEG suggests better value relative to growth.", "PEG比率：市盈率除以盈利增长率，综合考量估值与成长性。") },
      { key: "priceVs50SMA", label: t("vs 50SMA", "相对50日均线"), suffix: "%", desc: t("Price relative to 50-day simple moving average. Positive means upward momentum.", "相对50日均线：当前股价高于过去50天平均价格的百分比，正值代表近期动量向上。") },
    ];
  }, [isValue, isLarge, t]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-200">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900 px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <Gem className="w-5 h-5 text-blue-400" />
            <span className="font-bold">Gems</span>
          </Link>
          <div className="h-5 w-px bg-slate-700" />
          <div className="flex flex-col">
            <h1 className="text-sm font-bold text-white">
              {lang === "en" ? `${preset.name} Funnel` : `${preset.nameZh} 选股漏斗`}
            </h1>
            <p className="text-xs text-slate-500">
              {lang === "en" ? preset.nameZh : preset.name}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
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
      </header>

      <PremiumGate featureName={t("Quantitative Stock Screener", "量化选股系统")}>
        {/* Funnel Progress Bar */}
        <div className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          {[
            { step: 1, icon: Activity, title: isSA ? t("Step 1: Skipped", "第一步：已跳过") : t("Step 1: Quantitative", "第一步：定量筛选"), sub: isSA ? t("SA Direct List", "SA 直选") : isValue ? t("Valuation & FCF", "估值与自由现金流") : t("Growth & Scale", "成长与规模") },
            { step: 2, icon: BrainCircuit, title: t("Step 2: Qualitative", "第二步：定性深研"), sub: isValue ? t("Moat & Catalyst", "护城河与催化剂") : t("TAM & Dominance", "潜在市场与统治力") },
            { step: 3, icon: LineChart, title: t("Step 3: Technical & Final", "第三步：技术与最终决策"), sub: t("Timing & Analysis", "择时与分析") },
          ].map((s, i) => (
            <div key={s.step} className="flex items-center flex-1">
              <div className={`flex items-center gap-3 ${currentStep === s.step ? "opacity-100" : currentStep > s.step || (isSA && s.step === 1) ? "opacity-60" : "opacity-30 grayscale"}`}>
                <div className={`p-2.5 rounded-lg border ${
                  currentStep === s.step 
                    ? `bg-${preset.color}-500/20 border-${preset.color}-500/50 text-${preset.color}-400`
                    : "bg-slate-800 border-slate-700 text-slate-400"
                }`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className={`text-sm font-bold ${currentStep === s.step ? "text-white" : ""}`}>{s.title}</p>
                  <p className="text-xs text-slate-500">{s.sub}</p>
                </div>
              </div>
              {i < 2 && <ChevronRight className="w-5 h-5 mx-auto text-slate-700" />}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 px-6 py-8">
        <div className="max-w-[1400px] mx-auto">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div>
          ) : error ? (
            <div className="flex justify-center py-20 text-red-400"><AlertCircle className="mr-2" />{error}</div>
          ) : (
            <>
              {/* STEP 1: QUANTITATIVE */}
              {currentStep === 1 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {/* Seeking Alpha Custom List Management */}
                  {isSA && (
                    <div className="mb-4 rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-900/10 to-amber-800/5 p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <BookOpen className="w-4.5 h-4.5 text-amber-400" />
                        <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider">
                          {t("Seeking Alpha Custom List", "Seeking Alpha 自选清单")}
                        </h3>
                        <span className="ml-auto text-xs text-slate-500 font-mono">
                          {saSymbols.length} {t("symbols", "只标的")}
                        </span>
                      </div>

                      {/* Current symbols */}
                      {saSymbols.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {saSymbols.map((sym) => (
                            <span
                              key={sym}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-xs font-mono text-slate-300 hover:border-red-500/40 group transition-colors"
                            >
                              {sym}
                              <button
                                onClick={() => removeSASymbol(sym)}
                                className="text-slate-600 hover:text-red-400 transition-colors"
                                title={t("Remove", "移除")}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Add symbols input */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={saInput}
                          onChange={(e) => setSaInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && addSASymbols()}
                          placeholder={t(
                            "Add symbols (e.g. PLTR, DDOG, ZS)",
                            "添加标的（如 PLTR, DDOG, ZS）"
                          )}
                          className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white placeholder:text-slate-600 outline-none focus:border-amber-500/50 transition-colors"
                        />
                        <button
                          onClick={addSASymbols}
                          disabled={saLoading || !saInput.trim()}
                          className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          {saLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                          {t("Add", "添加")}
                        </button>
                      </div>

                      {saSymbols.length === 0 && (
                        <p className="mt-3 text-xs text-slate-500 text-center py-2">
                          {t(
                            "No symbols added yet. Add symbols above to start screening.",
                            "尚未添加标的。在上方输入股票代码开始筛选。"
                          )}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Data source indicator — auto-refreshed daily after market close */}
                  <div className="flex items-center gap-3 mb-4 px-4 py-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
                    {dataSource === "fmp" ? (
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <Cloud className="w-3.5 h-3.5" /> {t("FMP Market Data", "FMP 市场数据")}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-amber-400">
                        <Database className="w-3.5 h-3.5" /> {t("Mock Data", "模拟数据")}
                      </span>
                    )}
                    <span className="text-slate-600">|</span>
                    <span className="text-slate-500">
                      {poolUpdatedAt
                        ? `${t("Updated", "更新于")} ${new Date(poolUpdatedAt).toLocaleString(lang === "en" ? "en-US" : "zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
                        : t("Not updated", "未刷新")}
                    </span>
                    <span className="text-slate-600">|</span>
                    <span className="text-slate-600 italic">
                      {t("Auto-refresh: weekdays 5 PM ET", "自动刷新：交易日收盘后1小时")}
                    </span>
                    <button
                      onClick={refreshPool}
                      disabled={refreshing}
                      title={t("Force refresh data from FMP API", "强制从 FMP API 刷新数据")}
                      className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
                      {refreshing ? t("Refreshing...", "刷新中...") : t("Manual Refresh", "手动刷新")}
                    </button>
                  </div>

                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-white mb-1">{t("Quantitative Pool", "定量股票池")} ({stocks.length} {t("matches", "只符合条件")})</h2>
                      <p className="text-sm text-slate-400">{t("Select candidates that pass the hard financial metrics to advance to deep dive.", "选择通过硬性财务指标筛选的候选股票进入定性深研环节。")}</p>
                    </div>
                    <button
                      disabled={selectedInStep1.size === 0}
                      onClick={() => setCurrentStep(2)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors"
                    >
                      {t("Run Deep Dive", "进行定性深研")} ({selectedInStep1.size}) <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="border border-slate-800 rounded-xl bg-slate-900/50">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-800/80 text-slate-400">
                        <tr>
                          <th className="p-4 w-12 text-center rounded-tl-xl">{t("Select", "选择")}</th>
                          <th className="p-4 font-semibold">{t("Symbol", "代码")}</th>
                          <th className="p-4 font-semibold">{t("Company", "公司")}</th>
                          <th className="p-4 font-semibold">{t("Market Cap", "市值")}</th>
                          {step1Columns.map((c, i) => (
                            <th key={c.key} className={`p-4 font-semibold ${i === step1Columns.length - 1 ? 'rounded-tr-xl' : ''}`}>
                              <div className="flex items-center gap-1.5 group relative">
                                {c.label}
                                {c.desc && (
                                  <>
                                    <HelpCircle className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 cursor-help transition-colors" />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 bg-slate-800 text-slate-200 text-xs rounded-lg shadow-xl border border-slate-700 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 font-normal leading-relaxed text-left whitespace-normal">
                                      {c.desc}
                                    </div>
                                  </>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {stocks.map(s => (
                          <tr key={s.symbol} className={`hover:bg-slate-800/30 transition-colors ${selectedInStep1.has(s.symbol) ? 'bg-blue-900/10' : ''} last:[&>td:first-child]:rounded-bl-xl last:[&>td:last-child]:rounded-br-xl`}>
                            <td className="p-4 text-center">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded border-slate-600 bg-slate-800 accent-blue-500 cursor-pointer"
                                checked={selectedInStep1.has(s.symbol)}
                                onChange={() => toggleSelection(1, s.symbol)}
                              />
                            </td>
                            <td className="p-4 font-bold text-white">{s.symbol}</td>
                            <td className="p-4 text-slate-300">{s.companyName}</td>
                            <td className="p-4 font-mono text-slate-400">{formatMarketCap(s.marketCap)}</td>
                            {step1Columns.map(c => (
                              <td key={c.key} className="p-4 font-mono text-slate-400">
                                {formatNum(s[c.key as keyof StockMetrics] as number, c.suffix)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* STEP 2: QUALITATIVE DEEP DIVE (with SA data reference table) */}
              {currentStep === 2 && (
                <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-white mb-1">
                        {isSA ? t("Seeking Alpha Watchlist", "Seeking Alpha 自选股") : t("Qualitative Deep Dive", "定性深度研究")} ({selectedInStep1.size} {t("stocks", "只股票")})
                      </h2>
                      <p className="text-sm text-slate-400">
                        {isSA 
                          ? t("All SA stocks shown with raw metrics. Select candidates for deep analysis.", "所有 SA 自选股的原始指标一览。选择候选标的进入深度分析。") 
                          : t("Evaluating Moat, TAM, and Pricing Power via AI constraints.", "通过 AI 约束条件评估护城河、潜在市场规模（TAM）和定价权。")}
                      </p>
                    </div>
                    <div className="flex gap-3">
                      {!isSA && (
                        <button onClick={() => setCurrentStep(1)} className="px-4 py-2 border border-slate-700 text-slate-300 hover:bg-slate-800 rounded-lg font-semibold">{t("Back", "上一步")}</button>
                      )}
                      <button
                        disabled={selectedInStep2.size === 0}
                        onClick={() => setCurrentStep(3)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors"
                      >
                        {t("Technical Check", "技术面校验")} ({selectedInStep2.size}) <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* SA Data Reference Table — full metrics overview */}
                  {isSA && (
                    <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                      {/* SA list management */}
                      <div className="mb-4 rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-900/10 to-amber-800/5 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <BookOpen className="w-4 h-4 text-amber-400" />
                          <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider">
                            {t("Manage SA Watchlist", "管理 SA 自选清单")}
                          </h3>
                          <span className="ml-auto text-xs text-slate-500 font-mono">
                            {saSymbols.length} {t("symbols", "只标的")}
                          </span>
                        </div>
                        {saSymbols.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {saSymbols.map((sym) => (
                              <span key={sym} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-xs font-mono text-slate-300 hover:border-red-500/40 transition-colors">
                                {sym}
                                <button onClick={() => removeSASymbol(sym)} className="text-slate-600 hover:text-red-400 transition-colors">
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={saInput}
                            onChange={(e) => setSaInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && addSASymbols()}
                            placeholder={t("Add symbols (e.g. PLTR, DDOG, ZS)", "添加标的（如 PLTR, DDOG, ZS）")}
                            className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white placeholder:text-slate-600 outline-none focus:border-amber-500/50 transition-colors"
                          />
                          <button
                            onClick={addSASymbols}
                            disabled={saLoading || !saInput.trim()}
                            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-semibold flex items-center gap-1.5 transition-colors"
                          >
                            {saLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                            {t("Add", "添加")}
                          </button>
                        </div>
                      </div>

                      {/* Full metrics table */}
                      <div className="border border-slate-800 rounded-xl bg-slate-900/50 overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-slate-800/80 text-slate-400">
                            <tr>
                              <th className="p-3 font-semibold rounded-tl-xl sticky left-0 bg-slate-800/80 z-10">{t("Symbol", "代码")}</th>
                              <th className="p-3 font-semibold">{t("Price", "价格")}</th>
                              <th className="p-3 font-semibold">{t("MCap", "市值")}</th>
                              <th className="p-3 font-semibold">{t("P/E", "P/E")}</th>
                              <th className="p-3 font-semibold">{t("P/B", "P/B")}</th>
                              <th className="p-3 font-semibold">{t("ROE%", "ROE%")}</th>
                              <th className="p-3 font-semibold">{t("RevG%", "营收增长%")}</th>
                              <th className="p-3 font-semibold">{t("EPSG%", "EPS增长%")}</th>
                              <th className="p-3 font-semibold">{t("GM%", "毛利率%")}</th>
                              <th className="p-3 font-semibold">{t("FCF%", "FCF%")}</th>
                              <th className="p-3 font-semibold">{t("D/E", "D/E")}</th>
                              <th className="p-3 font-semibold">{t("vs50SMA", "vs50日线")}</th>
                              <th className="p-3 font-semibold rounded-tr-xl">{t("Sector", "板块")}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50">
                            {stocks.filter(s => selectedInStep1.has(s.symbol)).map(s => (
                              <tr key={s.symbol} className="hover:bg-slate-800/30 transition-colors">
                                <td className="p-3 font-bold text-white sticky left-0 bg-slate-900/90 z-10">
                                  <div>
                                    <span>{s.symbol}</span>
                                    <p className="text-[10px] text-slate-500 font-normal truncate max-w-[100px]">{s.companyName}</p>
                                  </div>
                                </td>
                                <td className="p-3 font-mono text-slate-300">${s.price.toFixed(2)}</td>
                                <td className="p-3 font-mono text-slate-400">{formatMarketCap(s.marketCap)}</td>
                                <td className={`p-3 font-mono ${s.peRatio != null && s.peRatio > 0 && s.peRatio < 25 ? 'text-emerald-400' : 'text-slate-400'}`}>{formatNum(s.peRatio, "x")}</td>
                                <td className="p-3 font-mono text-slate-400">{formatNum(s.pbRatio, "x")}</td>
                                <td className={`p-3 font-mono ${s.roe != null && s.roe > 15 ? 'text-emerald-400' : 'text-slate-400'}`}>{formatNum(s.roe, "%")}</td>
                                <td className={`p-3 font-mono ${s.revenueGrowthYoY != null && s.revenueGrowthYoY > 20 ? 'text-emerald-400' : s.revenueGrowthYoY != null && s.revenueGrowthYoY < 0 ? 'text-red-400' : 'text-slate-400'}`}>{formatNum(s.revenueGrowthYoY, "%")}</td>
                                <td className={`p-3 font-mono ${s.epsGrowthYoY != null && s.epsGrowthYoY > 20 ? 'text-emerald-400' : s.epsGrowthYoY != null && s.epsGrowthYoY < 0 ? 'text-red-400' : 'text-slate-400'}`}>{formatNum(s.epsGrowthYoY, "%")}</td>
                                <td className={`p-3 font-mono ${s.grossMargin != null && s.grossMargin > 50 ? 'text-emerald-400' : 'text-slate-400'}`}>{formatNum(s.grossMargin, "%")}</td>
                                <td className={`p-3 font-mono ${s.freeCashFlowYield != null && s.freeCashFlowYield > 3 ? 'text-emerald-400' : 'text-slate-400'}`}>{formatNum(s.freeCashFlowYield, "%")}</td>
                                <td className="p-3 font-mono text-slate-400">{formatNum(s.debtToEquity, "x")}</td>
                                <td className={`p-3 font-mono ${s.priceVs50SMA != null && s.priceVs50SMA > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatNum(s.priceVs50SMA, "%")}</td>
                                <td className="p-3 text-xs text-slate-500">{s.sector}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {stocks.filter(s => selectedInStep1.has(s.symbol)).map(s => {
                      const isSelected = selectedInStep2.has(s.symbol);
                      const moatScore = (s.symbol.length * 2) % 10 + 6;
                      const tamScore = (s.companyName.length) % 10 + 5;
                      
                      return (
                        <div key={s.symbol} className={`rounded-xl border p-5 transition-all cursor-pointer ${isSelected ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'}`} onClick={() => toggleSelection(2, s.symbol)}>
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                {s.symbol} {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
                              </h3>
                              <p className="text-xs text-slate-400 line-clamp-1">{s.companyName}</p>
                            </div>
                            <span className="text-xs font-mono bg-slate-800 px-2 py-1 rounded text-slate-300">{t(s.sector, s.sector)}</span>
                          </div>
                          
                          <div className="space-y-4 mb-4">
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-400">{t("Moat / Monopoly Power", "护城河 / 垄断能力")}</span>
                                <span className="font-mono text-indigo-400">{moatScore}/10</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${moatScore * 10}%` }}></div>
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-400">{t("TAM Expansion", "潜在市场扩张")}</span>
                                <span className="font-mono text-indigo-400">{tamScore}/10</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${tamScore * 10}%` }}></div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-xs text-slate-500 bg-slate-900 p-3 rounded-lg border border-slate-800">
                            <span className="text-slate-300 font-semibold mb-1 block flex items-center gap-1"><BrainCircuit className="w-3 h-3"/> {t("AI Summary:", "AI 摘要：")}</span>
                            {isValue 
                              ? t("Deep discount to intrinsic value. Management executing buybacks. Turnaround catalyst expected in Q3.", "深度折价，管理层正在执行股票回购，预计第三季度出现困境反转催化剂。")
                              : t("High switching costs. Rapid AI integration driving ARPU expansion. Dominant market share.", "极高的转换成本，AI的快速整合推动单用户平均收入（ARPU）扩张，占据市场主导地位。")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 3: TECHNICAL & FINAL ANALYSIS */}
              {currentStep === 3 && (
                <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-white mb-1">{t("Final Selection & Deep Analysis", "最终选择与深度分析")}</h2>
                      <p className="text-sm text-slate-400">{t("Review comprehensive AI analysis and assign structural roles to your portfolio.", "审阅全面的 AI 分析报告，并为其分配投资组合中的结构性角色。")}</p>
                    </div>
                    <button onClick={() => setCurrentStep(2)} className="px-4 py-2 border border-slate-700 text-slate-300 hover:bg-slate-800 rounded-lg font-semibold">{t("Back to Qual", "返回定性研究")}</button>
                  </div>

                  <div className="space-y-4">
                    {stocks.filter(s => selectedInStep2.has(s.symbol)).map(s => {
                      const momentum = s.priceVs50SMA || 0;
                      const isUp = momentum > 0;
                      const saved = watchlist.has(s.symbol);

                      return (
                        <div key={s.symbol} className="flex items-center justify-between p-5 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800/80 transition-colors">
                          <div className="flex items-center gap-6 w-1/3">
                            <div>
                              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                {s.symbol}
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${isUp ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                  {isUp ? t('Bull Trend', '多头趋势') : t('Bear Trend', '空头趋势')}
                                </span>
                              </h3>
                              <p className="text-xs text-slate-400">{s.companyName}</p>
                            </div>
                          </div>

                          <div className="flex gap-3 w-1/4">
                            <button
                              onClick={() => openAnalysis(s)}
                              className="px-3 py-1.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" /> {t("Read Report", "查看报告")}
                            </button>
                          </div>

                          <div className="flex items-center gap-4 w-[40%] justify-end">
                            <select 
                              className="bg-slate-950 border border-slate-700 text-sm text-slate-300 rounded-lg px-3 py-2 outline-none focus:border-purple-500"
                              value={selectedRoles[s.symbol] || "unassigned"}
                              onChange={(e) => setSelectedRoles(prev => ({ ...prev, [s.symbol]: e.target.value }))}
                            >
                              <option value="unassigned">{t("-- Select Role --", "-- 选择角色 --")}</option>
                              {isValue ? (
                                <>
                                  <option value="core_dividend">{t("💰 Core Dividend", "💰 核心收息")}</option>
                                  <option value="turnaround">{t("🔄 Turnaround Play", "🔄 困境反转")}</option>
                                  <option value="special_situation">{t("✂️ Special Situation", "✂️ 特殊情况")}</option>
                                </>
                              ) : (
                                <>
                                  <option value="anchor">{t("🛡️ Anchor (Stability)", "🛡️ 压舱石 (稳健)")}</option>
                                  <option value="striker">{t("⚔️ Striker (Core Growth)", "⚔️ 攻击手 (核心成长)")}</option>
                                  <option value="rocket">{t("🚀 Rocket (High Beta)", "🚀 火箭 (高Beta)")}</option>
                                </>
                              )}
                            </select>
                            
                            <button
                              onClick={() => addToPortfolio(s.symbol, selectedRoles[s.symbol])}
                              disabled={saved}
                              className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all min-w-[100px] justify-center ${
                                saved 
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                  : "bg-white text-black hover:bg-slate-200"
                              }`}
                            >
                              {saved ? <><CheckCircle2 className="w-4 h-4"/> {t("Added", "已添加")}</> : <><Star className="w-4 h-4"/> {t("Add", "添加")}</>}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {watchlist.size > 0 && (
                    <div className="mt-8 flex justify-center">
                      <Link href="/watchlist" className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl font-bold shadow-lg shadow-purple-500/20 transition-all hover:scale-105 flex items-center gap-2">
                        {t("View Portfolio Dashboard", "查看投资组合面板")} <ChevronRight className="w-5 h-5" />
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* AI Deep Analysis Slide-out Panel */}
      {analyzingStock && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAnalyzingStock(null)} />
          <div className="relative w-full max-w-2xl h-full bg-slate-900 border-l border-slate-800 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300">
            {/* Panel Header */}
            <div className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-8 py-6 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-3xl font-bold text-white">{analyzingStock.symbol}</h2>
                  <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs font-mono border border-slate-700">{analyzingStock.sector}</span>
                </div>
                <p className="text-slate-400">{analyzingStock.companyName}</p>
              </div>
              <div className="flex items-center gap-2">
                {analysisReport && (
                  <button
                    onClick={async () => {
                      if (shareCardUrl && analyzingStock) {
                        const { downloadShareCard } = await import("@/lib/share-card");
                        downloadShareCard(shareCardUrl, analyzingStock.symbol);
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
                <button onClick={() => setAnalyzingStock(null)} className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Panel Content */}
            <div className="px-8 py-6 space-y-8 pb-20">
              {analysisLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-4" />
                  <p className="text-slate-400 text-sm">{t("Generating investment analysis...", "正在生成投资分析报告...")}</p>
                </div>
              ) : analysisReport ? (
                <>
                  {/* Analyst Pricing & Targets */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-blue-900/30 to-indigo-900/30 border border-blue-500/20 rounded-xl p-5">
                      <div className="flex items-center gap-2 text-blue-400 mb-1">
                        <Target className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">{t("Price Target", "目标价")}</span>
                      </div>
                      <div className="flex items-baseline gap-3">
                        <span className="text-3xl font-bold text-white">{analysisReport.analyst.targetPrice}</span>
                        <span className="text-sm font-semibold text-emerald-400">{analysisReport.analyst.upside}</span>
                      </div>
                    </div>
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Users className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">{t("Consensus", "市场共识")}</span>
                      </div>
                      <div className="text-xl font-bold text-emerald-400 mb-1">{t(analysisReport.analyst.consensus, analysisReport.analyst.consensus)}</div>
                      <div className="text-xs text-slate-500 flex gap-2">
                        <span>{t("Buy", "买入")}: {analysisReport.analyst.breakdown.buy}</span>
                        <span>{t("Hold", "持有")}: {analysisReport.analyst.breakdown.hold}</span>
                        <span>{t("Sell", "卖出")}: {analysisReport.analyst.breakdown.sell}</span>
                      </div>
                    </div>
                  </div>

                  {/* Overview */}
                  <section>
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400" /> {t("Company Overview", "公司概况")}
                    </h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{analysisReport.overview}</p>
                  </section>

                  {/* Fundamentals */}
                  <section>
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" /> {t("Fundamentals", "基本面")}
                    </h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{analysisReport.fundamentals}</p>
                  </section>

                  {/* Products & Services */}
                  <section>
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-purple-400" /> {t("Products & Services", "产品与服务")}
                    </h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{analysisReport.products}</p>
                  </section>

                  <div className="grid md:grid-cols-2 gap-6 pt-4">
                    {/* Rationale */}
                    <section className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-5">
                      <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Zap className="w-4 h-4" /> {t("Why We Like It", "看多理由")}
                      </h3>
                      <ul className="space-y-2 text-sm text-slate-400">
                        {analysisReport.rationale.map((line, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-emerald-500 mt-0.5">•</span>
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
                        {analysisReport.risks.map((line, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-red-500 mt-0.5">•</span>
                            <span className="leading-relaxed">{line}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
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
                          if (shareCardUrl && analyzingStock) {
                            const { downloadShareCard } = await import("@/lib/share-card");
                            downloadShareCard(shareCardUrl, analyzingStock.symbol);
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
      </PremiumGate>

    </div>
  );
}
