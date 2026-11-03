"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ShieldCheck, TrendingUp, Activity, Gem, Rocket, Languages, BookOpen,
  Castle, Zap, ChevronRight, Cpu, Sparkles, Network, Layers, Presentation,
  Briefcase, Compass, ArrowUpRight, Sun, Flame, Target, Plus, Check, FileText
} from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import type { StockMetrics, StrategyPreset } from "@/lib/types";
import { applyFilters } from "@/lib/screener-engine";
import UserMenu from "@/components/UserMenu";
import PremiumGate from "@/components/PremiumGate";
import { TermTooltip } from "@/components/TermTooltip";
import { SectorWindBadge } from "@/components/SectorWindBadge";
import RrgQuadrantChart from "@/components/RrgQuadrantChart";
import QuickThesisDialog from "@/components/QuickThesisDialog";
import StockChatAssistant from "@/components/StockChatAssistant";

const PYTHON_BACKEND =
  process.env.NEXT_PUBLIC_PYTHON_BACKEND_URL ||
  "https://gems-backend-oc26gauvga-uc.a.run.app";

const DAILYSTOCK_URL = "https://dailystock.vanpower.live";

const strategies = [
  {
    id: "value",
    name: "Value Investing",
    nameZh: "价值投资",
    description: "Fundamentally strong cash cows trading below intrinsic value with wide margin of safety.",
    descriptionZh: "基本面稳健但被低估的现金牛标的，强调高安全边际与自由现金流。",
    icon: ShieldCheck,
    color: "blue",
    metrics: [
      { label: "P/E Ratio", term: "P/E Ratio", value: "< 15.0" },
      { label: "P/B Ratio", term: "P/B Ratio", value: "< 1.5" },
      { label: "FCF Yield", term: "FCF Yield", value: "> 5.0%" },
    ],
  },
  {
    id: "large_growth",
    name: "Large-Cap Growth",
    nameZh: "大型成长股",
    description: "Nasdaq-100 global compounders with dominant moats, pricing power, and resilient cash flow.",
    descriptionZh: "Nasdaq-100 级别科技与消费巨头，垄断护城河深厚，现金流充沛。",
    icon: TrendingUp,
    color: "indigo",
    metrics: [
      { label: "Market Cap", value: "> $100B" },
      { label: "Rev Growth", value: "> 15%" },
      { label: "FCF Yield", term: "FCF Yield", value: "> 3%" },
    ],
  },
  {
    id: "small_growth",
    name: "Small/Mid-Cap Growth",
    nameZh: "中小盘成长股",
    description: "High-velocity disruptors capturing emerging secular trends with >30% revenue expansion.",
    descriptionZh: "依赖技术突破的细分赛道高增先锋，营收增速超 30%，弹性极强。",
    icon: Rocket,
    color: "purple",
    metrics: [
      { label: "Market Cap", value: "< $10B" },
      { label: "Rev Growth", value: "> 30%" },
      { label: "Momentum (50SMA)", term: "50SMA", value: "vs 50SMA > 0" },
    ],
  },
  {
    id: "garp",
    name: "GARP",
    nameZh: "合理价格成长",
    description: "Peter Lynch style balance: >20% EPS growth paired with disciplined PEG < 1.0 valuation.",
    descriptionZh: "彼得·林奇均衡范式：兼顾 >20% 盈利高增与 PEG < 1.0 的克制估值。",
    icon: TrendingUp,
    color: "emerald",
    metrics: [
      { label: "EPS Growth", value: "> 20%" },
      { label: "PEG Ratio", term: "PEG Ratio", value: "< 1.0" },
      { label: "Market Cap", value: "> $500M" },
    ],
  },
  {
    id: "wide_moat",
    name: "Wide Moat",
    nameZh: "深宽护城河",
    description: "Enduring franchises with superior ROE > 15%, gross margin > 40%, and low leverage.",
    descriptionZh: "具备持久定价权与复利壁垒，高 ROE (>15%)、高毛利 (>40%)、低负债。",
    icon: Castle,
    color: "slate",
    metrics: [
      { label: "ROE", term: "ROE", value: "> 15%" },
      { label: "Gross Margin", term: "Gross Margin", value: "> 40%" },
      { label: "D/E Ratio", term: "D/E Ratio", value: "< 1.0" },
    ],
  },
  {
    id: "short_term_catalyst",
    name: "Short-Term Catalyst",
    nameZh: "短线催化剂",
    description: "Technical trend alignment above 50/200 SMA coupled with fundamental acceleration.",
    descriptionZh: "站稳 50/200 日均线多头排列，叠加基本面加速的右侧动量突破。",
    icon: Zap,
    color: "rose",
    metrics: [
      { label: "Price vs 50SMA", term: "50SMA", value: "> 0%" },
      { label: "Price vs 200SMA", term: "200SMA", value: "> 0%" },
      { label: "Rev Growth", value: "> 5%" },
    ],
  },
  {
    id: "seeking_alpha",
    name: "Seeking Alpha Picks",
    nameZh: "Seeking Alpha 精选",
    description: "Direct qualitative & technical funnel for your curated Seeking Alpha alpha watchlist.",
    descriptionZh: "Seeking Alpha 精选跟踪池，跳过初筛直达 AI 定性深研与双目标价测算。",
    icon: BookOpen,
    color: "amber",
    metrics: [
      { label: "Source", value: "Seeking Alpha" },
      { label: "Screening", value: "Direct Funnel" },
      { label: "Focus", value: "AI Deep Dive" },
    ],
  },
];

interface SectorItem {
  etf: string;
  name: string;
  quadrant: string;
  action: string;
  netScore: number;
  recommendedStocks?: string[];
}

interface SectorRotationPayload {
  date: string;
  macroPhase: string;
  favoredSectors: string[];
  avoidSectors: string[];
  sectors: Record<string, Omit<SectorItem, "etf">>;
}

interface AuditWinRate {
  id: string;
  name: string;
  nameZh: string;
  t5WinRate: number;
  t20WinRate: number;
  t60WinRate: number;
  status: string;
}

