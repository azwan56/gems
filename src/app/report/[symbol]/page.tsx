"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2, Download, ChevronLeft, ShieldAlert, Zap, TrendingUp, ActivitySquare, Rocket, Gem } from "lucide-react";
import Link from "next/link";
import type { StockAnalysisReport } from "@/lib/analysis-engine";
import { useAuth } from "@/lib/auth-context";

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
  
  const [report, setReport] = useState<StockAnalysisReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [analystTarget, setAnalystTarget] = useState<number | null>(null);

  const handleSaveAsPDF = async () => {
    try {
      setIsGeneratingPDF(true);
      const element = document.getElementById("report-content");
      if (!element) return;
      const html2pdf = (await import("html2pdf.js")).default;
      
      const opt = {
        margin:       10,
        filename:     `${report?.symbol || "GEMS_QUANT"}_report.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(opt as any).from(element).save();
    } catch (error) {
      console.error("Error generating PDF", error);
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
              setAnalystTarget(targetData.targets[symbol].targetConsensus);
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

          {/* Company Title & Price Action */}
          <div className="report-section flex justify-between items-start mb-8">
            <div>
              <h2 className="text-4xl font-black text-slate-900 flex items-center gap-3">
                {report.symbol}
              </h2>
              <p className="text-slate-500 mt-1">{report.analyst.consensus} {t("Consensus Rating", "市场共识评级")}</p>
            </div>
            
            {/* Target Price Visualization */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 w-64 text-right">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t("Target Price (AI)", "目标价 (AI预测)")}</p>
              <div className="flex justify-end items-baseline gap-2">
                <span className="text-3xl font-black text-blue-900">{report.analyst.targetPrice}</span>
                <span className="text-sm font-bold text-emerald-600">{report.analyst.upside}</span>
              </div>
              
              <div className="mt-2 pt-2 border-t border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{t("Wall Street Avg", "华尔街平均估值")}</p>
                {analystTarget !== null ? (
                  <span className="text-xl font-bold text-slate-700">${analystTarget.toFixed(2)}</span>
                ) : (
                  <span className="text-xs text-slate-400 italic">{t("Loading...", "加载中...")}</span>
                )}
              </div>

              <div className="text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-200 flex justify-end gap-3">
                <span>{t("Buy", "买入")}: {report.analyst.breakdown.buy}</span>
                <span>{t("Hold", "持有")}: {report.analyst.breakdown.hold}</span>
                <span>{t("Sell", "卖出")}: {report.analyst.breakdown.sell}</span>
              </div>
            </div>
          </div>

          {/* Scores */}
          <div className="report-section grid grid-cols-2 gap-6 mb-8">
            <div className="border border-slate-200 rounded-xl p-5 bg-gradient-to-br from-purple-50 to-white relative overflow-hidden print:bg-purple-50">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-bold text-slate-600 uppercase flex items-center gap-2">
                  <ActivitySquare className="w-4 h-4 text-purple-600" /> {t("Technical Score", "技术面评分")}
                </h3>
                <span className="text-4xl font-black text-purple-900">{report.technicalScore}</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div className="bg-purple-600 h-full rounded-full" style={{ width: `${report.technicalScore}%` }} />
              </div>
              <p className="text-xs text-slate-500 mt-3 font-medium">{t("Momentum & Trend Analysis", "动量与趋势分析")}</p>
            </div>

            <div className="border border-slate-200 rounded-xl p-5 bg-gradient-to-br from-amber-50 to-white relative overflow-hidden print:bg-amber-50">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-bold text-slate-600 uppercase flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-600" /> {t("Fundamental Score", "基本面评分")}
                </h3>
                <span className="text-4xl font-black text-amber-900">{report.fundamentalScore}</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div className="bg-amber-600 h-full rounded-full" style={{ width: `${report.fundamentalScore}%` }} />
              </div>
              <p className="text-xs text-slate-500 mt-3 font-medium">{t("Profitability & Growth Metrics", "盈利能力与成长性指标")}</p>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="report-section mb-8 border-l-4 border-blue-600 pl-5">
            <h3 className="text-lg font-bold text-slate-800 mb-2">{t("Executive Summary", "核心摘要")}</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{report.overview}</p>
          </div>

          {/* Fundamentals */}
          <div className="report-section mb-8">
            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-widest mb-3 flex items-center gap-2 border-b border-slate-200 pb-2">
              <TrendingUp className="w-4 h-4 text-blue-600" /> {t("Fundamental Analysis", "基本面分析")}
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">{report.fundamentals}</p>
          </div>

          {/* Detailed Analysis Grid */}
          <div className="report-section grid grid-cols-2 gap-x-8 gap-y-6 mb-8">
            {/* Rationale */}
            <div>
              <h3 className="text-sm font-bold text-emerald-700 uppercase tracking-widest mb-3 flex items-center gap-2 border-b border-slate-200 pb-2">
                <Zap className="w-4 h-4" /> {t("Bull Case (Rationale)", "看多逻辑")}
              </h3>
              <ul className="space-y-3">
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
              <ul className="space-y-3">
                {report.risks.map((item, i) => (
                  <li key={i} className="text-sm text-slate-700 leading-relaxed flex gap-2">
                    <span className="text-red-500 font-bold shrink-0">•</span> <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Catalysts & Action */}
          <div className="report-section bg-slate-50 border border-slate-200 rounded-xl p-6 mb-8 print:bg-slate-50">
            <h3 className="text-sm font-bold text-blue-700 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Rocket className="w-4 h-4" /> {t("Upcoming Catalysts & Triggers", "核心催化事件")}
            </h3>
            <ul className="space-y-3 mb-6">
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

            <div className="pt-4 border-t border-slate-200">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{t("Position Suggestion", "持仓建议")}</h4>
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
    </>
  );
}
