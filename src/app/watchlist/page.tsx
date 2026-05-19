"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Gem, ArrowLeft, StarOff, Trash2, Shield, Sword, Rocket, CircleDollarSign, RefreshCcw, AlertTriangle, HelpCircle, ChevronDown, Languages, X, Loader2, FileText, CheckCircle2, Target } from "lucide-react";
import type { WatchlistItem } from "@/lib/types";
import type { StockAnalysisReport } from "@/lib/analysis-engine";
import { useLanguage } from "@/lib/language-context";

type RoleKey = "anchor" | "striker" | "rocket" | "core_dividend" | "turnaround" | "special_situation" | "unassigned";

export default function WatchlistPage() {
  const { lang, setLang, t } = useLanguage();

  const getRoleConfigs = () => ({
    anchor: { icon: Shield, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", label: t("Anchor (Stability)", "压舱石 (稳健)"), desc: t("Low volatility, strong cash flow", "低波动，强现金流") },
    striker: { icon: Sword, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", label: t("Striker (Core Growth)", "攻击手 (核心成长)"), desc: t("High conviction, steady compounding", "高信念，稳健复利") },
    rocket: { icon: Rocket, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", label: t("Rocket (High Beta)", "火箭 (高Beta)"), desc: t("High risk/reward, hyper-growth", "高风险高回报，超高速成长") },
    core_dividend: { icon: CircleDollarSign, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", label: t("Core Dividend", "核心收息"), desc: t("Value: Reliable yield", "价值：可靠收益率") },
    turnaround: { icon: RefreshCcw, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20", label: t("Turnaround", "困境反转"), desc: t("Value: Cyclical reversion", "价值：周期均值回归") },
    special_situation: { icon: AlertTriangle, color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20", label: t("Special Sit.", "特殊情况"), desc: t("Value: Event-driven", "价值：事件驱动") },
    unassigned: { icon: HelpCircle, color: "text-slate-400", bg: "bg-slate-800", border: "border-slate-700", label: t("Unassigned", "未分配"), desc: t("Needs allocation", "需要分配角色") }
  });

  const ROLE_CONFIGS = getRoleConfigs();

  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [reportData, setReportData] = useState<StockAnalysisReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const fetchWatchlist = async () => {
    try {
      const res = await fetch("/api/watchlist?userId=demo-user");
      if (res.ok) {
        const data = await res.json();
        setWatchlist(data.watchlist);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  const removeItem = async (symbol: string) => {
    try {
      await fetch("/api/watchlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "demo-user", symbol }),
      });
      setWatchlist((prev) => prev.filter((w) => w.symbol !== symbol));
    } catch { /* ignore */ }
  };

  const updateRole = async (symbol: string, newRole: RoleKey) => {
    const roleToSend = newRole === "unassigned" ? undefined : newRole;
    try {
      // Optimistic UI update
      setWatchlist(prev => prev.map(item => 
        item.symbol === symbol ? { ...item, role: roleToSend } : item
      ));

      await fetch("/api/watchlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "demo-user", symbol, role: roleToSend }),
      });
    } catch { 
      // Revert on failure by refetching
      fetchWatchlist();
    }
  };

  const viewReport = async (item: WatchlistItem) => {
    setSelectedReport(item.symbol);
    setReportLoading(true);
    setReportData(null);
    try {
      // Find strategy from role if possible, fallback to large_growth
      let strategy = "large_growth";
      if (item.role) {
        if (["core_dividend", "turnaround", "special_situation"].includes(item.role)) {
          strategy = "value";
        } else if (item.role === "rocket") {
          strategy = "small_growth";
        }
      }
      
      const res = await fetch(`/api/analysis?symbol=${item.symbol}&strategy=${strategy}&lang=${lang}`);
      if (res.ok) {
        const data = await res.json();
        setReportData(data.report);
      }
    } catch { /* ignore */ }
    setReportLoading(false);
  };

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

  const renderStockCard = (item: WatchlistItem) => (
    <div key={item.symbol} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex flex-col gap-3 hover:bg-slate-800 transition-colors group relative">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-bold text-white">{item.symbol}</h3>
          <p className="text-xs text-slate-500 mt-1">{t("Added", "添加于")} {new Date(item.addedAt).toLocaleDateString()}</p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => viewReport(item)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
            title={t("View Full Analysis", "查看完整报告")}
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            onClick={() => removeItem(item.symbol)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title={t("Remove from portfolio", "从投资组合中移除")}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative mt-2">
        <select
          value={item.role || "unassigned"}
          onChange={(e) => updateRole(item.symbol, e.target.value as RoleKey)}
          className="w-full appearance-none bg-slate-900 border border-slate-700 text-sm text-slate-300 rounded-lg px-3 py-2 pr-8 outline-none focus:border-blue-500 transition-colors"
        >
          <option value="unassigned">{t("-- Select Role --", "-- 选择角色 --")}</option>
          <optgroup label={t("Growth & Scale", "成长与扩张")}>
            <option value="anchor">{t("Anchor (Stability)", "压舱石 (稳健)")}</option>
            <option value="striker">{t("Striker (Core Growth)", "攻击手 (核心成长)")}</option>
            <option value="rocket">{t("Rocket (High Beta)", "火箭 (高Beta)")}</option>
          </optgroup>
          <optgroup label={t("Value & Income", "价值与收益")}>
            <option value="core_dividend">{t("Core Dividend", "核心收息")}</option>
            <option value="turnaround">{t("Turnaround", "困境反转")}</option>
            <option value="special_situation">{t("Special Situation", "特殊情况")}</option>
          </optgroup>
        </select>
        <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-2.5 pointer-events-none" />
      </div>
    </div>
  );

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
      <header className="border-b border-slate-800 px-6 py-4 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <Gem className="w-5 h-5 text-blue-400" />
              <span className="font-bold text-white">Gems</span>
            </Link>
            <div className="h-5 w-px bg-slate-700" />
            <h1 className="text-sm font-semibold">{t("Portfolio Dashboard", "投资组合面板")}</h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-sm text-slate-400">
              {t("Total Conviction Picks:", "总计高信念优选：")} <span className="text-white font-bold">{watchlist.length}</span> / 10
            </div>
            <div className="h-5 w-px bg-slate-700" />
            <button 
              onClick={() => setLang(lang === "en" ? "zh" : "en")}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors border border-slate-700"
            >
              <Languages className="w-4 h-4 text-blue-400" />
              {lang === "en" ? "中文" : "English"}
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 px-6 py-8 overflow-x-auto">
        <div className="max-w-7xl mx-auto min-w-[1000px]">
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
            <div className="space-y-8">
              
              {/* Unassigned Pool */}
              {(grouped["unassigned"]?.length > 0) && (
                <div className="mb-8">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4" /> {t("Needs Allocation", "待分配")} ({grouped["unassigned"].length})
                  </h3>
                  <div className="grid grid-cols-4 gap-4">
                    {grouped["unassigned"].map(renderStockCard)}
                  </div>
                </div>
              )}

              {/* Growth Formation */}
              <div>
                <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-4">{t("Growth & Scale Formation", "成长与扩张阵型")}</h3>
                <div className="grid grid-cols-3 gap-6">
                  {growthRoles.map(renderColumn)}
                </div>
              </div>

              <div className="h-px bg-slate-800 my-8" />

              {/* Value Formation */}
              <div>
                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-widest mb-4">{t("Value & Income Formation", "价值与收益阵型")}</h3>
                <div className="grid grid-cols-3 gap-6">
                  {valueRoles.map(renderColumn)}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Report Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedReport} {t("Analysis Report", "分析报告")}</h2>
                </div>
              </div>
              <button onClick={() => setSelectedReport(null)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              {reportLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-500" />
                  <p>{t("Generating complete analysis...", "正在生成完整分析报告...")}</p>
                </div>
              ) : reportData ? (
                <div className="space-y-6">
                  {/* Consensus & Target */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                      <div className="text-sm text-slate-400 mb-1">{t("Analyst Consensus", "市场共识")}</div>
                      <div className={`text-xl font-bold ${reportData.analyst.consensus.includes("Buy") ? "text-emerald-400" : reportData.analyst.consensus.includes("Sell") ? "text-red-400" : "text-amber-400"}`}>
                        {reportData.analyst.consensus}
                      </div>
                      <div className="text-xs text-slate-500 mt-2 flex gap-3">
                        <span className="text-emerald-400/80">{reportData.analyst.breakdown.buy} {t("Buy", "买入")}</span>
                        <span className="text-amber-400/80">{reportData.analyst.breakdown.hold} {t("Hold", "持有")}</span>
                        <span className="text-red-400/80">{reportData.analyst.breakdown.sell} {t("Sell", "卖出")}</span>
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                      <div className="text-sm text-slate-400 mb-1">{t("Target Price (12m)", "12个月目标价")}</div>
                      <div className="text-xl font-bold text-white">{reportData.analyst.targetPrice}</div>
                      <div className={`text-sm mt-1 ${reportData.analyst.upside.startsWith("+") ? "text-emerald-400" : "text-red-400"}`}>
                        {reportData.analyst.upside} {t("Upside", "上涨空间")}
                      </div>
                    </div>
                  </div>

                  {/* Position Suggestion */}
                  {reportData.positionSuggestion && (
                    <div>
                      <h3 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-2">
                        <Target className="w-4 h-4 text-blue-400" /> {t("Position Suggestion", "持仓建议")}
                      </h3>
                      <div className="p-4 bg-blue-900/10 border border-blue-500/20 rounded-xl text-blue-200 text-sm leading-relaxed">
                        {reportData.positionSuggestion}
                      </div>
                    </div>
                  )}

                  {/* Basic Info */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-300 mb-2">{t("Overview", "业务概览")}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed bg-slate-800/30 p-4 rounded-xl border border-slate-800">{reportData.overview}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-300 mb-2">{t("Fundamentals", "基本面分析")}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed bg-slate-800/30 p-4 rounded-xl border border-slate-800">{reportData.fundamentals}</p>
                  </div>

                  {/* Bullish & Risks */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-bold text-emerald-400 mb-3 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> {t("Bullish Rationale", "看多理由")}
                      </h3>
                      <ul className="space-y-3">
                        {reportData.rationale.map((r, i) => (
                          <li key={i} className="text-sm text-slate-400 flex gap-2">
                            <span className="text-emerald-500 mt-0.5">•</span>
                            <span className="leading-relaxed">{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-red-400 mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> {t("Key Risks", "核心风险")}
                      </h3>
                      <ul className="space-y-3">
                        {reportData.risks.map((r, i) => (
                          <li key={i} className="text-sm text-slate-400 flex gap-2">
                            <span className="text-red-500 mt-0.5">•</span>
                            <span className="leading-relaxed">{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <AlertTriangle className="w-10 h-10 text-amber-500 mb-4" />
                  <p className="text-slate-300">{t("Failed to load report", "无法加载分析报告")}</p>
                  <p className="text-sm text-slate-500 mt-2">{t("Please try again later.", "请稍后再试。")}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