interface AuditShowcaseItem {
  symbol: string;
  companyName: string;
  strategyId: string;
  entryDate: string;
  entryPrice: number;
  currentPrice: number;
  returnPct: number;
  status: string;
  keyRationaleZh?: string;
  keyRationaleEn?: string;
}

interface DailyStockShowcase {
  market_status?: {
    is_open: boolean;
    cst_time?: string;
    scene_mode?: string;
    scene_title?: string;
    scene_desc?: string;
  };
  indices?: Record<string, { price: number; change: number; change_abs: number }>;
  macro_brief?: { title?: string; date_str?: string; summary?: string };
  macro_liquidity?: { t10y2y?: string; t10y2y_status?: string; liquidity_tone?: string };
  market_breadth?: { advance_percent?: string; breadth_label?: string; breadth_desc?: string };
  premarket_anomalies?: Array<{
    symbol: string;
    company_name: string;
    premarket_price: string;
    gap_percent: string;
    is_up?: boolean;
    catalyst_type?: string;
    catalyst_summary?: string;
    setup_name?: string;
    key_support?: string;
    key_resistance?: string;
  }>;
}

interface ResonancePick extends StockMetrics {
  matchedStrategies: { id: string; name: string; nameZh: string; color: string }[];
  matchCount: number;
}

const colorStyles: Record<string, { iconBox: string; accentText: string; hoverBorder: string }> = {
  blue: {
    iconBox: "bg-blue-500/15 border-blue-500/30 text-blue-400",
    accentText: "text-blue-400",
    hoverBorder: "hover:border-blue-500/50",
  },
  indigo: {
    iconBox: "bg-indigo-500/15 border-indigo-500/30 text-indigo-400",
    accentText: "text-indigo-400",
    hoverBorder: "hover:border-indigo-500/50",
  },
  purple: {
    iconBox: "bg-purple-500/15 border-purple-500/30 text-purple-400",
    accentText: "text-purple-400",
    hoverBorder: "hover:border-purple-500/50",
  },
  emerald: {
    iconBox: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
    accentText: "text-emerald-400",
    hoverBorder: "hover:border-emerald-500/50",
  },
  slate: {
    iconBox: "bg-cyan-500/15 border-cyan-500/30 text-cyan-400",
    accentText: "text-cyan-400",
    hoverBorder: "hover:border-cyan-500/50",
  },
  rose: {
    iconBox: "bg-rose-500/15 border-rose-500/30 text-rose-400",
    accentText: "text-rose-400",
    hoverBorder: "hover:border-rose-500/50",
  },
  amber: {
    iconBox: "bg-amber-500/15 border-amber-500/30 text-amber-400",
    accentText: "text-amber-400",
    hoverBorder: "hover:border-amber-500/50",
  },
};

