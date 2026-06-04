"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Scale, TrendingUp, RefreshCw, Save, Trash2, CheckCircle2, ShieldAlert, Trophy, Skull, Activity, Calendar, AlertTriangle, ArrowLeft, Gem, Info, Zap } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import PremiumGate from "@/components/PremiumGate";
import { VixSparkline } from "@/components/VixSparkline";

// Client-side type matching the server's AlertSnapshot shape.
interface AlertSnapshot {
  date: string;
  period: "MTD" | "QTD";
  macro: {
    spyReturn: number;
    bndReturn: number;
    spread: number;
    isEquityOutperforming: boolean;
    thresholdExceeded: boolean;
    signal: "SELL_EQUITY" | "BUY_EQUITY" | "NEUTRAL";
  };
  micro: {
    winners: { symbol: string; return: number }[];
    losers: { symbol: string; return: number }[];
  } | null;
  alertsSent: number;
  createdAt: string;
}

export type EventCategory = "MACRO_DATA" | "FED_POLICY" | "OPTIONS_EXPIRY" | "REBALANCE_WINDOW";

interface UpcomingEvent {
  date: string;
  name: string;
  severity: "HIGH" | "MEDIUM";
  category: EventCategory;
  impactedStocks: string[];
}

interface LiveLiquidity {
  vix: number | null;
  vixTrend: "SPIKING" | "SUPPRESSED" | "NORMAL" | "UNKNOWN";
  vixHistory?: number[];
  tnx: number | null;
  upcomingEvents: UpcomingEvent[];
}

