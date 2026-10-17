"use client";

import { ShieldCheck, TrendingUp, Activity, Gem, Rocket, Languages, BookOpen, Castle, Zap, ChevronRight, Cpu, Sparkles, Network, Layers, Presentation, Briefcase } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import UserMenu from "@/components/UserMenu";
import PremiumGate from "@/components/PremiumGate";
import { TermTooltip } from "@/components/TermTooltip";


const strategies = [
  {
    id: "value",
    name: "Value Investing",
    nameZh: "价值投资",
    description: "Find fundamentally strong companies trading below intrinsic value. Focus on high free cash flow and margin of safety.",
    descriptionZh: "寻找基本面健康但被市场低估的公司。强调安全边际与自由现金流。",
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
    description: "Nasdaq-100 titans driven by global expansion. Features robust cash flow and high resilience.",
    descriptionZh: "Nasdaq-100级别的科技巨头。行业垄断力强，自由现金流充沛，抗风险能力极高。",
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
    description: "Russell 2000 innovators driven by disruptive tech. Explosive revenue growth, often pre-profit.",
    descriptionZh: "依赖技术突破的细分赛道龙头。爆发力极强，通常处于亏损或盈亏平衡阶段。",
    icon: Rocket,
    color: "purple",
    metrics: [
      { label: "Market Cap", value: "< $10B" },
      { label: "Rev Growth", value: "> 30%" },
      { label: "Momentum (50SMA)", term: "50SMA", value: "vs 50SMA > 0" },
    ],
  },
  {
    id: "seeking_alpha",
    name: "Seeking Alpha Picks",
    nameZh: "Seeking Alpha 精选",
    description: "Your curated watchlist from Seeking Alpha. Bypasses quantitative screening — view all metrics at a glance and jump directly to deep analysis.",
    descriptionZh: "Seeking Alpha 自选股清单。跳过定量筛选，直接展示所有指标数据，一键进入深度分析。",
    icon: BookOpen,
    color: "amber",
    metrics: [
      { label: "Source", value: "Seeking Alpha" },
      { label: "Screening", value: "Bypassed" },
      { label: "Direct to", value: "Step 2" },
    ],
  },
  {
    id: "garp",
    name: "GARP",
    nameZh: "合理价格成长",
    description: "Combines growth and value investing. Looks for companies with strong EPS growth but undervalued PEG ratios.",
    descriptionZh: "结合成长与价值投资。寻找具有强劲EPS增长但PEG估值偏低的公司。",
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
    description: "Companies with enduring competitive advantages. Features high return on equity and superior gross margins.",
    descriptionZh: "具有持久竞争优势的公司。拥有极高的净资产收益率(ROE)和优异的毛利率。",
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
    description: "Momentum play focusing on technical breakouts and short-term trends.",
    descriptionZh: "侧重于技术面突破和短期趋势的动量策略。",
    icon: Zap,
    color: "rose",
    metrics: [
      { label: "Price vs 50SMA", term: "50SMA", value: "> 0%" },
      { label: "Price vs 200SMA", term: "200SMA", value: "> 0%" },
      { label: "Rev Growth", value: "> 5%" },
    ],
  },
];