export default function Home() {
  const { lang, setLang, t } = useLanguage();
  const { user, firebaseUser, getIdToken, loading: authLoading } = useAuth();

  // Dual-Core mode: "gems" (Quant Alpha Screener) vs "dailystock" (Macro & Market Pulse Preview)
  const [activeCore, setActiveCore] = useState<"gems" | "dailystock">("gems");

  // Live public data
  const [rotation, setRotation] = useState<SectorRotationPayload | null>(null);
  const [winRates, setWinRates] = useState<AuditWinRate[]>([]);
  const [auditShowcase, setAuditShowcase] = useState<AuditShowcaseItem[]>([]);
  const [dsShowcase, setDsShowcase] = useState<DailyStockShowcase | null>(null);

  // Live authenticated premium data (Top Multi-Strategy Alpha Radar)
  const [poolStocks, setPoolStocks] = useState<StockMetrics[]>([]);
  const [presets, setPresets] = useState<StrategyPreset[]>([]);
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [targetPrices, setTargetPrices] = useState<Record<string, { targetConsensus: number; targetHigh: number }>>({});
  const [radarLoading, setRadarLoading] = useState(false);

  // Interactive modals / drawers
  const [showRrgModal, setShowRrgModal] = useState(false);
  const [rrgHighlight, setRrgHighlight] = useState<{ etf?: string | null; subEtf?: string | null; symbol?: string | null }>({});
  const [analyzingStock, setAnalyzingStock] = useState<StockMetrics | null>(null);
  const [chatStock, setChatStock] = useState<StockMetrics | null>(null);
  const [chatKey, setChatKey] = useState(0);

  // 1. Fetch public live market telemetry in parallel
  useEffect(() => {
    let cancelled = false;

    fetch("/api/sector-rotation")
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (!cancelled && res?.success && res.data) {
          setRotation(res.data);
        }
      })
      .catch(() => {});

    fetch("/api/audit")
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (!cancelled && res?.success && res.data) {
          setWinRates(res.data.winRates || []);
          setAuditShowcase(res.data.showcase || []);
        }
      })
      .catch(() => {});

    fetch(`${PYTHON_BACKEND}/api/public/showcase`)
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (!cancelled && res && res.status === "success") {
          setDsShowcase(res);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Fetch live stock pool + presets + watchlist when authenticated as Premium
  useEffect(() => {
    if (authLoading || !user?.isPremium) return;
    let cancelled = false;

    async function loadPremiumRadar() {
      setRadarLoading(true);
      try {
        const token = await getIdToken();
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const [poolRes, stratRes, wlRes] = await Promise.all([
          fetch("/api/stock-pool?include=stocks", { headers }),
          fetch("/api/strategies", { headers }),
          fetch("/api/watchlist", { headers }),
        ]);

        if (!cancelled && poolRes.ok) {
          const pd = await poolRes.json();
          if (Array.isArray(pd.stocks)) setPoolStocks(pd.stocks);
        }
        if (!cancelled && stratRes.ok) {
          const sd = await stratRes.json();
          if (Array.isArray(sd.strategies)) setPresets(sd.strategies);
        }
        if (!cancelled && wlRes.ok) {
          const wd = await wlRes.json();
          if (Array.isArray(wd.watchlist)) {
            setWatchlist(new Set(wd.watchlist.map((w: { symbol: string }) => w.symbol)));
          }
        }
      } catch (err) {
        console.error("[Home] Failed to load live alpha radar:", err);
      } finally {
        if (!cancelled) setRadarLoading(false);
      }
    }

    loadPremiumRadar();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.isPremium, getIdToken]);

  // Compute Top 6 Multi-Strategy Resonance Picks for Premium Radar
  const topResonancePicks = useMemo<ResonancePick[]>(() => {
    if (poolStocks.length === 0 || presets.length === 0) return [];
    const map = new Map<string, ResonancePick>();

    presets.forEach((preset) => {
      if (preset.id === "seeking_alpha") return;
      const passed = applyFilters(poolStocks, preset.defaultFilters);
      passed.forEach((s) => {
        let entry = map.get(s.symbol);
        if (!entry) {
          entry = { ...s, matchedStrategies: [], matchCount: 0 };
          map.set(s.symbol, entry);
        }
        entry.matchedStrategies.push({
          id: preset.id,
          name: preset.name,
          nameZh: preset.nameZh || preset.name,
          color: preset.color,
        });
        entry.matchCount += 1;
      });
    });

    return Array.from(map.values())
      .filter((s) => s.matchCount >= 2)
      .sort((a, b) => {
        if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
        const aTailwind = a.sectorWind === "tailwind" ? 1 : 0;
        const bTailwind = b.sectorWind === "tailwind" ? 1 : 0;
        if (bTailwind !== aTailwind) return bTailwind - aTailwind;
        return (b.marketCap || 0) - (a.marketCap || 0);
      })
      .slice(0, 6);
  }, [poolStocks, presets]);

  // Fetch live analyst consensus targets for Top 6 Resonance Picks
  useEffect(() => {
    if (!user?.isPremium || topResonancePicks.length === 0) return;
    let cancelled = false;
    const syms = topResonancePicks.map((s) => s.symbol).join(",");

    getIdToken().then((token) => {
      fetch(`/api/target-prices?symbols=${encodeURIComponent(syms)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!cancelled && data?.targets) {
            setTargetPrices(data.targets);
          }
        })
        .catch(() => {});
    });

    return () => {
      cancelled = true;
    };
  }, [user?.isPremium, topResonancePicks, getIdToken]);

  // Cross-subdomain SSO handoff to DailyStock (never hangs on about:blank)
  const handleDailyStockRedirect = useCallback(
    async (e?: React.MouseEvent) => {
      if (e) e.preventDefault();
      let targetUrl = DAILYSTOCK_URL;

      if (!firebaseUser) {
        const opened = window.open(targetUrl, "_blank");
        if (!opened) window.location.href = targetUrl;
        return;
      }

      const popup = window.open("", "_blank");
      if (popup) {
        try {
          popup.document.open();
          popup.document.write(
            '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="3;url=https://dailystock.vanpower.live"><title>DailyStock 2.0</title></head><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#020617;color:#e2e8f0;font-family:system-ui,-apple-system,sans-serif;font-size:14px;">🌅 正在无缝接入 DailyStock 大盘节奏与持仓研报中心…</body></html>'
          );
          popup.document.close();
        } catch {}
      }

      try {
        const idToken = await Promise.race([
          firebaseUser.getIdToken(false),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
        ]);
        if (idToken) {
          targetUrl = `${DAILYSTOCK_URL}?authToken=${encodeURIComponent(idToken)}`;
        }
      } catch {
        // Fallback to normal navigation
      }

      if (popup) {
        popup.location.replace(targetUrl);
      } else {
        window.location.href = targetUrl;
      }
    },
    [firebaseUser]
  );

  const toggleWatchlistSymbol = useCallback(
    async (symbol: string) => {
      if (!user?.uid) return;
      const exists = watchlist.has(symbol);
      try {
        const token = await getIdToken();
        const res = await fetch("/api/watchlist", {
          method: exists ? "DELETE" : "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(exists ? { symbol } : { symbol, role: "core" }),
        });
        if (res.ok) {
          setWatchlist((prev) => {
            const next = new Set(prev);
            if (exists) next.delete(symbol);
            else next.add(symbol);
            return next;
          });
        }
      } catch (err) {
        console.error("[Home] toggleWatchlist error:", err);
      }
    },
    [user?.uid, watchlist, getIdToken]
  );

  // Derived telemetry metrics
  const winRateByStrategy = useMemo(() => {
    const map: Record<string, AuditWinRate> = {};
    winRates.forEach((w) => {
      map[w.id] = w;
    });
    return map;
  }, [winRates]);

  const activeWinStats = useMemo(() => {
    const valid = winRates.filter((w) => w.t20WinRate > 0 || w.t5WinRate > 0);
    if (valid.length === 0) return null;
    const avgT5 = (valid.reduce((s, w) => s + w.t5WinRate, 0) / valid.length).toFixed(1);
    const avgT20 = (valid.reduce((s, w) => s + w.t20WinRate, 0) / valid.length).toFixed(1);
    return { avgT5, avgT20 };
  }, [winRates]);

  const topRrgSectors = useMemo<SectorItem[]>(() => {
    if (!rotation?.sectors) return [];
    return Object.entries(rotation.sectors)
      .map(([etf, info]) => ({ etf, ...info }))
      .sort((a, b) => (b.netScore ?? 0) - (a.netScore ?? 0))
      .slice(0, 4);
  }, [rotation]);

  const spx = dsShowcase?.indices?.["^GSPC"];
  const ndx = dsShowcase?.indices?.["^IXIC"];
  const vix = dsShowcase?.indices?.["^VIX"];
  const isMarketOpen = dsShowcase?.market_status?.is_open ?? false;

  const verifiedAuditWinners = useMemo(
    () => auditShowcase.filter((item) => item.returnPct > 0).slice(0, 4),
    [auditShowcase]
  );

  return (
    <main className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* ============================================================
          1. UNIFIED DUAL-CORE TERMINAL HEADER
          ============================================================ */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80 px-2.5 sm:px-6 py-2 sm:py-3">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-2">
          {/* Left: Brand + Dual-Core Segmented Switch */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Link href="/" className="flex items-center gap-1.5 sm:gap-2 shrink-0 group">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30">
                <Gem className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm sm:text-lg font-extrabold tracking-tight text-white">VANPOWER</span>
                <span className="text-xs sm:text-sm font-bold text-cyan-400">Gems</span>
                <span className="hidden xl:inline-flex px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/25 text-[10px] font-mono font-bold text-cyan-300">
                  v3.0
                </span>
              </div>
            </Link>

            {/* Dual-Core Segmented Switcher */}
            <div
              role="tablist"
              aria-label={t("Vanpower Dual-Core Terminal Switcher", "Vanpower 双核终端切换")}
              className="flex items-center p-0.5 rounded-xl bg-slate-900 border border-slate-800 shadow-inner"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeCore === "gems"}
                onClick={() => setActiveCore("gems")}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeCore === "gems"
                    ? "bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Gem className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span>{t("Quant Alpha", "量化选股")}</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeCore === "dailystock"}
                onClick={() => setActiveCore("dailystock")}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeCore === "dailystock"
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Sun className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span>{t("Market Pulse", "大盘节奏")}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleDailyStockRedirect}
              title={t("Open full DailyStock terminal with seamless SSO", "免密直达 DailyStock 完整大盘与 1,500+ 研报终端")}
              className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-[11px] font-semibold text-amber-300 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>🌅 DailyStock</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          {/* Right: Focused High-Value Navigation */}
          <nav className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Link
              href="/updates"
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/30 text-xs font-semibold text-emerald-300 transition-colors whitespace-nowrap"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{t("Updates", "更替动态")}</span>
            </Link>

            <Link
              href="/audit"
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/15 border border-purple-500/30 text-xs font-semibold text-purple-300 transition-colors whitespace-nowrap"
            >
              <Cpu className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>{t("AI Win Rate", "AI 胜率审计")}</span>
              {activeWinStats && (
                <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-[10px] font-mono text-purple-200">
                  {activeWinStats.avgT20}%
                </span>
              )}
            </Link>

            <Link
              href="/whitepaper"
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 transition-colors whitespace-nowrap"
            >
              <Network className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{t("Ontology", "本体白皮书")}</span>
            </Link>

            {user?.isPremium && (
              <Link
                href="/watchlist"
                className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-xs font-semibold text-indigo-300 transition-colors whitespace-nowrap"
              >
                <Briefcase className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>{t("Portfolio", "投资组合")}</span>
                {watchlist.size > 0 && <span className="font-mono text-[11px]">({watchlist.size})</span>}
              </Link>
            )}

            <button
              type="button"
              onClick={() => setLang(lang === "en" ? "zh" : "en")}
              className="flex items-center gap-1 px-2 py-1 sm:py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-[11px] sm:text-xs font-semibold border border-slate-800 transition-colors cursor-pointer"
            >
              <Languages className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>{lang === "en" ? "中文" : "EN"}</span>
            </button>

            <UserMenu />
          </nav>
        </div>
      </header>

      {/* ============================================================
          2. 3-SECOND EXECUTIVE TELEMETRY BAR (只突出最关键市场温度)
          ============================================================ */}
      <section className="border-b border-slate-800/70 bg-gradient-to-b from-slate-900/70 to-slate-950 px-3 sm:px-6 py-3 sm:py-4">
        <div className="max-w-[1400px] mx-auto grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {/* Card 1: Live US Indices & Market Status */}
          <div className="rounded-xl bg-slate-900/80 border border-slate-800/90 p-2.5 sm:p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-[11px] text-slate-400 mb-1">
              <span className="font-semibold flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${isMarketOpen ? "bg-emerald-400 animate-ping" : "bg-slate-500"}`} />
                {isMarketOpen ? t("US Market Live", "美股交易中") : t("US Market Closed", "美股休市 · 最新收盘")}
              </span>
              {rotation?.macroPhase && (
                <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/25 text-[10px] font-mono text-cyan-300">
                  {rotation.macroPhase} Cycle
                </span>
              )}
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <span className="text-[10px] text-slate-500 block">S&amp;P 500</span>
                <span className="text-xs sm:text-sm font-mono font-bold text-white">
                  {spx ? spx.price.toLocaleString("en-US", { maximumFractionDigits: 1 }) : "—"}
                </span>
                {spx && (
                  <span className={`ml-1 text-[11px] font-mono font-semibold ${spx.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {spx.change >= 0 ? `+${spx.change.toFixed(2)}%` : `${spx.change.toFixed(2)}%`}
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 block">NASDAQ</span>
                <span className="text-xs sm:text-sm font-mono font-bold text-white">
                  {ndx ? ndx.price.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—"}
                </span>
                {ndx && (
                  <span className={`ml-1 text-[11px] font-mono font-semibold ${ndx.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {ndx.change >= 0 ? `+${ndx.change.toFixed(2)}%` : `${ndx.change.toFixed(2)}%`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: 27-Sector RRG Tailwinds */}
          <div className="rounded-xl bg-slate-900/80 border border-slate-800/90 p-2.5 sm:p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-[11px] text-slate-400 mb-1">
              <span className="font-semibold flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                <TermTooltip term="RRG">{t("RRG Sector Tailwinds", "RRG 主力顺风赛道")}</TermTooltip>
              </span>
              <button
                type="button"
                onClick={() => {
                  setRrgHighlight({});
                  setShowRrgModal(true);
                }}
                className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 cursor-pointer"
              >
                {t("Quadrant ↗", "四象限 ↗")}
              </button>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(rotation?.favoredSectors?.length ? rotation.favoredSectors.slice(0, 3) : ["XLK", "XLC", "XLI"]).map((etf) => (
                <span
                  key={etf}
                  className="px-2 py-0.5 rounded-md bg-emerald-500/12 border border-emerald-500/30 text-[11px] font-mono font-bold text-emerald-300"
                >
                  ↑ {etf}
                </span>
              ))}
              {rotation?.avoidSectors?.[0] && (
                <span className="px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/25 text-[11px] font-mono text-rose-300">
                  ↓ {rotation.avoidSectors[0]}
                </span>
              )}
            </div>
          </div>

          {/* Card 3: Live AI Win-Rate & Self-Healing */}
          <Link
            href="/audit"
            className="rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800/90 hover:border-purple-500/40 p-2.5 sm:p-3.5 flex flex-col justify-between transition-colors group"
          >
            <div className="flex items-center justify-between gap-1 text-[11px] text-slate-400 mb-1">
              <span className="font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                {t("Walk-Forward Audit", "实盘策略胜率审计")}
              </span>
              <span className="text-[10px] text-purple-300 group-hover:translate-x-0.5 transition-transform">
                {t("Details →", "战报 →")}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <span className="text-[10px] text-slate-500 block">{t("T+20 Win Rate", "T+20 月度胜率")}</span>
                <span className="text-sm sm:text-base font-mono font-extrabold text-purple-300">
                  {activeWinStats ? `${activeWinStats.avgT20}%` : "—"}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 block">{t("T+5 Short-Term", "T+5 短线胜率")}</span>
                <span className="text-xs sm:text-sm font-mono font-bold text-emerald-400">
                  {activeWinStats ? `${activeWinStats.avgT5}%` : "—"}
                </span>
              </div>
            </div>
          </Link>

          {/* Card 4: Volatility & Breadth + Quick Switch to DailyStock */}
          <div className="rounded-xl bg-slate-900/80 border border-slate-800/90 p-2.5 sm:p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 text-[11px] text-slate-400 mb-1">
              <span className="font-semibold flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                {t("Risk & Breadth", "恐慌指数与市场广度")}
              </span>
              <button
                type="button"
                onClick={() => setActiveCore(activeCore === "gems" ? "dailystock" : "gems")}
                className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 cursor-pointer"
              >
                {activeCore === "gems" ? t("Macro Brief →", "看大盘 →") : t("Screener →", "去选股 →")}
              </button>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <span className="text-[10px] text-slate-500 block">VIX</span>
                <span className={`text-xs sm:text-sm font-mono font-bold ${(vix?.price ?? 18) > 22 ? "text-amber-400" : "text-slate-200"}`}>
                  {vix ? vix.price.toFixed(2) : "—"}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 block">{t("Advancers", "真实赚钱广度")}</span>
                <span className="text-xs sm:text-sm font-mono font-bold text-cyan-300">
                  {dsShowcase?.market_breadth?.advance_percent || "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          3A. CORE 1: GEMS QUANTITATIVE ALPHA TERMINAL (DEFAULT)
          ============================================================ */}
      {activeCore === "gems" ? (
        <div className="flex-1 max-w-[1400px] w-full mx-auto px-3 sm:px-6 py-5 sm:py-8 space-y-6 sm:space-y-8">
          {/* Compact Focused Hero Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-slate-800/60">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-[11px] font-semibold mb-2">
                <Zap className="w-3 h-3" />
                <span>{t("Signal-First Quant Terminal · Zero Data Overload", "聚焦高确信度信号 · 告别海量杂讯")}</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                {lang === "en" ? (
                  <>
                    Focus on High-Conviction{" "}
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400">
                      Alpha Signals
                    </span>
                  </>
                ) : (
                  <>
                    直击高胜率{" "}
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400">
                      Alpha 核心标的
                    </span>
                  </>
                )}
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
                {t(
                  "Top multi-strategy resonance picks first, backed by Dual Price Targets (Wall St Consensus + AI Fair Value) and 27-Sector RRG tailwinds.",
                  "优先呈现多模型共振标的与「华尔街共识 + AI 前瞻重估」双目标价，一键滑出 5 秒投资逻辑速览。"
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Link
                href="/screener/matrix"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>{t("Open Super Matrix", "进入多策略共振矩阵")}</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
              <Link
                href="/updates"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs sm:text-sm font-semibold transition-colors"
              >
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>{t("Latest Additions", "最新调仓更替")}</span>
              </Link>
            </div>
          </div>

          {/* ── SPOTLIGHT 1: LIVE ALPHA RADAR (Real Pool Resonance for Premium / Verified Audit Winners for Guests) ── */}
          {user?.isPremium ? (
            <section className="vp-contain-section space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                  <h2 className="text-base sm:text-lg font-bold text-white">
                    {t("Today's Multi-Strategy Alpha Radar", "今日多策略共振焦点池")}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-[11px] font-mono font-semibold text-indigo-300">
                    Live FMP + RRG
                  </span>
                </div>
                <Link href="/screener/matrix" className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                  <span>{t("View Full Matrix", "查看全部共振标的")}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {radarLoading && topResonancePicks.length === 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-36 rounded-xl bg-slate-900/70 border border-slate-800 animate-pulse" />
                  ))}
                </div>
              ) : topResonancePicks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {topResonancePicks.map((stock) => {
                    const tp = targetPrices[stock.symbol];
                    const upsidePct =
                      tp?.targetConsensus && stock.price > 0
                        ? ((tp.targetConsensus - stock.price) / stock.price) * 100
                        : null;
                    const saved = watchlist.has(stock.symbol);

                    return (
                      <div
                        key={stock.symbol}
                        className="vp-contain-card group rounded-xl bg-slate-900/85 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/45 p-3.5 sm:p-4 transition-all shadow-md flex flex-col justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                                  {stock.symbol}
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/35 text-[11px] font-bold text-indigo-300">
                                  {stock.matchCount} {t("Strategies", "策略共振")}
                                </span>
                                <SectorWindBadge
                                  wind={stock.sectorWind}
                                  quadrant={stock.sectorQuadrant}
                                  etf={stock.sectorETF}
                                  sectorName={stock.sector}
                                />
                              </div>
                              <p className="text-xs text-slate-400 truncate mt-0.5">{stock.companyName}</p>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="text-sm sm:text-base font-mono font-extrabold text-white">
                                ${stock.price.toFixed(2)}
                              </div>
                              {upsidePct !== null && (
                                <div className={`text-[11px] font-mono font-semibold ${upsidePct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                  <Target className="w-3 h-3 inline mr-0.5" />
                                  {upsidePct >= 0 ? `+${upsidePct.toFixed(1)}%` : `${upsidePct.toFixed(1)}%`}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1 mb-2.5">
                            {stock.matchedStrategies.slice(0, 3).map((st) => (
                              <span
                                key={st.id}
                                className="px-2 py-0.5 rounded bg-slate-800/90 border border-slate-700/70 text-[10px] font-medium text-slate-300"
                              >
                                {lang === "zh" ? st.nameZh : st.name}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                          <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                            <span>ROE <strong className="text-slate-200">{stock.roe !== null ? `${stock.roe.toFixed(1)}%` : "—"}</strong></span>
                            <span>FCF <strong className="text-slate-200">{stock.freeCashFlowYield !== null ? `${stock.freeCashFlowYield.toFixed(1)}%` : "—"}</strong></span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => toggleWatchlistSymbol(stock.symbol)}
                              title={saved ? t("Remove from portfolio", "移出组合") : t("Add to portfolio", "加入组合")}
                              className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                                saved
                                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                                  : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                              }`}
                            >
                              {saved ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => setAnalyzingStock(stock)}
                              className="px-2.5 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/35 text-cyan-300 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>{t("5s Thesis", "速览逻辑")}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </section>
          ) : verifiedAuditWinners.length > 0 ? (
            <section className="vp-contain-section space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm sm:text-base font-bold text-white">
                    {t("Live Verified Quant Track-Record Highlights", "实盘审计捕获代表作（真实历史快照验证）")}
                  </h2>
                </div>
                <Link href="/audit" className="text-xs font-semibold text-purple-300 hover:text-purple-200">
                  {t("Full Win-Rate Audit →", "查看完整胜率与错题自愈 →")}
                </Link>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                {verifiedAuditWinners.map((item) => (
                  <div
                    key={`${item.symbol}-${item.entryDate}`}
                    className="rounded-xl bg-slate-900/80 border border-slate-800 p-3 flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-sm sm:text-base font-extrabold text-white">{item.symbol}</span>
                        <span className="block text-[11px] text-slate-400 truncate max-w-[130px]">{item.companyName}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-xs font-mono font-bold text-emerald-400">
                        +{item.returnPct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>{item.entryDate}</span>
                      <span>
                        ${item.entryPrice.toFixed(1)} → <strong className="text-slate-200">${item.currentPrice.toFixed(1)}</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* ── SPOTLIGHT 2: QUANTITATIVE STRATEGY ENGINES (7 Classic + 1 Super Matrix) ── */}
          <section className="vp-contain-section space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base sm:text-xl font-bold text-white">
                  {t("Quantitative Strategy Matrix", "八维量化选股引擎")}
                </h2>
                <p className="text-xs text-slate-400">
                  {t(
                    "Choose a specialized quantitative model or launch the Super Screener Matrix to find multi-factor overlaps.",
                    "按投资风格进入对应定量漏斗，每一项核心指标均内置金融本体公式弹窗。"
                  )}
                </p>
              </div>
            </div>

            <PremiumGate featureName={t("Quantitative Stock Screener", "量化选股系统")}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {/* Card 0: Super Screener Multi-Strategy Matrix */}
                <Link
                  href="/screener/matrix"
                  className="vp-contain-card group relative overflow-hidden rounded-xl border border-indigo-500/40 bg-gradient-to-br from-indigo-950/50 via-slate-900/90 to-slate-900 p-4 sm:p-5 transition-all duration-300 hover:border-cyan-400/70 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-0.5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-300">
                        <Activity className="w-5 h-5" />
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                        {t("Highest Signal", "最高确信度")}
                      </span>
                    </div>

                    <h3 className="text-base sm:text-lg font-extrabold bg-gradient-to-r from-indigo-300 to-cyan-300 bg-clip-text text-transparent">
                      {lang === "en" ? "Super Screener Matrix" : "多策略共振矩阵"}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      {t(
                        "Isolates rare stocks simultaneously passing ≥2 quantitative models to filter out single-factor value traps.",
                        "锁定同时通过 ≥2 个严苛量化模型的共振标的，自动过滤单一指标价值陷阱。"
                      )}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-cyan-300">
                    <span className="flex items-center gap-1.5">
                      <Gem className="w-3.5 h-3.5" />
                      {topResonancePicks.length > 0
                        ? t(`Top Picks Live`, `已捕获共振金股`)
                        : t("Multi-Model Overlap", "多因子交叉验证")}
                    </span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>

                {/* Cards 1-7: Specialized Quantitative Strategies */}
                {strategies.map((strategy) => {
                  const Icon = strategy.icon;
                  const style = colorStyles[strategy.color] || colorStyles.blue;
                  const auditStat = winRateByStrategy[strategy.id];

                  return (
                    <Link
                      key={strategy.id}
                      href={`/screener/${strategy.id}`}
                      className={`vp-contain-card group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/75 p-4 sm:p-5 transition-all duration-300 hover:bg-slate-900 ${style.hoverBorder} hover:-translate-y-0.5 flex flex-col justify-between`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className={`p-2 rounded-lg border ${style.iconBox}`}>
                            <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                          {auditStat && auditStat.t20WinRate > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-mono font-bold text-emerald-300">
                              T+20 {auditStat.t20WinRate.toFixed(0)}%
                            </span>
                          )}
                        </div>

                        <h3 className="text-base sm:text-lg font-bold text-white truncate">
                          {lang === "en" ? strategy.name : strategy.nameZh}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1 mb-3 leading-relaxed line-clamp-2">
                          {lang === "en" ? strategy.description : strategy.descriptionZh}
                        </p>

                        <div className="grid grid-cols-3 gap-1.5 mb-3">
                          {strategy.metrics.map((metric) => (
                            <div
                              key={metric.label}
                              className="px-2 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800/80 flex flex-col justify-between"
                            >
                              <span className="text-[10px] text-slate-400 truncate">
                                {"term" in metric && metric.term ? (
                                  <TermTooltip term={metric.term}>{metric.label}</TermTooltip>
                                ) : (
                                  metric.label
                                )}
                              </span>
                              <span className={`text-[11px] font-mono font-bold mt-0.5 truncate ${style.accentText}`}>
                                {metric.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className={`pt-2.5 border-t border-slate-800/70 flex items-center justify-between text-xs font-semibold ${style.accentText}`}>
                        <span>{t("Launch Funnel", "进入筛选漏斗")}</span>
                        <span className="group-hover:translate-x-1 transition-transform">→</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </PremiumGate>
          </section>

          {/* ── PROGRESSIVE DISCLOSURE: v3.0 THREE-LAYER FINANCIAL ONTOLOGY & DOCS ── */}
          <details className="group rounded-2xl bg-slate-900/75 border border-slate-800 overflow-hidden">
            <summary className="px-4 sm:px-6 py-3.5 sm:py-4 cursor-pointer list-none flex flex-wrap items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shrink-0">
                  <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-extrabold text-white">
                      {t("v3.0 Three-Layer Financial Ontology & Architecture Docs", "v3.0 三层金融领域本体架构与白皮书")}
                    </span>
                    <TermTooltip term="Ontology" className="text-[11px] text-cyan-400 font-semibold">
                      {t("What is Ontology?", "什么是金融本体？")}
                    </TermTooltip>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                    {t(
                      "Click to inspect Semantic Graph, Pydantic Data Contracts, Walk-Forward Audit & interactive slides.",
                      "点击展开查看 Neo4j 语义图谱、Pydantic 数据契约、T+5 动力算子及交互式架构演播厅。"
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-cyan-400 font-semibold group-open:hidden">
                  {t("Expand Architecture ▾", "展开架构详情 ▾")}
                </span>
                <span className="text-xs text-slate-400 font-semibold hidden group-open:inline">
                  {t("Collapse ▴", "收起 ▴")}
                </span>
              </div>
            </summary>

            <div className="px-4 sm:px-6 pb-5 pt-3 border-t border-slate-800/80 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 mb-1">
                    {t("Layer 1 · Semantic Graph", "第一层 · 语义与知识本体")}
                  </div>
                  <div className="font-bold text-slate-200 mb-1">
                    {t("Neo4j 5-Node Graph + 1,500+ Research Vault", "Neo4j 五维图谱 + 1,500+ 深度研报库")}
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    {t(
                      "Links Stock, Sector, Strategy, AI Reflection & Audit with 82-year macro history.",
                      "连接股票、板块、策略、AI错题本与审计节点，融合 82 年宏观与 1,500+ 机构深度研报。"
                    )}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 mb-1">
                    {t("Layer 2 · Data Contract & Lexicon", "第二层 · 数据契约与双语词典")}
                  </div>
                  <div className="font-bold text-slate-200 mb-1">
                    {t("Pydantic Contracts + Instant Formula Tooltips", "Pydantic 强类型契约 + 术语即时弹窗")}
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    {t("Standardizes 5-tier storage schemas and instant formulas for ", "统一五层存储契约，为 ")}
                    <TermTooltip term="FCF Yield" showIcon={false} className="text-cyan-400 font-medium">FCF Yield</TermTooltip>
                    {" / "}
                    <TermTooltip term="PEG Ratio" showIcon={false} className="text-cyan-400 font-medium">PEG</TermTooltip>
                    {" / "}
                    <TermTooltip term="ROE" showIcon={false} className="text-cyan-400 font-medium">ROE</TermTooltip>
                    {t(" across all screens.", " 等核心指标提供即时解释。")}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-1">
                    {t("Layer 3 · Kinetic Operators", "第三层 · 动力与决策算子")}
                  </div>
                  <div className="font-bold text-slate-200 mb-1">
                    <TermTooltip term="RRG" showIcon={false} className="text-purple-400">27-Sector RRG</TermTooltip>
                    {" + "}
                    <TermTooltip term="Walk-Forward" showIcon={false} className="text-purple-400">Walk-Forward</TermTooltip>
                    {" & "}
                    <TermTooltip term="T+5" showIcon={false} className="text-purple-400">T+5</TermTooltip>
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    {t(
                      "Couples 27-sector rotation tailwinds with Lo (2002) Sharpe backtests and autonomous parameter self-healing.",
                      "联动 27 板块顺逆风象限、无前视偏差回测与周日 AI 策略阈值闭环自愈。"
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <Link
                  href="/whitepaper"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs font-semibold text-amber-300 transition-colors"
                >
                  <Network className="w-3.5 h-3.5" />
                  <span>{t("Read v3.0 Ontology Whitepaper", "阅读 v3.0 金融本体白皮书")}</span>
                </Link>
                <a
                  href="/gems_architecture_presentation.html"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-xs font-semibold text-cyan-300 transition-colors"
                >
                  <Presentation className="w-3.5 h-3.5" />
                  <span>{t("13-Slide Architecture Deck ↗", "13 页交互式架构演播厅 ↗")}</span>
                </a>
                <a
                  href="/value-proposition.html"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{t("Value Guide ↗", "核心价值指南 ↗")}</span>
                </a>
              </div>
            </div>
          </details>
        </div>
      ) : (
        /* ============================================================
           3B. CORE 2: DAILYSTOCK MACRO & PRE-MARKET PULSE SYNERGY VIEW
           ============================================================ */
        <div className="flex-1 max-w-[1400px] w-full mx-auto px-3 sm:px-6 py-5 sm:py-8 space-y-6">
          <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/30 p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
                <Sun className="w-3.5 h-3.5" />
                <span>{dsShowcase?.market_status?.cst_time ? `CST ${dsShowcase.market_status.cst_time}` : "DailyStock Live Pulse"}</span>
              </div>
              <h1 className="text-xl sm:text-3xl font-extrabold text-white">
                {dsShowcase?.market_status?.scene_title || t("🌅 3-Minute US Market Macro & Tactical Pulse", "🌅 3 分钟美股大盘节奏与盘前攻防")}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
                {dsShowcase?.market_status?.scene_desc ||
                  t(
                    "Real-time macro liquidity, 27-sector RRG rotation, pre-market movers, and 1,500+ institutional research reports.",
                    "实时聚合大盘水位、美债利差、盘前异动攻防与 1,500+ 篇机构深度研报。"
                  )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleDailyStockRedirect}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-xs sm:text-sm flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                <span>{t("Enter Full DailyStock Terminal & 1,500+ Vault", "免密进入 DailyStock 完整盘面与研报库")}</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 3-Column Macro Weather + Top Sector RRG */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Macro Strategy Wire */}
            <div className="lg:col-span-2 rounded-xl bg-slate-900/80 border border-slate-800 p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  {t("Macro & Liquidity Telemetry", "宏观流动性与市场广度")}
                </span>
                {dsShowcase?.macro_brief?.date_str && (
                  <span className="text-xs font-mono text-slate-500">{dsShowcase.macro_brief.date_str}</span>
                )}
              </div>

              <h2 className="text-base sm:text-lg font-bold text-white">
                {dsShowcase?.macro_brief?.title || t("Daily Macro & Quantitative Strategy Briefing", "每日美股宏观与量化决策速递")}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-3">
                  <span className="text-[11px] text-slate-400 block">{t("10Y-2Y Yield Spread", "10Y-2Y 美债利差")}</span>
                  <span className="text-sm sm:text-base font-mono font-bold text-cyan-300 mt-0.5 block">
                    {dsShowcase?.macro_liquidity?.t10y2y || "—"}
                  </span>
                  <span className="text-[11px] text-slate-500">{dsShowcase?.macro_liquidity?.t10y2y_status || ""}</span>
                </div>
                <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-3">
                  <span className="text-[11px] text-slate-400 block">{t("Market Breadth", "真实市场广度")}</span>
                  <span className="text-sm sm:text-base font-mono font-bold text-emerald-400 mt-0.5 block">
                    {dsShowcase?.market_breadth?.advance_percent || "—"}
                  </span>
                  <span className="text-[11px] text-slate-500">{dsShowcase?.market_breadth?.breadth_label || ""}</span>
                </div>
                <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-3">
                  <span className="text-[11px] text-slate-400 block">{t("Macro Cycle Regime", "宏观周期象限")}</span>
                  <span className="text-sm sm:text-base font-mono font-bold text-indigo-300 mt-0.5 block">
                    {rotation?.macroPhase ? `${rotation.macroPhase} Cycle` : "—"}
                  </span>
                  <span className="text-[11px] text-slate-500">{dsShowcase?.macro_liquidity?.liquidity_tone || ""}</span>
                </div>
              </div>

              {/* Pre-market Anomalies Snapshot */}
              {dsShowcase?.premarket_anomalies && dsShowcase.premarket_anomalies.length > 0 && (
                <div className="pt-2 space-y-2">
                  <div className="text-xs font-bold text-slate-300">
                    {t("⚡ Pre-Market Movers & 9:30 AM Key Levels", "⚡ 今日盘前异动与 9:30 关键攻防位")}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {dsShowcase.premarket_anomalies.slice(0, 2).map((item) => (
                      <div key={item.symbol} className="rounded-lg bg-slate-950/80 border border-slate-800 p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-white text-sm">{item.symbol}</span>
                          <span className="font-mono text-xs font-bold text-emerald-400">
                            {item.premarket_price} ({item.gap_percent})
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2">{item.catalyst_summary || item.catalyst_type}</p>
                        <div className="flex items-center justify-between text-[11px] font-mono pt-1 border-t border-slate-800/80">
                          <span className="text-amber-400">{t("Support", "防守支撑")} {item.key_support || "—"}</span>
                          <span className="text-emerald-400">{t("Target", "目标阻力")} {item.key_resistance || "—"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Top 4 RRG Sector Leaders */}
            <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 sm:p-5 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <Compass className="w-4 h-4" />
                    {t("27-Sector RRG Leaders", "27 板块 RRG 领涨先锋")}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRrgHighlight({});
                      setShowRrgModal(true);
                    }}
                    className="text-xs font-semibold text-cyan-300 hover:text-cyan-200 cursor-pointer"
                  >
                    {t("Open Chart ↗", "打开四象限图 ↗")}
                  </button>
                </div>

                <div className="space-y-2">
                  {topRrgSectors.map((sec) => (
                    <div
                      key={sec.etf}
                      className="rounded-lg bg-slate-950/70 border border-slate-800 px-3 py-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-white">{sec.etf}</span>
                          <span className="text-xs text-slate-400 truncate">{sec.name}</span>
                        </div>
                        {sec.recommendedStocks && sec.recommendedStocks.length > 0 && (
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            {t("Leaders:", "代表标的:")} {sec.recommendedStocks.slice(0, 3).join(", ")}
                          </div>
                        )}
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-mono font-bold text-emerald-300 shrink-0">
                        {sec.quadrant}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveCore("gems")}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-cyan-300 transition-colors cursor-pointer"
              >
                {t("Switch to Gems Strategy Screener →", "基于顺风板块进入 Gems 量化选股 →")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          4. NATIVE <dialog> SLIDE-OUT THESIS DRAWER & RRG MODAL
          ============================================================ */}
      <QuickThesisDialog
        stock={analyzingStock}
        strategyId="large_growth"
        strategyLabel={t("Multi-Strategy Alpha", "多策略共振优选")}
        onClose={() => setAnalyzingStock(null)}
        inWatchlist={analyzingStock ? watchlist.has(analyzingStock.symbol) : false}
        onToggleWatchlist={user?.uid ? toggleWatchlistSymbol : undefined}
        onAskAi={(stk) => {
          setChatStock(stk);
          setChatKey((k) => k + 1);
        }}
        onLocateRrg={(ctx) => {
          setRrgHighlight(ctx);
          setShowRrgModal(true);
        }}
      />

      {showRrgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto">
            <RrgQuadrantChart
              isModal={true}
              onClose={() => setShowRrgModal(false)}
              highlightETF={rrgHighlight.etf}
              highlightSubETF={rrgHighlight.subEtf}
              symbol={rrgHighlight.symbol}
            />
          </div>
        </div>
      )}

      {chatStock && (
        <StockChatAssistant
          key={`${chatStock.symbol}-${chatKey}`}
          symbol={chatStock.symbol}
          companyName={chatStock.companyName || chatStock.symbol}
          lang={lang}
          strategy="large_growth"
          initialOpen={true}
        />
      )}
    </main>
  );
}
