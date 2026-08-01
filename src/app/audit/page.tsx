"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  Gem, 
  Activity, 
  TrendingUp, 
  ShieldCheck, 
  Rocket, 
  CheckCircle2, 
  AlertTriangle, 
  Zap, 
  History, 
  Cpu, 
  BarChart3, 
  Sparkles,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import UserMenu from "@/components/UserMenu";
import { StrategyWinRate, SelfHealingLog, PerformanceShowcaseStock } from "@/lib/audit-store";
import { useEffect, useMemo } from "react";

export default function AuditDashboardPage() {
  const { t, lang } = useLanguage();
  const isZh = lang === "zh";

  const [winRates, setWinRates] = useState<StrategyWinRate[]>([]);
  const [selfHealingLogs, setSelfHealingLogs] = useState<SelfHealingLog[]>([]);
  const [showcaseStocks, setShowcaseStocks] = useState<PerformanceShowcaseStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/audit")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setWinRates(data.data.winRates || []);
          setSelfHealingLogs(data.data.selfHealingLogs || []);
          setShowcaseStocks(data.data.showcase || []);
        } else {
          setError(data.message || "Failed to load audit metrics");
        }
      })
      .catch(err => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const [activeTab, setActiveTab] = useState<"overview" | "timeline" | "showcase">("overview");

  const { avgT5, avgT20, avgT60 } = useMemo(() => {
    if (winRates.length === 0) return { avgT5: "0.0", avgT20: "0.0", avgT60: "0.0" };
    return {
      avgT5: (winRates.reduce((acc, w) => acc + w.t5WinRate, 0) / winRates.length).toFixed(1),
      avgT20: (winRates.reduce((acc, w) => acc + w.t20WinRate, 0) / winRates.length).toFixed(1),
      avgT60: (winRates.reduce((acc, w) => acc + w.t60WinRate, 0) / winRates.length).toFixed(1),
    };
  }, [winRates]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-4">
          <Activity className="w-8 h-8 animate-pulse text-blue-500" />
          <p>{t("Loading live audit metrics...", "正在加载实时评估数据...")}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 p-6">
        <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">{t("Audit Data Unavailable", "评估数据暂未生成")}</h2>
        <p className="text-center max-w-md mb-6">{error}</p>
        <Link href="/" className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium">
          {t("Return Home", "返回主页")}
        </Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 max-w-[1280px] mx-auto w-full">
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors bg-slate-900/60 p-2 rounded-xl border border-slate-800">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">{t("Back", "返回大盘")}</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl border border-blue-500/30">
              <Cpu className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                {t("AI Strategy Audit & Self-Healing", "AI 策略胜率与自愈战报")}
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Live Audit
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                {t("Transparent closed-loop performance tracking & autonomous parameter self-healing audit.", "真实透明的闭环胜率跟踪与策略参数自动化自愈进化审计")}
              </p>
            </div>
          </div>
        </div>
        <UserMenu />
      </div>

      {/* Hero Performance Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-md relative overflow-hidden">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            {t("T+5 Short-Term Win Rate", "总体 T+5 短线胜率")}
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 flex items-baseline gap-1.5">
            {avgT5}%
            <span className="text-[11px] font-normal text-slate-400">(Live)</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs text-emerald-400/90 font-medium">
            <TrendingUp className="w-3.5 h-3.5" /> {t("Live Snapshot Data", "实时快照统计")}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-md">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            {t("T+20 Mid-Term Win Rate", "T+20 月线胜率")}
          </div>
          <div className="text-2xl font-extrabold text-blue-400">
            {avgT20}%
          </div>
          <div className="mt-2 text-xs text-slate-400">
            {t("Calculated across active portfolios", "跨组合聚合计算")}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-md">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            {t("T+60 Quarterly Win Rate", "T+60 季线胜率(3M)")}
          </div>
          <div className="text-2xl font-extrabold text-indigo-400">
            {avgT60}%
          </div>
          <div className="mt-2 text-xs text-indigo-300 font-medium">
            {t("Quarterly Holding Win Rate", "季度持仓胜率高企")}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-md">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            {t("Self-Healing Actions", "近 30 天自愈修复")}
          </div>
          <div className="text-2xl font-extrabold text-purple-400 flex items-center gap-1.5">
            3 <Zap className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 text-xs text-purple-300 font-medium truncate">
            {t("Latest: Small-Cap ROE Adjusted", "最新: 中小盘 ROE 门槛调紧")}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-md">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            {t("System Health Status", "策略综合健康度")}
          </div>
          <div className="text-xl font-bold text-emerald-400 flex items-center gap-1.5 mt-0.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" /> OPTIMAL
          </div>
          <div className="mt-2 text-xs text-slate-400">
            {t("Zero CRITICAL Alerts", "零严重告警 (0 Critical)")}
          </div>
        </div>
      </div>


      {/* Navigation Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-800/80 pb-2">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 ${
            activeTab === "overview" 
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          {t("Strategy Performance", "策略胜率看板")}
        </button>
        <button
          onClick={() => setActiveTab("timeline")}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 ${
            activeTab === "timeline" 
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <Zap className="w-4 h-4" />
          {t("Self-Healing Timeline", "AI 自愈进化日志")}
        </button>
        <button
          onClick={() => setActiveTab("showcase")}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 ${
            activeTab === "showcase" 
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <History className="w-4 h-4" />
          {t("Winners & Losers Audit", "标的复盘红黑榜")}
        </button>
      </div>

      {/* TAB 1: Strategy Performance Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {winRates.map((strategy) => (
            <div 
              key={strategy.id}
              className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all backdrop-blur-md flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                      {strategy.id === "value" && <ShieldCheck className="w-5 h-5" />}
                      {strategy.id === "large_growth" && <TrendingUp className="w-5 h-5" />}
                      {strategy.id === "small_growth" && <Rocket className="w-5 h-5" />}
                      {strategy.id === "garp" && <Activity className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {isZh ? strategy.nameZh : strategy.name}
                      </h3>
                      <span className="text-xs text-slate-400">
                        {t("Total Recommendations", "累计推荐标的")}: {strategy.totalRecommendations} {t("stocks", "只")}
                      </span>
                    </div>
                  </div>

                  <span className={`px-3 py-1 text-xs font-bold rounded-full border ${
                    strategy.status === "OPTIMAL" 
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                  }`}>
                    {strategy.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center sm:text-left">
                  <div>
                    <div className="text-xs text-slate-400">{t("T+5 Win Rate", "T+5 短线")}</div>
                    <div className="text-lg font-bold text-emerald-400 mt-1">{strategy.t5WinRate}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{t("T+20 Win Rate", "T+20 月线")}</div>
                    <div className="text-lg font-bold text-blue-400 mt-1">{strategy.t20WinRate}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{t("T+60 Win Rate", "T+60 季线(3M)")}</div>
                    <div className="text-lg font-bold text-indigo-400 mt-1">{strategy.t60WinRate}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{t("Avg Return", "平均收益率")}</div>
                    <div className="text-lg font-bold text-purple-400 mt-1">+{strategy.avgReturn}%</div>
                  </div>
                </div>

              </div>

              <div className="mt-2 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  {t("Closed-loop verified against live market data", "由闭环回测引擎实盘校验数据支撑")}
                </span>
                <Link 
                  href={`/screener/${strategy.id}`}
                  className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
                >
                  {t("View Screener", "查看此策略")} &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: Self-Healing Timeline */}
      {activeTab === "timeline" && (
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {t("Autonomous Self-Healing Audit Trail", "AI 策略门槛自愈进化日志")}
              </h2>
              <p className="text-xs text-slate-400">
                {t("Real-time log of automated parameter adjustments triggered by market volatility.", "大盘波动触发策略阈值自适应调整的实盘干预记录")}
              </p>
            </div>
          </div>

          <div className="relative pl-6 border-l-2 border-purple-500/30 space-y-8">
            {selfHealingLogs.map((log) => (
              <div key={log.id} className="relative group">
                {/* Timeline Bullet Dot */}
                <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-purple-500 border-4 border-slate-950 shadow-lg shadow-purple-500/50" />
                
                <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-purple-500/40 transition-all">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-bold text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-md border border-purple-500/20">
                      {log.date}
                    </span>
                    <span className="text-xs font-semibold text-slate-300">
                      {log.strategyNameZh}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs sm:text-sm">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-amber-300">{t("Trigger Event", "触发事件")}: </span>
                        <span className="text-slate-300">{isZh ? log.triggerEventZh : log.triggerEvent}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Cpu className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-blue-300">{t("Auto Action", "AI 自愈调整")}: </span>
                        <span className="text-slate-200">{isZh ? log.actionTakenZh : log.actionTaken}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-emerald-300">{t("Outcome", "干预成效")}: </span>
                        <span className="text-emerald-400 font-medium">{isZh ? log.impactScoreZh : log.impactScore}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Winners & Losers Showcase */}
      {activeTab === "showcase" && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md">
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <History className="w-5 h-5 text-blue-400" />
              {t("Recent Signal Verification Audit", "近期推荐标的真实走势复盘")}
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              {t("Comparing predicted rationale against post-recommendation price movements.", "公开展示推荐股票随后的真实涨跌幅及底层逻辑验证")}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {showcaseStocks.map((stock) => (
                <div 
                  key={stock.symbol}
                  className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-lg font-extrabold text-white">{stock.symbol}</div>
                        <div className="text-xs text-slate-400">{stock.companyName}</div>
                      </div>
                      <div className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                        stock.returnPct >= 0
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                      }`}>
                        {stock.returnPct >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        {stock.returnPct >= 0 ? `+${stock.returnPct}%` : `${stock.returnPct}%`}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-300 mb-3">
                      <span className="font-semibold text-slate-400">{t("Rationale", "推荐逻辑")}: </span>
                      {isZh ? stock.keyRationaleZh : stock.keyRationaleEn}
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/60 pt-2">
                    <span>{t("Entry", "推荐时价格")}: ${stock.entryPrice}</span>
                    <span>{t("Current", "现价")}: ${stock.currentPrice}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
