"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2, Printer, ChevronLeft, Target, ShieldAlert, Zap, TrendingUp, Users, ActivitySquare, Rocket, Gem } from "lucide-react";
import Link from "next/link";
import type { StockAnalysisReport } from "@/lib/analysis-engine";

export default function ReportPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  
  const symbol = params.symbol as string;
  const strategy = searchParams.get("strategy") || "large_growth";
  
  const [report, setReport] = useState<StockAnalysisReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;
    
    async function fetchReport() {
      try {
        setLoading(true);
        const res = await fetch(`/api/analysis?symbol=${symbol}&strategy=${strategy}`);
        if (!res.ok) throw new Error("Failed to load report");
        const data = await res.json();
        setReport(data.report);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }

    fetchReport();
  }, [symbol, strategy]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Generating Institutional Report...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <ShieldAlert className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">Error Loading Report</h2>
        <p className="text-slate-500">{error}</p>
        <Link href="/" className="mt-6 text-blue-600 hover:underline">Return to Screener</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white text-slate-900 font-sans pb-20">
      {/* Floating Action Bar (hidden when printing) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 flex justify-center gap-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] print:hidden z-50">
        <button 
          onClick={() => window.close()} 
          className="px-6 py-2.5 rounded-lg font-semibold text-slate-600 hover:bg-slate-100 flex items-center gap-2"
        >
          <ChevronLeft className="w-5 h-5" /> Close
        </button>
        <button 
          onClick={() => window.print()} 
          className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-blue-500/30 transition-all hover:scale-105"
        >
          <Printer className="w-5 h-5" /> Print / Save as PDF
        </button>
      </div>

      {/* A4 Page Container */}
      <div className="max-w-[800px] mx-auto bg-white print:shadow-none shadow-xl print:m-0 mt-8 mb-24 min-h-[1122px] p-10 relative">
        
        {/* Header */}
        <header className="border-b-2 border-blue-900 pb-6 mb-8 flex justify-between items-end">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center">
                <Gem className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-black text-blue-900 tracking-tight">GEMS QUANT</h1>
            </div>
            <p className="text-sm font-semibold text-slate-500 tracking-widest uppercase">AI Investment Research Report</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 font-mono">Date: {new Date().toLocaleDateString()}</p>
            <p className="text-xs text-slate-400 font-mono mt-1">Strategy: {strategy.toUpperCase()}</p>
          </div>
        </header>

        {/* Company Title & Price Action */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h2 className="text-4xl font-black text-slate-900 flex items-center gap-3">
              {report.symbol}
            </h2>
            <p className="text-slate-500 mt-1">{report.analyst.consensus} Consensus Rating</p>
          </div>
          
          {/* Target Price Visualization */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 w-64 text-right">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Target Price</p>
            <div className="flex justify-end items-baseline gap-2">
              <span className="text-3xl font-black text-blue-900">{report.analyst.targetPrice}</span>
              <span className="text-sm font-bold text-emerald-600">{report.analyst.upside}</span>
            </div>
          </div>
        </div>

        {/* Scores */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="border border-slate-200 rounded-xl p-5 bg-gradient-to-br from-purple-50 to-white relative overflow-hidden">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-sm font-bold text-slate-600 uppercase flex items-center gap-2">
                <ActivitySquare className="w-4 h-4 text-purple-600" /> Technical Score
              </h3>
              <span className="text-4xl font-black text-purple-900">{report.technicalScore}</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div className="bg-purple-600 h-full rounded-full" style={{ width: `${report.technicalScore}%` }} />
            </div>
            <p className="text-xs text-slate-500 mt-3 font-medium">Momentum & Trend Analysis</p>
          </div>

          <div className="border border-slate-200 rounded-xl p-5 bg-gradient-to-br from-amber-50 to-white relative overflow-hidden">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-sm font-bold text-slate-600 uppercase flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-600" /> Fundamental Score
              </h3>
              <span className="text-4xl font-black text-amber-900">{report.fundamentalScore}</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div className="bg-amber-600 h-full rounded-full" style={{ width: `${report.fundamentalScore}%` }} />
            </div>
            <p className="text-xs text-slate-500 mt-3 font-medium">Profitability & Growth Metrics</p>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="mb-8 border-l-4 border-blue-600 pl-5">
          <h3 className="text-lg font-bold text-slate-800 mb-2">Executive Summary</h3>
          <p className="text-sm text-slate-600 leading-relaxed">{report.overview}</p>
        </div>

        {/* Detailed Analysis Grid */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-6 mb-8">
          {/* Rationale */}
          <div>
            <h3 className="text-sm font-bold text-emerald-700 uppercase tracking-widest mb-3 flex items-center gap-2 border-b border-slate-200 pb-2">
              <Zap className="w-4 h-4" /> Bull Case (Rationale)
            </h3>
            <ul className="space-y-3">
              {report.rationale.map((item, i) => (
                <li key={i} className="text-sm text-slate-700 leading-relaxed flex gap-2">
                  <span className="text-emerald-500 font-bold">•</span> <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Risks */}
          <div>
            <h3 className="text-sm font-bold text-red-700 uppercase tracking-widest mb-3 flex items-center gap-2 border-b border-slate-200 pb-2">
              <ShieldAlert className="w-4 h-4" /> Bear Case (Risks)
            </h3>
            <ul className="space-y-3">
              {report.risks.map((item, i) => (
                <li key={i} className="text-sm text-slate-700 leading-relaxed flex gap-2">
                  <span className="text-red-500 font-bold">•</span> <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Catalysts & Action */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-8">
          <h3 className="text-sm font-bold text-blue-700 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Rocket className="w-4 h-4" /> Upcoming Catalysts & Triggers
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
              <li className="text-sm text-slate-500 italic">No specific near-term catalysts identified.</li>
            )}
          </ul>

          <div className="pt-4 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Position Suggestion</h4>
            <p className="text-sm text-slate-800 font-medium">{report.positionSuggestion}</p>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-slate-200 text-center text-xs text-slate-400">
          <p>Generated by Gems AI Quant Screener. Not financial advice.</p>
          <p className="mt-1">For institutional use only. Data subject to market conditions.</p>
        </footer>

      </div>
    </div>
  );
}
