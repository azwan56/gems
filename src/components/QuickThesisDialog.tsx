"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  X, Sparkles, Target, Users, ActivitySquare, ShieldAlert,
  Compass, Zap, Rocket, FileText, Download, Loader2, Plus, Check
} from "lucide-react";
import type { StockMetrics } from "@/lib/types";
import type { StockAnalysisReport } from "@/lib/analysis-engine";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { SectorWindBadge } from "@/components/SectorWindBadge";
import { TextWithTooltips } from "@/components/TermTooltip";

let cachedDisplayTransitionSupport: boolean | undefined;

function canTransitionDisplay(): boolean {
  if (cachedDisplayTransitionSupport !== undefined) return cachedDisplayTransitionSupport;
  if (
    typeof window === "undefined" ||
    !window.CSS?.supports?.("transition-behavior", "allow-discrete") ||
    !document.body
  ) {
    return false;
  }
  const probe = document.createElement("div");
  probe.style.cssText = "transition: display 1s allow-discrete !important; display: block;";
  document.body.appendChild(probe);
  getComputedStyle(probe).display;
  probe.style.display = "none";
  cachedDisplayTransitionSupport = getComputedStyle(probe).display === "block";
  probe.remove();
  return cachedDisplayTransitionSupport;
}

function supportsTopLayerExit(): boolean {
  return typeof window !== "undefined" && Boolean(window.CSS?.supports?.("overlay", "auto")) && canTransitionDisplay();
}

export async function closeDialogSmoothly(dialog: HTMLDialogElement | null) {
  if (!dialog || !dialog.open) return;
  if (!supportsTopLayerExit()) {
    dialog.setAttribute("data-closing", "");
    const animations = dialog.getAnimations({ subtree: true });
    if (animations.length > 0) {
      await Promise.race([
        Promise.allSettled(animations.map((a) => a.finished)),
        new Promise((r) => setTimeout(r, 400)),
      ]);
    }
    if (!dialog.hasAttribute("data-closing")) return;
    dialog.removeAttribute("data-closing");
  }
  if (dialog.open) {
    dialog.close();
  }
}

interface QuickThesisDialogProps {
  stock: StockMetrics | null;
  strategyId?: string;
  strategyLabel?: string;
  onClose: () => void;
  inWatchlist?: boolean;
  onToggleWatchlist?: (symbol: string) => void;
  onAskAi?: (stock: StockMetrics) => void;
  onLocateRrg?: (ctx: { etf?: string | null; subEtf?: string | null; symbol?: string | null }) => void;
}

