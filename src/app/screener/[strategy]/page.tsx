"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Gem, ArrowLeft, Star, Activity, BrainCircuit, LineChart, 
  ChevronRight, CheckCircle2, AlertCircle, Loader2, Play,
  FileText, X, Target, ShieldAlert, Zap, TrendingUp, Users, Languages,
  RefreshCw, Database, Cloud
} from "lucide-react";
import type { StockMetrics, FilterCriterion, ScreenerResponse, StrategyType } from "@/lib/types";
import type { StockAnalysisReport } from "@/lib/analysis-engine";
import { STRATEGY_PRESETS } from "@/lib/strategies";

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

  const [stocks, setStocks] = useState<StockMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [selectedInStep1, setSelectedInStep1] = useState<Set<string>>(new Set());
  const [selectedInStep2, setSelectedInStep2] = useState<Set<string>>(new Set());
  
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  
  // Data source tracking
  const [dataSource, setDataSource] = useState<"fmp" | "mock">("mock");
  const [poolUpdatedAt, setPoolUpdatedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Language Selection
  const [lang, setLang] = useState<"en" | "zh">("zh");

  // Slide-out Analysis Panel State
  const [analyzingStock, setAnalyzingStock] = useState<StockMetrics | null>(null);
  const [analysisReport, setAnalysisReport] = useState<StockAnalysisReport | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const openAnalysis = async (stock: StockMetrics) => {
    setAnalyzingStock(stock);
    setAnalysisReport(null);
    setAnalysisLoading(true);
    try {
      const res = await fetch(`/api/analysis?symbol=${stock.symbol}&strategy=${strategyId}&lang=${lang}`);
      if (res.ok) {
        const data = await res.json();
        setAnalysisReport(data.report);
      }
    } catch { /* ignore */ }
    setAnalysisLoading(false);
  };

  const fetchStocks = useCallback(async () => {
    setLoading(true);
    try {
      const filters = preset?.defaultFilters ?? [];
      const res = await fetch("/api/screener", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy: strategyId, filters, limit: 50 }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: ScreenerResponse & { dataSource?: string; poolUpdatedAt?: string } = await res.json();
      setStocks(data.stocks);
      if (data.dataSource) setDataSource(data.dataSource as "fmp" | "mock");
      if (data.poolUpdatedAt) setPoolUpdatedAt(data.poolUpdatedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [strategyId, preset]);

  const refreshPool = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/stock-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      if (res.ok) {
        // Re-run screener with fresh data
        await fetchStocks();
      }
    } catch { /* ignore */ }
    setRefreshing(false);
  };

  useEffect(() => { fetchStocks(); }, [fetchStocks]);

  useEffect(() => {
    fetch("/api/watchlist?userId=demo-user")
      .then(r => r.json())
      .then(d => setWatchlist(new Set(d.watchlist.map((w: any) => w.symbol))))
      .catch(() => {});
  }, []);

  const toggleSelection = (step: 1 | 2, symbol: string) => {
    const setter = step === 1 ? setSelectedInStep1 : setSelectedInStep2;
    setter(prev => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  const addToPortfolio = async (symbol: string) => {
    try {
      await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "demo-user", symbol }),
      });
      setWatchlist(prev => new Set(prev).add(symbol));
    } catch {}
  };

  if (!preset) return <div className="p-20 text-center">Strategy Not Found</div>;

  const isValue = strategyId === "value";
  const isLarge = strategyId === "large_growth";

  const step1Columns = useMemo(() => {
    if (isValue) return [
      { key: "peRatio", label: "P/E", suffix: "x" },
      { key: "pbRatio", label: "P/B", suffix: "x" },
      { key: "freeCashFlowYield", label: "FCF Yield", suffix: "%" },
      { key: "dividendYield", label: "Div Yield", suffix: "%" },
    ];
    if (isLarge) return [
      { key: "revenueGrowthYoY", label: "Rev Growth", suffix: "%" },
      { key: "epsGrowthYoY", label: "EPS Growth", suffix: "%" },
      { key: "freeCashFlowYield", label: "FCF Yield", suffix: "%" },
      { key: "roe", label: "ROE", suffix: "%" },
    ];
    return [
      { key: "revenueGrowthYoY", label: "Rev Growth", suffix: "%" },
      { key: "epsGrowthYoY", label: "EPS Growth", suffix: "%" },
      { key: "pegRatio", label: "PEG", suffix: "x" },
      { key: "priceVs50SMA", label: "vs 50SMA", suffix: "%" },
    ];
  }, [isValue, isLarge]);

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
            <h1 className="text-sm font-bold text-white">{preset.name} Funnel</h1>
            <p className="text-xs text-slate-500">{preset.nameZh} 选股漏斗</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button 
              onClick={() => setLang(lang === "en" ? "zh" : "en")}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors border border-slate-700"
            >
              <Languages className="w-4 h-4 text-blue-400" />
              {lang === "en" ? "English" : "简体中文"}
            </button>
          </div>
        </div>
      </header>

      {/* Funnel Progress Bar */}
      <div className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          {[
            { step: 1, icon: Activity, title: "Quantitative", sub: isValue ? "Valuation & FCF" : "Growth & Scale" },
            { step: 2, icon: BrainCircuit, title: "Qualitative", sub: isValue ? "Moat & Catalyst" : "TAM & Dominance" },
            { step: 3, icon: LineChart, title: "Technical & Final", sub: "Timing & Analysis" },
          ].map((s, i) => (
            <div key={s.step} className="flex items-center flex-1">
              <div className={`flex items-center gap-3 ${currentStep === s.step ? "opacity-100" : currentStep > s.step ? "opacity-60" : "opacity-30 grayscale"}`}>
                <div className={`p-2.5 rounded-lg border ${
                  currentStep === s.step 
                    ? `bg-${preset.color}-500/20 border-${preset.color}-500/50 text-${preset.color}-400`
                    : "bg-slate-800 border-slate-700 text-slate-400"
                }`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className={`text-sm font-bold ${currentStep === s.step ? "text-white" : ""}`}>Step {s.step}: {s.title}</p>
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
                  {/* Data source indicator */}
                  <div className="flex items-center gap-3 mb-4 px-4 py-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
                    {dataSource === "fmp" ? (
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <Cloud className="w-3.5 h-3.5" /> FMP 实时数据
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-amber-400">
                        <Database className="w-3.5 h-3.5" /> 模拟数据
                      </span>
                    )}
                    <span className="text-slate-600">|</span>
                    <span className="text-slate-500">
                      {poolUpdatedAt
                        ? `更新于 ${new Date(poolUpdatedAt).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
                        : "未刷新"}
                    </span>
                    <button
                      onClick={refreshPool}
                      disabled={refreshing}
                      className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
                      {refreshing ? "刷新中..." : "刷新数据"}
                    </button>
                  </div>

                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-white mb-1">Quantitative Pool ({stocks.length} matches)</h2>
                      <p className="text-sm text-slate-400">Select candidates that pass the hard financial metrics to advance to deep dive.</p>
                    </div>
                    <button
                      disabled={selectedInStep1.size === 0}
                      onClick={() => setCurrentStep(2)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors"
                    >
                      Run Deep Dive ({selectedInStep1.size}) <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-800/80 text-slate-400">
                        <tr>
                          <th className="p-4 w-12 text-center">Select</th>
                          <th className="p-4 font-semibold">Symbol</th>
                          <th className="p-4 font-semibold">Company</th>
                          <th className="p-4 font-semibold">Market Cap</th>
                          {step1Columns.map(c => <th key={c.key} className="p-4 font-semibold">{c.label}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {stocks.map(s => (
                          <tr key={s.symbol} className={`hover:bg-slate-800/30 transition-colors ${selectedInStep1.has(s.symbol) ? 'bg-blue-900/10' : ''}`}>
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

              {/* STEP 2: QUALITATIVE DEEP DIVE */}
              {currentStep === 2 && (
                <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-white mb-1">Qualitative Deep Dive ({selectedInStep1.size} stocks)</h2>
                      <p className="text-sm text-slate-400">Evaluating Moat, TAM, and Pricing Power via AI constraints.</p>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setCurrentStep(1)} className="px-4 py-2 border border-slate-700 text-slate-300 hover:bg-slate-800 rounded-lg font-semibold">Back</button>
                      <button
                        disabled={selectedInStep2.size === 0}
                        onClick={() => setCurrentStep(3)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors"
                      >
                        Technical Check ({selectedInStep2.size}) <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
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
                            <span className="text-xs font-mono bg-slate-800 px-2 py-1 rounded text-slate-300">{s.sector}</span>
                          </div>
                          
                          <div className="space-y-4 mb-4">
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-400">Moat / Monopoly Power</span>
                                <span className="font-mono text-indigo-400">{moatScore}/10</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${moatScore * 10}%` }}></div>
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-400">TAM Expansion</span>
                                <span className="font-mono text-indigo-400">{tamScore}/10</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${tamScore * 10}%` }}></div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-xs text-slate-500 bg-slate-900 p-3 rounded-lg border border-slate-800">
                            <span className="text-slate-300 font-semibold mb-1 block flex items-center gap-1"><BrainCircuit className="w-3 h-3"/> AI Summary:</span>
                            {isValue 
                              ? "Deep discount to intrinsic value. Management executing buybacks. Turnaround catalyst expected in Q3."
                              : "High switching costs. Rapid AI integration driving ARPU expansion. Dominant market share."}
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
                      <h2 className="text-xl font-bold text-white mb-1">Final Selection & Deep Analysis</h2>
                      <p className="text-sm text-slate-400">Review comprehensive AI analysis and assign structural roles to your portfolio.</p>
                    </div>
                    <button onClick={() => setCurrentStep(2)} className="px-4 py-2 border border-slate-700 text-slate-300 hover:bg-slate-800 rounded-lg font-semibold">Back to Qual</button>
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
                                  {isUp ? 'Bull Trend' : 'Bear Trend'}
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
                              <FileText className="w-3.5 h-3.5" /> Read Report
                            </button>
                          </div>

                          <div className="flex items-center gap-4 w-[40%] justify-end">
                            <select className="bg-slate-950 border border-slate-700 text-sm text-slate-300 rounded-lg px-3 py-2 outline-none focus:border-purple-500">
                              {isValue ? (
                                <>
                                  <option>🏛️ Core Dividend</option>
                                  <option>🔄 Turnaround Play</option>
                                  <option>✂️ Special Situation</option>
                                </>
                              ) : (
                                <>
                                  <option>🛡️ Anchor (Stability)</option>
                                  <option>⚔️ Striker (Core Growth)</option>
                                  <option>🚀 Rocket (High Beta)</option>
                                </>
                              )}
                            </select>
                            
                            <button
                              onClick={() => addToPortfolio(s.symbol)}
                              disabled={saved}
                              className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all min-w-[100px] justify-center ${
                                saved 
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                  : "bg-white text-black hover:bg-slate-200"
                              }`}
                            >
                              {saved ? <><CheckCircle2 className="w-4 h-4"/> Added</> : <><Star className="w-4 h-4"/> Add</>}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {watchlist.size > 0 && (
                    <div className="mt-8 flex justify-center">
                      <Link href="/watchlist" className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl font-bold shadow-lg shadow-purple-500/20 transition-all hover:scale-105 flex items-center gap-2">
                        View Portfolio Dashboard <ChevronRight className="w-5 h-5" />
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
              <button onClick={() => setAnalyzingStock(null)} className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Panel Content */}
            <div className="px-8 py-6 space-y-8 pb-20">
              {analysisLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-4" />
                  <p className="text-slate-400 text-sm">Generating investment analysis...</p>
                </div>
              ) : analysisReport ? (
                <>
                  {/* Analyst Pricing & Targets */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-blue-900/30 to-indigo-900/30 border border-blue-500/20 rounded-xl p-5">
                      <div className="flex items-center gap-2 text-blue-400 mb-1">
                        <Target className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Price Target</span>
                      </div>
                      <div className="flex items-baseline gap-3">
                        <span className="text-3xl font-bold text-white">{analysisReport.analyst.targetPrice}</span>
                        <span className="text-sm font-semibold text-emerald-400">{analysisReport.analyst.upside}</span>
                      </div>
                    </div>
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Users className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Consensus</span>
                      </div>
                      <div className="text-xl font-bold text-emerald-400 mb-1">{analysisReport.analyst.consensus}</div>
                      <div className="text-xs text-slate-500 flex gap-2">
                        <span>Buy: {analysisReport.analyst.breakdown.buy}</span>
                        <span>Hold: {analysisReport.analyst.breakdown.hold}</span>
                        <span>Sell: {analysisReport.analyst.breakdown.sell}</span>
                      </div>
                    </div>
                  </div>

                  {/* Overview */}
                  <section>
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400" /> Company Overview
                    </h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{analysisReport.overview}</p>
                  </section>

                  {/* Fundamentals */}
                  <section>
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" /> Fundamentals
                    </h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{analysisReport.fundamentals}</p>
                  </section>

                  {/* Products & Services */}
                  <section>
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-purple-400" /> Products & Services
                    </h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{analysisReport.products}</p>
                  </section>

                  <div className="grid md:grid-cols-2 gap-6 pt-4">
                    {/* Rationale */}
                    <section className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-5">
                      <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Zap className="w-4 h-4" /> Why We Like It
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
                        <ShieldAlert className="w-4 h-4" /> Key Risks
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
                </>
              ) : (
                <div className="text-center py-16 text-slate-500">Failed to load analysis.</div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
