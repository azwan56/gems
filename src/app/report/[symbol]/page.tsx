"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { 
  Loader2, 
  Download, 
  ChevronLeft, 
  ShieldAlert, 
  Zap, 
  TrendingUp, 
  ActivitySquare, 
  Rocket, 
  Gem, 
  Target, 
  Sparkles, 
  Users, 
  Compass, 
  Activity, 
  FileText 
} from "lucide-react";
import Link from "next/link";
import type { StockAnalysisReport } from "@/lib/analysis-engine";
import { useAuth } from "@/lib/auth-context";
import StockChatAssistant from "@/components/StockChatAssistant";
import SectorWindBadge from "@/components/SectorWindBadge";

type Lang = "en" | "zh";

export default function ReportPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { getIdToken, loading: authLoading } = useAuth();
  
  const symbol = params.symbol as string;
  const strategy = searchParams.get("strategy") || "large_growth";
  const lang: Lang = searchParams.get("lang") === "en" ? "en" : "zh";

  /** Bilingual helper — same pattern as the screener page */
  const t = (en: string, zh: string) => (lang === "en" ? en : zh);

  const formatConsensus = (val?: string | null) => {
    if (!val) return "";
    if (lang === "en") return val;
    const map: Record<string, string> = {
      "Strong Buy": "强力买入",
      "Buy": "买入",
      "Moderate Buy": "适度买入",
      "Hold": "持有",
      "Underperform": "弱于大市",
      "Sell": "卖出",
      "Strong Sell": "强力卖出",
    };
    return map[val] || val;
  };
  
  const [report, setReport] = useState<StockAnalysisReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [analystTarget, setAnalystTarget] = useState<{
    targetConsensus: number;
    targetHigh: number;
  } | null>(null);

  const handleSaveAsPDF = async () => {
    try {
      setIsGeneratingPDF(true);
      const element = document.getElementById("report-content");
      if (!element) {
        window.print();
        return;
      }
      
      const html2pdfModule = await import("html2pdf.js");
      const html2pdf = (html2pdfModule as any).default?.default || html2pdfModule.default || (html2pdfModule as any);

      if (typeof html2pdf === "function") {
        const opt = {
          margin:       10,
          filename:     `${report?.symbol || symbol || "GEMS_QUANT"}_report.pdf`,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true, logging: false },
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
        };

        await html2pdf().set(opt as any).from(element).save();
      } else {
        window.print();
      }
    } catch (error) {
      console.warn("html2pdf generation failed, falling back to window.print()", error);
      window.print();
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  useEffect(() => {
    if (!symbol || authLoading) return;
    
    async function fetchData() {
      try {
        setLoading(true);
        const token = await getIdToken();
        
        // Fetch report
        const res = await fetch(`/api/analysis?symbol=${symbol}&strategy=${strategy}&lang=${lang}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || `Server returned ${res.status}`);
        }
        const data = await res.json();
        setReport(data.report);

        // Fetch analyst target consensus (non-blocking)
        try {
          const targetRes = await fetch(`/api/target-prices?symbols=${symbol}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (targetRes.ok) {
            const targetData = await targetRes.json();
            if (targetData?.targets && targetData.targets[symbol]) {
              setAnalystTarget({
                targetConsensus: targetData.targets[symbol].targetConsensus,
                targetHigh: targetData.targets[symbol].targetHigh,
              });
            }
          }
        } catch (targetErr) {
          console.warn("Failed to fetch analyst target price", targetErr);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [symbol, strategy, lang, authLoading, getIdToken]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">{t("Generating Institutional Report...", "正在生成机构级研报...")}</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <ShieldAlert className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">{t("Error Loading Report", "研报加载失败")}</h2>
        <p className="text-slate-500">{error}</p>
        <Link href="/" className="mt-6 text-blue-600 hover:underline">{t("Return to Screener", "返回选股器")}</Link>
      </div>
    );
  }

  const strategyLabel = {
    value: t("Value Investing", "价值投资"),
    large_growth: t("Large-Cap Growth", "大盘成长"),
    small_growth: t("Small-Cap Growth", "小盘成长"),
    seeking_alpha: t("Seeking Alpha", "Seeking Alpha"),
    garp: t("GARP", "合理价格成长"),
    wide_moat: t("Wide Moat", "深宽护城河"),
    short_term_catalyst: t("Short-Term Catalyst", "短线催化剂"),
    multi_strategy: t("Multi-Strategy Matrix", "多策略共振矩阵"),
  }[strategy] || strategy.replace(/_/g, " ").toUpperCase();

  return (
    <>
      {/* Inline print styles — scoped to this page */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          html, body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            margin: 10mm;
            size: A4;
          }
          .report-section {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      ` }} />

      <div className="min-h-screen bg-slate-100 print:bg-white text-slate-900 font-sans pb-20 print:pb-0">
        {/* Floating Action Bar (hidden when printing) */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 flex justify-center gap-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] print:hidden z-50">
          <button 
            onClick={() => window.history.length > 1 ? window.history.back() : window.close()} 
            className="px-6 py-2.5 rounded-lg font-semibold text-slate-600 hover:bg-slate-100 flex items-center gap-2"
          >
            <ChevronLeft className="w-5 h-5" /> {t("Back", "返回")}
          </button>
          <button 
            onClick={handleSaveAsPDF} 
            disabled={isGeneratingPDF}
            className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-blue-500/30 transition-all hover:scale-105 disabled:opacity-70 disabled:hover:scale-100 disabled:cursor-not-allowed"
          >
            {isGeneratingPDF ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />} 
            {isGeneratingPDF ? t("Generating...", "生成中...") : t("Save as PDF", "保存为 PDF")}
          </button>
        </div>

        {/* A4 Page Container */}
        <div id="report-content" className="max-w-[800px] mx-auto bg-white shadow-xl mt-8 mb-24 min-h-[1122px] p-10 relative print:shadow-none print:m-0 print:mt-0 print:mb-0 print:max-w-none print:min-h-0 print:p-0">
          
          {/* Header */}
          <header className="report-section border-b-2 border-blue-900 pb-6 mb-8 flex justify-between items-end">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center">
                  <Gem className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-2xl font-black text-blue-900 tracking-tight">GEMS QUANT</h1>
              </div>
              <p className="text-sm font-semibold text-slate-500 tracking-widest uppercase">{t("AI Investment Research Report", "AI 投资研究报告")}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 font-mono">{t("Date", "日期")}: {new Date().toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US")}</p>
              <p className="text-xs text-slate-400 font-mono mt-1">{t("Strategy", "策略")}: {strategyLabel}</p>
            </div>
          </header>

          {/* Company Title & Sector Badge */}
          <div className="report-section flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-4xl font-black text-slate-900 tracking-tight">
                  {report.symbol}
                </h2>
                {report.sectorRotation && (
                  <SectorWindBadge
                    wind={report.sectorRotation.windStatus}
                    quadrant={report.sectorRotation.quadrant}
                    etf={report.sectorRotation.etf}
                    subIndustryETF={report.sectorRotation.subIndustryETF}
                    subIndustryName={report.sectorRotation.subIndustryName}
                    subIndustryQuadrant={report.sectorRotation.subIndustryQuadrant}
                    subIndustryWind={report.sectorRotation.subIndustryWind}
                    theme="light"
                    size="md"
                  />
                )}
              </div>
              <p className="text-slate-500 mt-1 text-sm font-medium">
                {formatConsensus(report.analyst.consensus)} {t("Consensus Rating", "市场共识评级")}
              </p>
            </div>
          </div>

          {/* Analyst Pricing & Targets: Dual Wall Street Consensus + AI Fair Value */}
          {(() => {
            const wsTarget = report.analyst.wallStreetTargetPrice;
            const wsUpside = report.analyst.wallStreetUpside;
            const aiTarget = report.analyst.aiTargetPrice;
            const aiUpside = report.analyst.aiUpside;
            const hasDual = Boolean(wsTarget && aiTarget && wsTarget !== aiTarget);

            return (
              <div className={`report-section grid gap-4 mb-6 ${hasDual ? "grid-cols-3" : "grid-cols-2"}`}>
                {/* Wall Street Consensus Target */}
                <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-blue-600" />
                        {t("Wall St Target", "华尔街目标价")}
                      </span>
                      {hasDual && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold border border-blue-200 font-mono">
                          {t("Consensus", "机构中位")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black text-slate-900">
                        {wsTarget || report.analyst.targetPrice}
                      </span>
                      <span className={`text-sm font-bold font-mono ${(wsUpside || report.analyst.upside || "").startsWith("-") ? "text-rose-600" : "text-emerald-600"}`}>
                        {wsUpside || report.analyst.upside}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-2 border-t border-blue-100 text-[11px] text-slate-500 flex justify-between items-center">
                    <span>{t("Wall Street High", "机构最高价")}</span>
                    <span className="font-bold text-slate-700 font-mono">
                      {analystTarget?.targetHigh ? `$${analystTarget.targetHigh.toFixed(2)}` : "-"}
                    </span>
                  </div>
                </div>

                {/* AI Revaluation Target */}
                {hasDual && (
                  <div className="border border-purple-200 bg-purple-50/40 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                          {t("AI Fair Value", "AI 基本面重估")}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold border border-purple-200 font-mono">
                          {t("Forward Model", "前瞻测算")}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-black text-slate-900">
                          {aiTarget}
                        </span>
                        <span className={`text-sm font-bold font-mono ${(aiUpside || "").startsWith("-") ? "text-rose-600" : "text-emerald-600"}`}>
                          {aiUpside}
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-2 border-t border-purple-100 text-[11px] text-slate-500 flex justify-between items-center">
                      <span>{t("Valuation Basis", "测算基准")}</span>
                      <span className="font-medium text-purple-800">{t("Multi-Factor DCF", "多因子内在价值")}</span>
                    </div>
                  </div>
                )}

                {/* Market Consensus Breakdown */}
                <div className="border border-slate-200 bg-slate-50/60 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        {t("Consensus", "市场共识")}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                        {t("Institutional", "机构覆盖")}
                      </span>
                    </div>
                    <div className="text-xl font-bold text-emerald-700 mt-1">
                      {formatConsensus(report.analyst.consensus)}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-200 text-[11px] text-slate-500 flex justify-between items-center font-mono">
                    <span className="text-emerald-700 font-medium">{t("Buy", "买入")}: {report.analyst.breakdown.buy}</span>
                    <span className="text-slate-600 font-medium">{t("Hold", "持有")}: {report.analyst.breakdown.hold}</span>
                    <span className="text-rose-600 font-medium">{t("Sell", "卖出")}: {report.analyst.breakdown.sell}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Scores */}
          <div className="report-section grid grid-cols-3 gap-4 mb-6">
            <div className="border border-purple-200 rounded-xl p-4 bg-gradient-to-br from-purple-50 to-white relative overflow-hidden print:bg-purple-50">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                  <ActivitySquare className="w-3.5 h-3.5 text-purple-600" /> {t("Technical Score", "技术面评分")}
                </h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-purple-900">{report.technicalScore}</span>
                  <span className="text-[10px] text-slate-400">/ 100</span>
                </div>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-purple-600 h-full rounded-full" style={{ width: `${report.technicalScore}%` }} />
              </div>
              <p className="text-[11px] text-slate-500 mt-2 font-medium">{t("Momentum & Trend Analysis", "动量与趋势分析")}</p>
            </div>

            <div className="border border-amber-200 rounded-xl p-4 bg-gradient-to-br from-amber-50 to-white relative overflow-hidden print:bg-amber-50">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-amber-600" /> {t("Fundamental Score", "基本面评分")}
                </h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-amber-900">{report.fundamentalScore}</span>
                  <span className="text-[10px] text-slate-400">/ 100</span>
                </div>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-amber-600 h-full rounded-full" style={{ width: `${report.fundamentalScore}%` }} />
              </div>
              <p className="text-[11px] text-slate-500 mt-2 font-medium">{t("Profitability & Growth", "盈利能力与成长性指标")}</p>
            </div>

            <div className="border border-blue-200 rounded-xl p-4 bg-gradient-to-br from-blue-50 to-white relative overflow-hidden print:bg-blue-50">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-blue-600" /> {t("Sector Rotation", "板块动能评分")}
                </h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-blue-900">{report.sectorScore ?? 50}</span>
                  <span className="text-[10px] text-slate-400">/ 100</span>
                </div>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full" style={{ width: `${report.sectorScore ?? 50}%` }} />
              </div>
              <p className="text-[11px] text-slate-500 mt-2 font-medium truncate">
                {report.sectorRotation?.subIndustryName || report.sectorRotation?.sectorName || t("Macro Sector", "宏观板块")} · RRG {report.sectorRotation?.subIndustryQuadrant || report.sectorRotation?.quadrant || t("Neutral", "中性")}
              </p>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="report-section mb-6 border-l-4 border-blue-600 pl-4 py-1">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-1.5 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" /> {t("Executive Summary", "核心摘要与概况")}
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">{report.overview}</p>
          </div>

          {/* Fundamentals */}
          <div className="report-section mb-6">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-2 flex items-center gap-2 border-b border-slate-200 pb-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" /> {t("Fundamental Analysis", "基本面分析")}
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">{report.fundamentals}</p>
          </div>

          {/* Products & Services */}
          {report.products && (
            <div className="report-section mb-6">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-2 flex items-center gap-2 border-b border-slate-200 pb-2">
                <Activity className="w-4 h-4 text-purple-600" /> {t("Products & Services", "产品与服务")}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">{report.products}</p>
            </div>
          )}

          {/* Top-Down Sector Rotation Context */}
          {report.sectorRotation && (
            <div className="report-section mb-6 bg-blue-50/50 border border-blue-200 rounded-xl p-5 print:bg-blue-50/50">
              <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-blue-100">
                <h3 className="text-sm font-bold text-blue-900 uppercase tracking-widest flex items-center gap-2">
                  <Compass className="w-4 h-4 text-blue-600" /> {t("Sector Rotation Context", "自上而下板块大势与宏观契合度")}
                </h3>
                <SectorWindBadge
                  wind={report.sectorRotation.windStatus}
                  quadrant={report.sectorRotation.quadrant}
                  etf={report.sectorRotation.etf}
                  subIndustryETF={report.sectorRotation.subIndustryETF}
                  subIndustryName={report.sectorRotation.subIndustryName}
                  subIndustryQuadrant={report.sectorRotation.subIndustryQuadrant}
                  subIndustryWind={report.sectorRotation.subIndustryWind}
                  theme="light"
                  size="md"
                />
              </div>
              <p className="text-sm text-slate-700 leading-relaxed mb-4">
                {report.sectorRotation.advice}
              </p>
              <div className="grid grid-cols-4 gap-3 text-xs pt-3 border-t border-blue-100 bg-white/80 rounded-lg p-3">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">{t("Sector / Sub-Industry", "所属大类 / 细分")}</span>
                  <strong className="text-slate-800 text-xs">
                    {report.sectorRotation.subIndustryName
                      ? `${report.sectorRotation.subIndustryName} (${report.sectorRotation.sectorName})`
                      : report.sectorRotation.sectorName}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">{t("Benchmark ETFs", "追踪 ETF (细分 / 大类)")}</span>
                  <strong className="text-blue-700 font-mono text-xs">
                    {report.sectorRotation.subIndustryETF
                      ? `${report.sectorRotation.subIndustryETF} / ${report.sectorRotation.etf}`
                      : report.sectorRotation.etf}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">{t("RRG Quadrant", "RRG 轮动象限")}</span>
                  <strong className="text-slate-800 text-xs">
                    {report.sectorRotation.subIndustryQuadrant
                      ? `${report.sectorRotation.subIndustryQuadrant} (大类: ${report.sectorRotation.quadrant})`
                      : report.sectorRotation.quadrant}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">{t("Tactical Posture", "战术姿态")}</span>
                  <strong className="text-blue-900 text-xs">{report.sectorRotation.action}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Detailed Analysis Grid */}
          <div className="report-section grid grid-cols-2 gap-x-8 gap-y-6 mb-6">
            {/* Rationale */}
            <div>
              <h3 className="text-sm font-bold text-emerald-700 uppercase tracking-widest mb-3 flex items-center gap-2 border-b border-slate-200 pb-2">
                <Zap className="w-4 h-4" /> {t("Bull Case (Rationale)", "看多逻辑")}
              </h3>
              <ul className="space-y-2.5">
                {report.rationale.map((item, i) => (
                  <li key={i} className="text-sm text-slate-700 leading-relaxed flex gap-2">
                    <span className="text-emerald-500 font-bold shrink-0">•</span> <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Risks */}
            <div>
              <h3 className="text-sm font-bold text-red-700 uppercase tracking-widest mb-3 flex items-center gap-2 border-b border-slate-200 pb-2">
                <ShieldAlert className="w-4 h-4" /> {t("Bear Case (Risks)", "主要风险")}
              </h3>
              <ul className="space-y-2.5">
                {report.risks.map((item, i) => (
                  <li key={i} className="text-sm text-slate-700 leading-relaxed flex gap-2">
                    <span className="text-red-500 font-bold shrink-0">•</span> <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Catalysts & Action */}
          <div className="report-section bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6 print:bg-slate-50">
            <h3 className="text-sm font-bold text-blue-700 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Rocket className="w-4 h-4" /> {t("Upcoming Catalysts & Triggers", "核心催化事件")}
            </h3>
            <ul className="space-y-2.5 mb-4">
              {report.catalysts && report.catalysts.length > 0 ? (
                report.catalysts.map((item, i) => (
                  <li key={i} className="text-sm text-slate-700 leading-relaxed flex gap-3 items-start">
                    <div className="w-5 h-5 rounded bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">{i+1}</div>
                    <span>{item}</span>
                  </li>
                ))
              ) : (
                <li className="text-sm text-slate-500 italic">{t("No specific near-term catalysts identified.", "暂无明确的近期催化事件。")}</li>
              )}
            </ul>

            <div className="pt-3 border-t border-slate-200">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">{t("Position Suggestion", "持仓建议")}</h4>
              <p className="text-sm text-slate-800 font-medium">{report.positionSuggestion}</p>
            </div>
          </div>

          {/* Footer */}
          <footer className="report-section mt-12 pt-6 border-t border-slate-200 text-center text-xs text-slate-400">
            <p>{t("Generated by VANPOWER AI Quant Screener. Not financial advice.", "由 VANPOWER AI 量化选股引擎生成，不构成投资建议。")}</p>
            <p className="mt-1">{t("For institutional use only. Data subject to market conditions.", "仅供机构参考。数据受市场波动影响。")}</p>
            <p className="mt-2">
              <a href="https://gems.vanpower.live" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">gems.vanpower.live</a>
              <span className="mx-2">·</span>
              <span>Powered By Gemini 3.5</span>
            </p>
          </footer>

        </div>
      </div>
      <StockChatAssistant symbol={symbol} companyName={symbol} lang={lang} strategy={strategy} />
    </>
  );
}