export default function Home() {
  const { lang, setLang, t } = useLanguage();
  const { user } = useAuth();

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800/80 px-3 sm:px-6 py-2.5 sm:py-3.5">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-1.5 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Gem className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400 shrink-0" />
            <span className="text-base sm:text-xl font-bold tracking-tight whitespace-nowrap">Gems</span>
            <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-mono font-bold text-cyan-300 whitespace-nowrap">
              v3.0
            </span>
            <span className="text-xs text-slate-500 ml-1 hidden lg:inline whitespace-nowrap">
              {t("Financial Ontology & Quant Screener", "金融本体与量化选股终端")}
            </span>
          </div>

          <nav className="flex items-center gap-1 sm:gap-2.5 shrink-0">
            {/* Desktop links (Mobile uses persistent bottom dock) */}
            <Link
              href="/audit"
              className="hidden md:flex text-xs sm:text-sm text-purple-300 hover:text-purple-200 transition-colors items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 rounded-lg font-medium whitespace-nowrap shrink-0"
            >
              <Cpu className="w-4 h-4 text-purple-400 shrink-0" />
              <span>{t("AI Audit & Win Rate", "AI 胜率与自愈")}</span>
            </Link>

            <Link
              href="/whitepaper"
              className="flex text-[11px] sm:text-sm text-amber-300 hover:text-amber-200 transition-colors items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg font-semibold whitespace-nowrap shrink-0"
              title={t("v3.0 Ontology Whitepaper", "v3.0 金融本体白皮书")}
            >
              <Network className="w-3 h-3 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
              <span className="hidden sm:inline">{t("v3.0 Ontology", "v3.0 架构白皮书")}</span>
              <span className="sm:hidden">{t("Docs", "白皮书")}</span>
            </Link>

            <a
              href="/gems_architecture_presentation.html"
              target="_blank"
              rel="noreferrer"
              className="flex text-[11px] sm:text-sm text-cyan-300 hover:text-cyan-200 transition-colors items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-lg font-semibold whitespace-nowrap shrink-0"
              title={t("13-Slide Architecture Deck", "13页交互式架构演播厅")}
            >
              <Presentation className="w-3 h-3 sm:w-4 sm:h-4 text-cyan-400 shrink-0" />
              <span className="hidden lg:inline">{t("Architecture Slides", "架构演播厅")}</span>
              <span className="lg:hidden">{t("Slides", "演播")}</span>
            </a>

            <a
              href="/value-proposition.html"
              target="_blank"
              rel="noreferrer"
              className="hidden xl:flex text-xs sm:text-sm text-slate-300 hover:text-white transition-colors items-center gap-1.5 px-3 py-1.5 bg-slate-800/60 border border-slate-700/50 rounded-lg whitespace-nowrap shrink-0"
            >
              <BookOpen className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>{t("Value Guide", "价值指南")}</span>
            </a>

            {user?.isPremium && (
              <Link
                href="/watchlist"
                className="hidden md:flex items-center gap-1.5 text-xs sm:text-sm text-indigo-300 hover:text-white px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 transition-colors font-medium whitespace-nowrap shrink-0"
              >
                <Briefcase className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>{t("Watchlist", "投资组合")}</span>
              </Link>
            )}

            {/* Language Toggle */}
            <button
              onClick={() => setLang(lang === "en" ? "zh" : "en")}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] sm:text-xs font-semibold transition-all border border-slate-700/80 hover:border-slate-600 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Languages className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-400 shrink-0" />
              <span>{lang === "en" ? "中文" : "EN"}</span>
            </button>
            <UserMenu />
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-3 sm:px-6 py-4 sm:py-12">
        <div className="max-w-[1400px] w-full flex flex-col items-center text-center mb-5 sm:mb-10">
          <div className="inline-flex items-center justify-center px-2.5 sm:px-4 py-1 sm:py-1.5 mb-3 sm:mb-5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 whitespace-nowrap">
            <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1.5 shrink-0" />
            <span className="text-[10px] sm:text-xs font-semibold tracking-wider uppercase">
              {t("v3.0 Financial Ontology Quant Engine", "v3.0 金融领域本体驱动 · 量化选股系统")}
            </span>
          </div>

          <h1 className="text-2xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-2.5 sm:mb-5 leading-[1.15]">
            {lang === "en" ? (
              <>
                Find your next{" "}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
                  alpha
                </span>
                .
              </>
            ) : (
              <>
                发现下一个{" "}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
                  Alpha
                </span>
                。
              </>
            )}
          </h1>

          <p className="text-xs sm:text-base text-slate-400 max-w-2xl mb-4 sm:mb-6 leading-relaxed px-1">
            {t(
              "Institutional stock screening powered by a Three-Layer Financial Domain Ontology, 27-Sector RRG rotation, and T+5 self-healing AI audit. Tap any '?' indicator for instant ontology formulas.",
              "由三层金融领域本体 (Ontology)、27 板块 RRG 轮动引擎与 T+5 自愈审计驱动的机构级选股平台。点击或悬停带“?”指标即可查看本体定义与公式。"
            )}
          </p>

          {/* Live Status Action Pills — 2 columns side-by-side on mobile */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-center gap-2 sm:gap-3 w-full sm:w-auto mb-5 sm:mb-6">
            <Link
              href="/updates"
              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-emerald-500/40 text-[11px] sm:text-sm transition-all hover:scale-[1.02] shadow-md backdrop-blur-md whitespace-nowrap"
            >
              <span className="flex h-2 w-2 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
              <span className="text-emerald-400 font-bold">{t("UPDATES", "更替记录")}</span>
              <span className="text-slate-300 hidden xs:inline sm:inline">{t("Additions", "最新更替")}</span>
            </Link>

            <Link
              href="/audit"
              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-purple-500/40 text-[11px] sm:text-sm transition-all hover:scale-[1.02] shadow-md backdrop-blur-md whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse shrink-0" />
              <span className="text-purple-400 font-bold">{t("WIN-RATE", "胜率战报")}</span>
              <span className="text-slate-300 hidden xs:inline sm:inline">{t("AI Audit", "AI 自愈审计")}</span>
            </Link>
          </div>

          {/* v3.0 Three-Layer Financial Domain Ontology Strip */}
          <div className="w-full max-w-[1400px] rounded-2xl bg-slate-900/90 border border-cyan-500/25 p-3 sm:p-5 text-left shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 mb-2.5 border-b border-slate-800/80">
              <div className="flex items-start sm:items-center gap-2.5">
                <div className="p-2 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shrink-0 mt-0.5 sm:mt-0">
                  <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-extrabold text-white">
                      {t("Three-Layer Financial Ontology v3.0", "三层金融领域本体架构 v3.0")}
                    </span>
                    <TermTooltip term="Ontology" className="text-[11px] text-cyan-400 font-semibold whitespace-nowrap">
                      {t("What is Ontology?", "什么是金融本体？")}
                    </TermTooltip>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 leading-snug">
                    {t(
                      "Bridging deterministic quantitative data contracts, Neo4j graph memory, and closed-loop AI execution.",
                      "打通确定性数据契约、Neo4j 五维知识图谱与 T+5 自愈动力算子的机构级认知底座。"
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end shrink-0">
                <Link
                  href="/whitepaper"
                  className="text-[11px] sm:text-xs font-semibold text-amber-400 hover:text-amber-300 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 transition-colors whitespace-nowrap"
                >
                  {t("Read v3.0 Whitepaper →", "阅读 v3.0 完整白皮书 →")}
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3 text-xs">
              <div className="rounded-xl bg-slate-950/70 border border-slate-800/80 p-2.5 sm:p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 mb-0.5">
                  {t("Layer 1 · Semantic Graph", "第一层 · 语义与知识本体")}
                </div>
                <div className="text-xs font-bold text-slate-200 mb-0.5">
                  {t("Neo4j 5-Node Graph + 1,500+ Research Vault", "Neo4j 五维图谱 + 1,500+ 阿里云研报库")}
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  {t(
                    "Links Stock, Sector, Strategy, AI Reflection & Audit with 82-year macro history.",
                    "连接股票、板块、策略、AI错题本与审计节点，融合82年宏观与1500+深度研报。"
                  )}
                </p>
              </div>

              <div className="rounded-xl bg-slate-950/70 border border-slate-800/80 p-2.5 sm:p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 mb-0.5">
                  {t("Layer 2 · Data Contract & Lexicon", "第二层 · 数据契约与双语词典")}
                </div>
                <div className="text-xs font-bold text-slate-200 mb-0.5">
                  {t("Pydantic Contracts + Bilingual Term Tooltips", "Pydantic 强类型契约 + 术语即时弹窗")}
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  {t(
                    "Standardizes 5-tier storage schemas and provides instant formulas for ",
                    "统一五层存储结构，并为 "
                  )}
                  <TermTooltip term="FCF Yield" showIcon={false} className="text-cyan-400 font-medium">FCF Yield</TermTooltip>
                  {" / "}
                  <TermTooltip term="PEG Ratio" showIcon={false} className="text-cyan-400 font-medium">PEG</TermTooltip>
                  {" / "}
                  <TermTooltip term="ROE" showIcon={false} className="text-cyan-400 font-medium">ROE</TermTooltip>
                  {t(" across all views.", " 等核心指标提供即时公式解释。")}
                </p>
              </div>

              <div className="rounded-xl bg-slate-950/70 border border-slate-800/80 p-2.5 sm:p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-0.5">
                  {t("Layer 3 · Kinetic Operators", "第三层 · 动力与决策算子")}
                </div>
                <div className="text-xs font-bold text-slate-200 mb-0.5">
                  <TermTooltip term="RRG" showIcon={false} className="text-purple-400">27-Sector RRG</TermTooltip>
                  {" + "}
                  <TermTooltip term="Walk-Forward" showIcon={false} className="text-purple-400">Walk-Forward</TermTooltip>
                  {" & "}
                  <TermTooltip term="T+5" showIcon={false} className="text-purple-400">T+5</TermTooltip>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  {t(
                    "Couples 27-sector rotation tailwinds with Lo (2002) Sharpe backtests and autonomous parameter self-healing.",
                    "联动 27 板块顺逆风象限、无前视偏差回测与周日 AI 策略阈值闭环自愈。"
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>


        {/* Strategy Cards — Premium Only */}
        <PremiumGate featureName={t("Quantitative Stock Screener", "量化选股系统")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 w-full max-w-[1400px] px-1">
          {/* Super Screener Matrix Card */}
          <Link
            href="/screener/matrix"
            className="group relative overflow-hidden rounded-xl border border-indigo-500/30 bg-slate-800/40 backdrop-blur-sm p-5 sm:p-8 transition-all duration-300 hover:bg-slate-800/80 hover:border-indigo-500/80 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1 cursor-pointer flex flex-col col-span-1"
          >
            <div className="absolute -top-4 -right-4 opacity-[0.06] group-hover:opacity-[0.12] transition-opacity duration-500">
              <Activity className="w-40 h-40" />
            </div>
            <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4 relative z-10">
              <div className="p-3 rounded-lg border border-indigo-500/30 bg-indigo-500/20 text-indigo-400">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                  {lang === "en" ? "Super Screener" : "多策略共振矩阵"}
                </h2>
                <p className="text-sm text-slate-500">
                  {lang === "en" ? "多策略共振矩阵" : "Multi-Strategy Matrix"}
                </p>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mb-4 sm:mb-6 leading-relaxed relative z-10 flex-1">
              {lang === "en" 
                ? "Discover high-conviction stocks that simultaneously pass multiple stringent quantitative models." 
                : "发现同时通过多个严苛量化筛选模型的高确信度投资标的。"}
            </p>
            <div className="flex items-center justify-between mt-auto relative z-10 pt-4 sm:pt-5 border-t border-slate-700/50">
              <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase text-indigo-400">
                <Gem className="w-3.5 h-3.5" />
                <span>Premium Conviction</span>
              </div>
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </div>
          </Link>

          {strategies.map((strategy) => {
            const Icon = strategy.icon;
            const colorClass =
              strategy.color === "blue" ? "text-blue-400 border-blue-500 bg-blue-500" :
              strategy.color === "indigo" ? "text-indigo-400 border-indigo-500 bg-indigo-500" :
              strategy.color === "amber" ? "text-amber-400 border-amber-500 bg-amber-500" :
              strategy.color === "emerald" ? "text-emerald-400 border-emerald-500 bg-emerald-500" :
              strategy.color === "slate" ? "text-slate-400 border-slate-500 bg-slate-500" :
              strategy.color === "rose" ? "text-rose-400 border-rose-500 bg-rose-500" :
              "text-purple-400 border-purple-500 bg-purple-500";

            return (
              <Link
                key={strategy.id}
                href={`/screener/${strategy.id}`}
                className="group relative overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-5 sm:p-8 transition-all duration-300 hover:bg-slate-800/70 hover:border-slate-600/60 hover:shadow-2xl hover:-translate-y-1 cursor-pointer flex flex-col"
              >
                {/* Background icon */}
                <div className="absolute -top-4 -right-4 opacity-[0.06] group-hover:opacity-[0.12] transition-opacity duration-500">
                  <Icon className="w-40 h-40" />
                </div>

                {/* Header */}
                <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4 relative z-10">
                  <div className={`p-3 rounded-lg border ${colorClass.replace("text-", "text-").replace("border-", "border-").replace("bg-", "bg-").split(" ").map(c => c.startsWith("bg-") ? c + "/15" : c.startsWith("border-") ? c + "/25" : c).join(" ")}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold">
                      {lang === "en" ? strategy.name : strategy.nameZh}
                    </h2>
                    <p className="text-sm text-slate-500">
                      {lang === "en" ? strategy.nameZh : strategy.name}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs sm:text-sm text-slate-400 mb-4 sm:mb-6 leading-relaxed relative z-10 flex-1">
                  {lang === "en" ? strategy.description : strategy.descriptionZh}
                </p>

                {/* Metrics */}
                <div className="space-y-1.5 sm:space-y-2 relative z-10 mb-4 sm:mb-6">
                  {strategy.metrics.map((metric) => (
                    <div
                      key={metric.label}
                      className="flex items-center justify-between px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-lg bg-slate-900/60 border border-slate-700/40"
                    >
                      <span className="text-xs font-medium text-slate-300">
                        {"term" in metric && metric.term ? (
                          <TermTooltip term={metric.term}>{metric.label}</TermTooltip>
                        ) : (
                          metric.label
                        )}
                      </span>
                      <span className={`text-xs font-mono font-semibold ${colorClass.split(" ")[0]}`}>
                        {metric.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className={`mt-auto text-sm font-semibold flex items-center gap-2 relative z-10 ${colorClass.split(" ")[0]} group-hover:gap-3 transition-all`}>
                  {t("Start Screening", "开始筛选")}
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </div>
              </Link>
            );
          })}
        </div>
        </PremiumGate>
      </section>
    </main>
  );
}