export default function MacroEventWarningDashboard() {
  const { t } = useLanguage();
  const { user, getIdToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [email, setEmail] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [snapshots, setSnapshots] = useState<AlertSnapshot[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [liquidity, setLiquidity] = useState<LiveLiquidity | null>(null);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getIdToken]);

  useEffect(() => {
    async function fetchData() {
      try {
        const headers = await authHeaders();
        const [webhookRes, dataRes] = await Promise.all([
          fetch("/api/rebalance-webhook", { headers }),
          fetch("/api/rebalance-data?limit=5", { headers })
        ]);

        if (webhookRes.ok) {
          const config = await webhookRes.json();
          setConfigured(config.configured);
          setEnabled(config.enabled);
          if (config.webhookUrl) setWebhookUrl(config.webhookUrl);
          if (config.email) setEmail(config.email);
        }

        if (dataRes.ok) {
          const data = await dataRes.json();
          setSnapshots(data.snapshots || []);
          if (data.liquidity) setLiquidity(data.liquidity);
        }
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    if (user?.isPremium) fetchData();
    else setLoading(false);
  }, [user?.uid, user?.isPremium, authHeaders]);

  const handleSaveWebhook = async () => {
    if (!webhookUrl && !email && !configured) return;
    setSaving(true);
    setMessage(null);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/rebalance-webhook", {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl, email, enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save webhook");
      setConfigured(true);
      if (data.webhookUrl) setWebhookUrl(data.webhookUrl);
      if (data.email) setEmail(data.email);
      setEnabled(data.enabled);
      setMessage({ text: t("Settings saved successfully.", "设置保存成功。"), type: "success" });
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : "Unknown error", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWebhook = async () => {
    if (!confirm(t("Are you sure you want to remove your webhook?", "确定要删除你的 Webhook 吗？"))) return;
    setSaving(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/rebalance-webhook", { method: "DELETE", headers });
      if (!res.ok) throw new Error("Failed to delete webhook");
      setConfigured(false);
      setWebhookUrl("");
      setEmail("");
      setEnabled(false);
      setMessage({ text: t("Settings removed.", "设置已移除。"), type: "success" });
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : "Unknown error", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const latest = snapshots[0];

  const getDaysUntil = (dateStr: string) => {
    const eventDate = new Date(dateStr);
    eventDate.setHours(23, 59, 59, 999);
    const diff = eventDate.getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const getEventDescription = (category: EventCategory, name: string) => {
    if (category === "MACRO_DATA") return t("Inflation data print. Expect intraday volatility.", "通胀数据公布，极易引起盘中剧烈震荡。");
    if (category === "FED_POLICY") return t("Fed rate decision. Critical for mid-term trend.", "联储政策决议，直接决定中期市场走向。");
    if (category === "OPTIONS_EXPIRY") return t("Quarterly/Monthly OPEX. High volume and pin risk.", "期权交割日，由于对冲需求，容易产生价格扭曲。");
    if (category === "REBALANCE_WINDOW") return t("Month/Quarter end. Institutional flows override fundamentals.", "月末/季末节点，机构调仓资金流往往压倒基本面逻辑。");
    return "";
  };

  const getOverallAlertStatus = () => {
    if (!liquidity || !latest) return { level: "green", title: t("Normal Market Conditions", "当前市场风险可控"), text: t("No critical macro warnings at this time. Maintain standard portfolio allocations.", "各项指标均处于正常区间，可正常持仓，无需特殊防御性操作。") };

    const highRiskEvents = liquidity.upcomingEvents.filter(e => e.severity === "HIGH").length > 0;
    const isVixSuppressed = liquidity.vixTrend === "SUPPRESSED";
    const isVixSpiking = liquidity.vixTrend === "SPIKING";
    const isDriftHigh = latest.macro.thresholdExceeded;

    if (isVixSpiking || (highRiskEvents && isVixSuppressed && isDriftHigh)) {
      return { 
        level: "red", 
        title: t("High Risk: Defensive Action Recommended", "高风险预警：建议采取防御措施"), 
        text: t("Market is vulnerable. VIX anomalies combining with macro events or severe portfolio drift. Consider hedging, taking profits on overextended names, and raising cash.", "VIX 异常 + 重大宏观事件临近 + 股债漂移超限。市场面临显著的回调风险，建议减仓高估值成长股，买入看跌期权对冲，或提高现金比例。") 
      };
    }

    if (highRiskEvents || isDriftHigh || isVixSuppressed) {
      return { 
        level: "yellow", 
        title: t("Caution: Prepare for Upcoming Volatility", "保持警惕：准备迎接即将到来的波动"), 
        text: t("Upcoming catalysts or moderate portfolio drift detected. Avoid new heavy long positions and monitor closely.", "近期有重大事件临近，或市场存在局部资金失衡。建议减少追高操作，可逢低吸纳防御性板块。") 
      };
    }

    return { 
      level: "green", 
      title: t("Normal Market Conditions", "当前市场风险可控"), 
      text: t("No critical macro warnings at this time. Maintain standard portfolio allocations.", "各项指标均处于正常区间，可正常持仓，无需特殊防御性操作。") 
    };
  };

  const alertStatus = getOverallAlertStatus();

  return (
    <main className="min-h-screen flex flex-col py-8 px-4 sm:px-6 max-w-[1200px] mx-auto w-full">
      <PremiumGate featureName={t("Macro Event Warning", "宏观事件预警")}>
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <Gem className="w-5 h-5 text-blue-400" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
                <Activity className="w-8 h-8 text-blue-400" />
                {t("Macro Event Warning", "宏观事件预警")}
              </h1>
              <p className="text-slate-400">
                {t("Synthesized intelligence on liquidity, macro calendar, and institutional rebalancing to guide tactical portfolio allocation.", "综合分析市场流动性、宏观日历事件与机构再平衡动态，为您提供战术性仓位管理建议。")}
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mr-3" />
            Loading dashboard data...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Main Dashboards */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* ================================================================= */}
              {/* SECTION 1: OVERALL RISK DASHBOARD */}
              {/* ================================================================= */}
              <section className="space-y-4">
                {/* Alert Summary Banner */}
                <div className={`p-5 rounded-xl border ${
                  alertStatus.level === 'red' ? 'bg-red-500/10 border-red-500/30' :
                  alertStatus.level === 'yellow' ? 'bg-amber-500/10 border-amber-500/30' :
                  'bg-emerald-500/10 border-emerald-500/30'
                }`}>
                  <div className="flex items-start gap-3">
                    {alertStatus.level === 'red' ? <AlertTriangle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" /> :
                     alertStatus.level === 'yellow' ? <Info className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" /> :
                     <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />}
                    <div>
                      <h2 className={`font-bold text-lg mb-1 ${
                        alertStatus.level === 'red' ? 'text-red-400' :
                        alertStatus.level === 'yellow' ? 'text-amber-400' :
                        'text-emerald-400'
                      }`}>
                        {alertStatus.title}
                      </h2>
                      <p className={`text-sm leading-relaxed ${
                        alertStatus.level === 'red' ? 'text-red-300' :
                        alertStatus.level === 'yellow' ? 'text-amber-300' :
                        'text-emerald-300'
                      }`}>
                        {alertStatus.text}
                      </p>
                    </div>
                  </div>
                </div>

                {/* VIX & TNX Mini Cards */}
                {liquidity && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* VIX */}
                    <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/50 flex flex-col justify-between">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-bold text-slate-300">VIX</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                              liquidity.vixTrend === 'SPIKING' ? 'bg-red-500/20 text-red-400' :
                              liquidity.vixTrend === 'SUPPRESSED' ? 'bg-amber-500/20 text-amber-400' :
                              'bg-emerald-500/20 text-emerald-400'
                            }`}>
                              {liquidity.vixTrend}
                            </span>
                          </div>
                          <span className="text-3xl font-mono font-bold">
                            {liquidity.vix?.toFixed(2) ?? "N/A"}
                          </span>
                        </div>
                        {liquidity.vixHistory && liquidity.vixHistory.length > 0 && (
                          <VixSparkline data={liquidity.vixHistory} trend={liquidity.vixTrend} />
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-2">
                        {liquidity.vixTrend === 'SPIKING' ? t("Fear is elevated. Option premiums are expensive. High probability of pullbacks.", "市场恐慌情绪升温，期权保费大幅上升。") :
                         liquidity.vixTrend === 'SUPPRESSED' ? t("Extreme complacency. The market is vulnerable to sudden shocks.", "极度自满，隐含波动率异常低。一旦出现意外事件，市场可能剧烈反应。") :
                         t("Volatility is within normal ranges. Market pricing is stable.", "波动率处于正常区间，市场情绪平稳。")}
                      </p>
                    </div>

                    {/* TNX */}
                    <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/50 flex flex-col justify-between">
                      <div className="mb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-slate-300">US 10-Year Yield (TNX)</span>
                        </div>
                        <span className="text-3xl font-mono font-bold text-blue-400">
                          {liquidity.tnx != null ? `${liquidity.tnx.toFixed(3)}%` : "N/A"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-2">
                        {liquidity.tnx && liquidity.tnx > 4.5 ? t("High yields apply pressure on long-duration growth tech valuations.", "国债收益率高企，对高估值成长股形成估值压制。") :
                         liquidity.tnx && liquidity.tnx < 3.5 ? t("Low yield environment supports multiple expansion for equities.", "低利率环境利好成长股估值扩张。") :
                         t("Yields are at moderate levels with neutral impact on equities.", "利率水平适中，对股市整体估值影响中性。")}
                      </p>
                    </div>
                  </div>
                )}
              </section>

              {/* ================================================================= */}
              {/* SECTION 2: EVENT TIMELINE */}
              {/* ================================================================= */}
              {liquidity && (
                <section className="glass-panel p-6 border-t-4 border-t-amber-500">
                  <div className="mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
                      <Calendar className="w-5 h-5 text-amber-400" />
                      {t("Event Timeline & Impact Predictions", "事件时间线与影响预判")}
                    </h2>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      {t("Upcoming macro catalysts and potential impacts on your watchlist and high-momentum stocks.", "即将到来的宏观催化剂，及其对您的自选股和高动量股票的潜在影响预判。")}
                    </p>
                  </div>

                  {liquidity.upcomingEvents.length === 0 ? (
                    <p className="text-sm text-slate-500 p-4 bg-slate-900/40 rounded-lg">{t("No major macro events scheduled.", "近期无重大宏观或期权交割事件。")}</p>
                  ) : (
                    <div className="space-y-4">
                      {liquidity.upcomingEvents.map((ev, i) => {
                        const days = getDaysUntil(ev.date);
                        return (
                          <div key={i} className="flex flex-col p-4 rounded-xl bg-slate-900/60 border border-slate-700/50 relative overflow-hidden">
                            {ev.severity === 'HIGH' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />}
                            {ev.severity === 'MEDIUM' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />}
                            
                            <div className="flex justify-between items-start mb-3 pl-2">
                              <div>
                                <h3 className={`font-bold text-lg mb-1 ${ev.severity === 'HIGH' ? 'text-red-400' : 'text-amber-400'}`}>
                                  {ev.name}
                                </h3>
                                <p className="text-xs text-slate-400">
                                  {getEventDescription(ev.category, ev.name)}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1.5">
                                <span className={`text-xs font-bold px-3 py-1 rounded-full ${days <= 3 ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-300'}`}>
                                  {days === 0 ? t("Today", "今天") : t(`${days} days left`, `还有 ${days} 天`)}
                                </span>
                                <span className="font-mono text-xs text-slate-500">{ev.date}</span>
                              </div>
                            </div>

                            {/* Impact Predictions */}
                            {ev.impactedStocks && ev.impactedStocks.length > 0 && (
                              <div className="ml-2 mt-2 pt-3 border-t border-slate-800/80">
                                <h4 className="text-[11px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1.5 mb-2">
                                  <Zap className="w-3 h-3 text-amber-400" />
                                  {t("Predicted Impact on Stocks", "受影响标的预判")}
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {ev.impactedStocks.map(sym => (
                                    <span key={sym} className="px-2 py-1 bg-slate-800 rounded text-xs font-mono text-slate-300 border border-slate-700">
                                      {sym}
                                    </span>
                                  ))}
                                  {ev.category === "MACRO_DATA" || ev.category === "FED_POLICY" ? (
                                    <span className="text-[11px] text-slate-500 self-center ml-1">
                                      {t("(Your DailyStock holdings)", "(您的 DailyStock 持仓)")}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-slate-500 self-center ml-1">
                                      {t("(High momentum candidates)", "(高动量/高Gamma候选)")}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {/* ================================================================= */}
              {/* SECTION 3: INSTITUTIONAL REBALANCING RADAR */}
              {/* ================================================================= */}
              <section className="glass-panel p-6 border-t-4 border-t-blue-500">
                <div className="mb-6">
                  <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
                    <Scale className="w-5 h-5 text-blue-400" />
                    {t("Institutional Rebalancing Radar", "机构再平衡雷达")}
                  </h2>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {t("Tracks 60/40 equity/bond drift and quarter-end window dressing. When the SPY vs BND return spread exceeds ±3%, passive funds may be forced to rebalance.", "跟踪 60/40 股债配比漂移和季末橱窗粉饰效应。当 SPY 与 BND 的收益差超过 ±3% 时，意味着被动资金可能被迫进行大幅减仓或加仓。")}
                  </p>
                </div>
                
                {!latest ? (
                  <p className="text-slate-500 py-4 text-sm">{t("No data available yet.", "暂无可用数据。")}</p>
                ) : (
                  <div className="space-y-6">
                    {/* Macro Drift Subsection */}
                    <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-300 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-slate-400" />
                          {t("Asset Class Drift (SPY vs BND)", "大类资产漂移")}
                        </h3>
                        <div className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 ${
                          latest.macro.signal === "SELL_EQUITY" ? "bg-red-500/20 text-red-400" :
                          latest.macro.signal === "BUY_EQUITY" ? "bg-emerald-500/20 text-emerald-400" :
                          "bg-slate-800 text-slate-400"
                        }`}>
                          {latest.macro.signal === "SELL_EQUITY" ? t("Equities Overheated (Sell Risk)", "股市过热 (面临抛售风险)") :
                           latest.macro.signal === "BUY_EQUITY" ? t("Equities Oversold (Buy Flow)", "股市超跌 (面临买入资金)") :
                           t("Neutral (No Action Required)", "中性 (无再平衡压力)")}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                          <p className="text-slate-500 text-xs mb-1">SPY Return ({latest.period})</p>
                          <p className={`text-xl font-mono ${latest.macro.spyReturn >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {latest.macro.spyReturn >= 0 ? "+" : ""}{latest.macro.spyReturn.toFixed(2)}%
                          </p>
                        </div>
                        <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                          <p className="text-slate-500 text-xs mb-1">BND Return ({latest.period})</p>
                          <p className={`text-xl font-mono ${latest.macro.bndReturn >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {latest.macro.bndReturn >= 0 ? "+" : ""}{latest.macro.bndReturn.toFixed(2)}%
                          </p>
                        </div>
                        <div className="bg-blue-500/5 p-3 rounded-lg border border-blue-500/20">
                          <p className="text-blue-400/80 text-xs mb-1 font-bold">Spread</p>
                          <p className={`text-xl font-mono font-bold ${Math.abs(latest.macro.spread) >= 3.0 ? "text-amber-400" : "text-slate-200"}`}>
                            {latest.macro.spread >= 0 ? "+" : ""}{latest.macro.spread.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Window Dressing Subsection */}
                    <div className="bg-slate-900/40 rounded-xl p-5 border border-slate-700/50">
                      <div className="mb-4">
                        <h3 className="font-bold text-slate-300 flex items-center gap-2 mb-1">
                          <ShieldAlert className="w-4 h-4 text-slate-400" />
                          {t("Window Dressing (Nasdaq-100)", "橱窗粉饰效应预判 (纳斯达克100)")}
                        </h3>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {t("At quarter/month end, fund managers buy top performers to show them in reports, and dump losers to hide them. This exacerbates momentum.", "在季末/月末，基金经理倾向于买入涨幅最大的股票以向客户展示，并卖出跌幅最大的股票以隐藏败笔，这会造成短期价格动量失真。")}
                        </p>
                      </div>

                      {!latest?.micro ? (
                        <p className="text-slate-500 py-2 text-xs bg-slate-900/60 p-3 rounded">
                          {t("Micro data is only fetched when macro drift exceeds the 3% threshold.", "仅在宏观漂移超过 3% 阈值时才会激活微观成分股扫描。")}
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Winners */}
                          <div>
                            <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mb-2 uppercase tracking-wider">
                              <Trophy className="w-3 h-3" />
                              {t("Buy Momentum Candidates", "极易遭追涨标的")}
                            </h4>
                            <p className="text-[10px] text-emerald-500/70 mb-2 leading-tight">
                              {t("Fund managers need to show they own these winners.", "基金经理在季报中需要展示持有这些赢家。")}
                            </p>
                            <div className="space-y-1.5">
                              {latest.micro.winners.slice(0, 5).map((stock, i) => (
                                <div key={stock.symbol} className="flex items-center justify-between p-2 rounded bg-slate-800/50">
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-500 text-[10px] w-3">{i + 1}</span>
                                    <span className="font-bold text-sm">{stock.symbol}</span>
                                  </div>
                                  <span className="text-emerald-400 font-mono text-xs">+{stock.return.toFixed(2)}%</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Losers */}
                          <div>
                            <h4 className="text-xs font-bold text-red-400 flex items-center gap-1.5 mb-2 uppercase tracking-wider">
                              <Skull className="w-3 h-3" />
                              {t("Dumping Risk Candidates", "极易遭抛售标的")}
                            </h4>
                            <p className="text-[10px] text-red-500/70 mb-2 leading-tight">
                              {t("Fund managers will dump these to hide them from reports.", "基金经理会在窗口期清仓掉这些输家以美化报告。")}
                            </p>
                            <div className="space-y-1.5">
                              {latest.micro.losers.slice(0, 5).map((stock, i) => (
                                <div key={stock.symbol} className="flex items-center justify-between p-2 rounded bg-slate-800/50">
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-500 text-[10px] w-3">{i + 1}</span>
                                    <span className="font-bold text-sm">{stock.symbol}</span>
                                  </div>
                                  <span className="text-red-400 font-mono text-xs">{stock.return.toFixed(2)}%</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Snapshot History (Moved inside section 3) */}
                    <div className="mt-6 pt-6 border-t border-slate-800">
                      <details className="group">
                        <summary className="text-sm font-bold text-slate-400 cursor-pointer flex items-center gap-2 hover:text-slate-300">
                          {t("View Recent Scan History", "查看近期扫描记录")}
                        </summary>
                        <div className="mt-4 space-y-2">
                          {snapshots.slice(1, 6).map((snap, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/40 border border-slate-700/30 max-w-lg">
                              <div>
                                <p className="text-xs font-mono text-slate-400 mb-1">{snap.date}</p>
                                <p className={`text-xs font-bold ${
                                  snap.macro.signal === "SELL_EQUITY" ? "text-red-400" :
                                  snap.macro.signal === "BUY_EQUITY" ? "text-emerald-400" : "text-slate-400"
                                }`}>
                                  {snap.macro.signal.replace("_", " ")}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] text-slate-500 mb-0.5">Spread</p>
                                <p className="text-sm font-mono font-bold">{snap.macro.spread > 0 ? "+" : ""}{snap.macro.spread.toFixed(2)}%</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>

                  </div>
                )}
              </section>
            </div>

            {/* Right Column: Webhook Settings */}
            <div className="space-y-6">
              <div className="glass-panel p-6 border-slate-700/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-5">
                  <CheckCircle2 className="w-24 h-24" />
                </div>
                
                <h2 className="text-lg font-bold mb-2">{t("Alert Settings", "预警推送设置")}</h2>
                <p className="text-sm text-slate-400 mb-6 leading-relaxed relative z-10">
                  {t("Receive automated alerts directly in your Discord server or via Email when the warning window opens.", "当月末/季末预警窗口开启时，自动将结果推送到你的 Discord 频道或邮箱。")}
                </p>

                {message && (
                  <div className={`p-3 rounded-lg mb-4 text-sm font-medium ${
                    message.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
                  }`}>
                    {message.text}
                  </div>
                )}

                <div className="space-y-4 relative z-10">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                      {t("Discord Webhook URL", "Discord Webhook 地址")}
                    </label>
                    <input
                      type="text"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://discord.com/api/webhooks/..."
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                      {t("Email Address", "电子邮箱地址")}
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alerts@example.com"
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer group p-2 -ml-2 rounded-lg hover:bg-slate-800/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => setEnabled(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-800"
                    />
                    <span className="text-sm font-medium group-hover:text-blue-300 transition-colors">
                      {t("Enable Alerts", "开启推送")}
                    </span>
                  </label>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={handleSaveWebhook}
                      disabled={saving || (!webhookUrl && !email)}
                      className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                    >
                      {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {t("Save", "保存设置")}
                    </button>
                    
                    {configured && (
                      <button
                         onClick={handleDeleteWebhook}
                        disabled={saving}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
                        title={t("Remove Settings", "移除设置")}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </PremiumGate>
    </main>
  );
}