export default function QuickThesisDialog({
  stock,
  strategyId = "large_growth",
  strategyLabel,
  onClose,
  inWatchlist = false,
  onToggleWatchlist,
  onAskAi,
  onLocateRrg,
}: QuickThesisDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const { lang, t } = useLanguage();
  const { getIdToken } = useAuth();

  const [report, setReport] = useState<StockAnalysisReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [shareCardUrl, setShareCardUrl] = useState<string | null>(null);
  const [generatingCard, setGeneratingCard] = useState(false);

  const handleRequestClose = useCallback(() => {
    closeDialogSmoothly(dialogRef.current);
  }, []);

  // Sync native <dialog> modal open/close lifecycle + Safari closedby fallback
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (stock) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      closeDialogSmoothly(dialog);
    }
  }, [stock]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const onNativeClose = () => {
      dialog.returnValue = "";
      dialog.removeAttribute("data-closing");
      onClose();
    };

    const onCancel = (event: Event) => {
      event.preventDefault();
      closeDialogSmoothly(dialog);
    };

    // Fallback for browsers without <dialog closedby> support (e.g. Safari)
    const supportsClosedBy = typeof HTMLDialogElement !== "undefined" && "closedBy" in HTMLDialogElement.prototype;
    const onBackdropClick = (event: MouseEvent) => {
      if (supportsClosedBy) return;
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isDialogContent =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (isDialogContent) return;
      closeDialogSmoothly(dialog);
    };

    dialog.addEventListener("close", onNativeClose);
    dialog.addEventListener("cancel", onCancel);
    if (!supportsClosedBy) {
      dialog.addEventListener("click", onBackdropClick);
    }

    return () => {
      dialog.removeEventListener("close", onNativeClose);
      dialog.removeEventListener("cancel", onCancel);
      if (!supportsClosedBy) {
        dialog.removeEventListener("click", onBackdropClick);
      }
    };
  }, [onClose]);

  // Fetch live AI thesis from /api/analysis
  useEffect(() => {
    if (!stock) {
      setReport(null);
      setShareCardUrl(null);
      return;
    }
    let cancelled = false;
    const loadAnalysis = async () => {
      setLoading(true);
      setReport(null);
      setShareCardUrl(null);
      try {
        const token = await getIdToken();
        const res = await fetch(
          `/api/analysis?symbol=${encodeURIComponent(stock.symbol)}&strategy=${encodeURIComponent(strategyId)}&lang=${lang}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }
        );
        if (res.ok && !cancelled) {
          const data = await res.json();
          setReport(data.report || null);
        }
      } catch (err) {
        console.error("[QuickThesisDialog] Failed to fetch analysis:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadAnalysis();
    return () => {
      cancelled = true;
    };
  }, [stock, strategyId, lang, getIdToken]);

  // Lazy share-card generator on demand
  const handleDownloadCard = async () => {
    if (!stock || !report) return;
    if (shareCardUrl) {
      const { downloadShareCard } = await import("@/lib/share-card");
      downloadShareCard(shareCardUrl, stock.symbol);
      return;
    }
    setGeneratingCard(true);
    try {
      let shareId = "";
      try {
        const res = await fetch("/api/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol: stock.symbol,
            strategy: strategyId,
            strategyName: strategyLabel || strategyId,
            report,
            metrics: stock,
          }),
        });
        if (res.ok) {
          const d = await res.json();
          shareId = d.shareId || "";
        }
      } catch {
        // Non-blocking
      }
      const { generateShareCardDataURL, downloadShareCard } = await import("@/lib/share-card");
      const url = await generateShareCardDataURL(stock, report, lang, strategyLabel || strategyId, shareId);
      setShareCardUrl(url);
      downloadShareCard(url, stock.symbol);
    } catch (err) {
      console.error("[QuickThesisDialog] Share card error:", err);
    } finally {
      setGeneratingCard(false);
    }
  };

  const parsePrice = (val?: string | null): number | null => {
    if (!val) return null;
    const cleaned = Number.parseFloat(String(val).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(cleaned) && cleaned > 0 ? cleaned : null;
  };

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: "any" } as React.DialogHTMLAttributes<HTMLDialogElement>)}
      aria-labelledby="quick-thesis-title"
      className="vp-drawer"
    >
      {stock && (
        <div className="h-full w-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col overflow-hidden text-slate-100">
          {/* Sticky Top Header */}
          <div className="shrink-0 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800 px-4 sm:px-6 py-3.5 sm:py-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="quick-thesis-title" className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  {stock.symbol}
                </h2>
                <span className="text-sm sm:text-base font-mono font-bold text-cyan-300">
                  ${stock.price ? stock.price.toFixed(2) : "—"}
                </span>
                {stock.sector && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[11px] font-medium text-slate-300 truncate max-w-[160px]">
                    {stock.sector}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">{stock.companyName}</p>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {onToggleWatchlist && (
                <button
                  type="button"
                  onClick={() => onToggleWatchlist(stock.symbol)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1 cursor-pointer ${
                    inWatchlist
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                      : "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                  }`}
                >
                  {inWatchlist ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{inWatchlist ? t("Saved", "已加自选") : t("Watchlist", "加自选")}</span>
                </button>
              )}

              {onAskAi && (
                <button
                  type="button"
                  onClick={() => onAskAi(stock)}
                  className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold flex items-center gap-1 shadow-sm cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t("Ask AI", "问 AI")}</span>
                </button>
              )}

              <button
                type="button"
                autoFocus
                onClick={handleRequestClose}
                aria-label={t("Close analysis drawer", "关闭分析抽屉")}
                className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/80 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
                <p className="text-sm font-medium text-slate-300">
                  {t("Synthesizing institutional thesis & dual targets...", "正在实时聚合双目标价与多维研判信号...")}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {t("Combining FMP fundamentals, 27-Sector RRG & Gemini 3.5", "联动 FMP 财务底座、27 板块 RRG 轮动与 AI 定性引擎")}
                </p>
              </div>
            ) : report ? (
              <>
                {/* 1. Dual Price Target & Visual Range Gauge */}
                {(() => {
                  const wsStr = report.analyst.wallStreetTargetPrice || report.analyst.targetPrice;
                  const wsUp = report.analyst.wallStreetUpside || report.analyst.upside;
                  const aiStr = report.analyst.aiTargetPrice;
                  const aiUp = report.analyst.aiUpside;
                  const hasDual = Boolean(wsStr && aiStr && wsStr !== aiStr);

                  const curr = stock.price || 0;
                  const wsNum = parsePrice(wsStr);
                  const aiNum = parsePrice(aiStr);
                  const allPrices = [curr, wsNum, aiNum].filter((v): v is number => Boolean(v && v > 0));
                  const minP = allPrices.length > 1 ? Math.min(...allPrices) * 0.92 : 0;
                  const maxP = allPrices.length > 1 ? Math.max(...allPrices) * 1.06 : 0;
                  const pctPos = (v: number | null) =>
                    v && maxP > minP ? Math.max(4, Math.min(96, ((v - minP) / (maxP - minP)) * 100)) : null;

                  return (
                    <section className="rounded-xl bg-slate-950/70 border border-slate-800 p-3.5 sm:p-4 space-y-3">
                      <div className={`grid gap-2.5 ${hasDual ? "grid-cols-3" : "grid-cols-2"}`}>
                        <div className="rounded-lg bg-blue-950/30 border border-blue-500/25 p-2.5 sm:p-3">
                          <div className="flex items-center gap-1 text-blue-400 text-[11px] font-bold uppercase tracking-wider mb-1">
                            <Target className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{t("Wall St Target", "华尔街共识")}</span>
                          </div>
                          <div className="text-base sm:text-xl font-extrabold font-mono text-white truncate">
                            {wsStr || "—"}
                          </div>
                          <div className={`text-[11px] font-mono font-semibold mt-0.5 ${(wsUp || "").startsWith("-") ? "text-rose-400" : "text-emerald-400"}`}>
                            {wsUp || "—"}
                          </div>
                        </div>

                        {hasDual && (
                          <div className="rounded-lg bg-purple-950/30 border border-purple-500/25 p-2.5 sm:p-3">
                            <div className="flex items-center gap-1 text-purple-400 text-[11px] font-bold uppercase tracking-wider mb-1">
                              <Sparkles className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{t("AI Fair Value", "AI 前瞻重估")}</span>
                            </div>
                            <div className="text-base sm:text-xl font-extrabold font-mono text-white truncate">
                              {aiStr}
                            </div>
                            <div className={`text-[11px] font-mono font-semibold mt-0.5 ${(aiUp || "").startsWith("-") ? "text-rose-400" : "text-emerald-400"}`}>
                              {aiUp || "—"}
                            </div>
                          </div>
                        )}

                        <div className="rounded-lg bg-slate-900/90 border border-slate-800 p-2.5 sm:p-3">
                          <div className="flex items-center gap-1 text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-1">
                            <Users className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{t("Rating", "机构评级")}</span>
                          </div>
                          <div className="text-sm sm:text-lg font-extrabold text-emerald-400 truncate">
                            {report.analyst.consensus}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                            {t("Buy", "买")}:{report.analyst.breakdown.buy} · {t("Hold", "持")}:{report.analyst.breakdown.hold} · {t("Sell", "卖")}:{report.analyst.breakdown.sell}
                          </div>
                        </div>
                      </div>

                      {allPrices.length > 1 && curr > 0 && (
                        <div className="pt-1">
                          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mb-1.5">
                            <span>{t("Now", "现价")} <strong className="text-cyan-300">${curr.toFixed(2)}</strong></span>
                            {wsNum && <span>{t("Wall St", "华尔街")} <strong className="text-blue-400">${wsNum.toFixed(2)}</strong></span>}
                            {aiNum && aiNum !== wsNum && <span>{t("AI Model", "AI重估")} <strong className="text-purple-400">${aiNum.toFixed(2)}</strong></span>}
                          </div>
                          <div className="relative h-2 rounded-full bg-slate-800 overflow-visible">
                            <div
                              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-500/40 via-blue-500/50 to-purple-500/60"
                              style={{ width: `${Math.max(pctPos(curr) || 20, pctPos(wsNum) || 50, pctPos(aiNum) || 50)}%` }}
                            />
                            {pctPos(curr) !== null && (
                              <span
                                title={`Current $${curr.toFixed(2)}`}
                                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-cyan-400 ring-2 ring-slate-950 shadow"
                                style={{ left: `${pctPos(curr)}%` }}
                              />
                            )}
                            {pctPos(wsNum) !== null && (
                              <span
                                title={`Wall St $${wsNum?.toFixed(2)}`}
                                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-blue-400 ring-2 ring-slate-950"
                                style={{ left: `${pctPos(wsNum)}%` }}
                              />
                            )}
                            {aiNum && aiNum !== wsNum && pctPos(aiNum) !== null && (
                              <span
                                title={`AI Fair Value $${aiNum.toFixed(2)}`}
                                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-purple-400 ring-2 ring-slate-950"
                                style={{ left: `${pctPos(aiNum)}%` }}
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </section>
                  );
                })()}

                {/* 2. Three-Pillar Conviction Scores */}
                <section className="grid grid-cols-3 gap-2.5">
                  <div className="rounded-xl bg-slate-800/45 border border-slate-700/70 p-3">
                    <div className="flex items-center gap-1 text-purple-400 text-[11px] font-bold uppercase mb-1">
                      <ActivitySquare className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{t("Technical", "技术面")}</span>
                    </div>
                    <div className="text-lg sm:text-2xl font-extrabold font-mono text-white">
                      {report.technicalScore}<span className="text-xs text-slate-500 font-normal">/100</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-950 mt-1.5 overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${report.technicalScore}%` }} />
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-800/45 border border-slate-700/70 p-3">
                    <div className="flex items-center gap-1 text-amber-400 text-[11px] font-bold uppercase mb-1">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{t("Fundamental", "基本面")}</span>
                    </div>
                    <div className="text-lg sm:text-2xl font-extrabold font-mono text-white">
                      {report.fundamentalScore}<span className="text-xs text-slate-500 font-normal">/100</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-950 mt-1.5 overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${report.fundamentalScore}%` }} />
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-800/45 border border-slate-700/70 p-3">
                    <div className="flex items-center gap-1 text-cyan-400 text-[11px] font-bold uppercase mb-1">
                      <Compass className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{t("Sector RRG", "板块顺风")}</span>
                    </div>
                    <div className="text-lg sm:text-2xl font-extrabold font-mono text-white">
                      {report.sectorScore ?? 50}<span className="text-xs text-slate-500 font-normal">/100</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-950 mt-1.5 overflow-hidden">
                      <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${report.sectorScore ?? 50}%` }} />
                    </div>
                  </div>
                </section>

                {/* 3. Core Signal Takeaways: Bullish Rationale, Catalysts & Risks */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <section className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3.5">
                    <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5" /> {t("Bullish Thesis", "核心看多逻辑")}
                    </h3>
                    <ul className="space-y-1.5 text-xs sm:text-sm text-slate-300">
                      {report.rationale.slice(0, 4).map((line, i) => (
                        <li key={i} className="flex gap-2 leading-relaxed">
                          <span className="text-emerald-400 shrink-0">•</span>
                          <span><TextWithTooltips text={line} /></span>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="rounded-xl bg-rose-500/5 border border-rose-500/20 p-3.5">
                    <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5" /> {t("Key Risks", "核心防守风险")}
                    </h3>
                    <ul className="space-y-1.5 text-xs sm:text-sm text-slate-300">
                      {report.risks.slice(0, 4).map((line, i) => (
                        <li key={i} className="flex gap-2 leading-relaxed">
                          <span className="text-rose-400 shrink-0">•</span>
                          <span><TextWithTooltips text={line} /></span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>

                {report.catalysts && report.catalysts.length > 0 && (
                  <section className="rounded-xl bg-blue-500/5 border border-blue-500/20 p-3.5">
                    <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Rocket className="w-3.5 h-3.5" /> {t("Upcoming Catalysts", "近期催化剂")}
                    </h3>
                    <ul className="space-y-1.5 text-xs sm:text-sm text-slate-300">
                      {report.catalysts.map((line, i) => (
                        <li key={i} className="flex gap-2 leading-relaxed">
                          <span className="text-blue-400 shrink-0">•</span>
                          <span><TextWithTooltips text={line} /></span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* 4. Top-Down Sector Rotation Context */}
                {report.sectorRotation && (
                  <section className="rounded-xl bg-slate-800/40 border border-slate-700/70 p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Compass className="w-3.5 h-3.5" /> {t("27-Sector RRG Alignment", "27 板块 RRG 轮动契合度")}
                      </span>
                      <div className="flex items-center gap-2">
                        {onLocateRrg && (
                          <button
                            type="button"
                            onClick={() =>
                              onLocateRrg({
                                etf: report.sectorRotation?.etf,
                                subEtf: report.sectorRotation?.subIndustryETF,
                                symbol: stock.symbol,
                              })
                            }
                            className="px-2 py-0.5 rounded bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-[11px] text-blue-300 font-medium cursor-pointer"
                          >
                            {t("Locate on RRG", "四象限定位")}
                          </button>
                        )}
                        <SectorWindBadge
                          wind={report.sectorRotation.windStatus}
                          quadrant={report.sectorRotation.quadrant}
                          etf={report.sectorRotation.etf}
                          subIndustryETF={report.sectorRotation.subIndustryETF}
                          subIndustryName={report.sectorRotation.subIndustryName}
                          subIndustryQuadrant={report.sectorRotation.subIndustryQuadrant}
                          subIndustryWind={report.sectorRotation.subIndustryWind}
                        />
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      <TextWithTooltips text={report.sectorRotation.advice} />
                    </p>
                  </section>
                )}

                {/* 5. Progressive Disclosure: Detailed Company & Fundamental Breakdown */}
                <details className="group rounded-xl bg-slate-950/60 border border-slate-800 overflow-hidden">
                  <summary className="px-4 py-3 cursor-pointer list-none flex items-center justify-between text-xs sm:text-sm font-semibold text-slate-200 hover:bg-slate-800/40 transition-colors">
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-cyan-400" />
                      {t("Expand Full Business, Moat & Fundamental Narrative", "展开完整公司业务、护城河与财务基本面详述")}
                    </span>
                    <span className="text-xs text-slate-400 group-open:rotate-180 transition-transform">▾</span>
                  </summary>
                  <div className="px-4 pb-4 pt-2 space-y-3 border-t border-slate-800/80 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    <div>
                      <div className="text-[11px] font-bold uppercase text-slate-400 mb-1">{t("Overview", "公司概况")}</div>
                      <p><TextWithTooltips text={report.overview} /></p>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase text-slate-400 mb-1">{t("Fundamentals", "财务与估值")}</div>
                      <p><TextWithTooltips text={report.fundamentals} /></p>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase text-slate-400 mb-1">{t("Products & Moat", "产品与护城河")}</div>
                      <p><TextWithTooltips text={report.products} /></p>
                    </div>
                  </div>
                </details>
              </>
            ) : (
              <div className="py-16 text-center text-sm text-slate-400">
                {t("Unable to load live analysis right now. Try opening the full report.", "暂时无法加载实时速览，请点击下方查看完整研报。")}
              </div>
            )}
          </div>

          {/* Sticky Footer Actions */}
          <div className="shrink-0 bg-slate-950/90 border-t border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleDownloadCard}
              disabled={!report || generatingCard}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs sm:text-sm font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {generatingCard ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-cyan-400" />}
              <span>{t("Share Card", "生成分享长图")}</span>
            </button>

            <Link
              href={`/report/${stock.symbol}?strategy=${strategyId}&lang=${lang}`}
              target="_blank"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-500/20 transition-all"
            >
              <FileText className="w-4 h-4" />
              <span>{t("Open Full Deep-Dive PDF Report ↗", "打开完整深度研报 (PDF) ↗")}</span>
            </Link>
          </div>
        </div>
      )}
    </dialog>
  );
}
