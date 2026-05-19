"use client";

import { ShieldCheck, TrendingUp, Activity, Gem, Rocket, Languages, BookOpen } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import UserMenu from "@/components/UserMenu";
import PremiumGate from "@/components/PremiumGate";

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
      { label: "P/E Ratio", value: "< 15.0" },
      { label: "P/B Ratio", value: "< 1.5" },
      { label: "FCF Yield", value: "> 5.0%" },
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
      { label: "FCF Yield", value: "> 3%" },
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
      { label: "Momentum", value: "vs 50SMA > 0" },
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
];

export default function Home() {
  const { lang, setLang, t } = useLanguage();
  const { user } = useAuth();

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gem className="w-6 h-6 text-blue-400" />
            <span className="text-xl font-bold tracking-tight">Gems</span>
            <span className="text-xs text-slate-500 ml-2 hidden sm:inline">
              {t("US Stock Screener", "美股量化筛选器")}
            </span>
          </div>
          <nav className="flex items-center gap-4">
            {user?.isPremium && (
              <Link href="/watchlist" className="text-sm text-slate-400 hover:text-white transition-colors">
                {t("Watchlist", "自选股")}
              </Link>
            )}
            {/* Language Toggle */}
            <button
              onClick={() => setLang(lang === "en" ? "zh" : "en")}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-all border border-slate-700 hover:border-slate-600"
            >
              <Languages className="w-4 h-4 text-blue-400" />
              <span className="font-medium">{lang === "en" ? "中文" : "EN"}</span>
            </button>
            <UserMenu />
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-[1400px] w-full flex flex-col items-center text-center mb-16">
          <div className="inline-flex items-center justify-center px-4 py-1.5 mb-8 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Activity className="w-3.5 h-3.5 mr-2" />
            <span className="text-xs font-semibold tracking-widest uppercase">
              {t("Quantitative Screener", "量化选股系统")}
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
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

          <p className="text-lg text-slate-400 max-w-2xl mb-12 leading-relaxed">
            {t(
              "Professional-grade stock screening powered by quantitative analysis. Choose a strategy below to start filtering US equities.",
              "专业级量化分析驱动的股票筛选平台。选择以下策略，开始筛选美股标的。"
            )}
          </p>
        </div>

        {/* Strategy Cards — Premium Only */}
        <PremiumGate featureName={t("Quantitative Stock Screener", "量化选股系统")}>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-[1400px]">
          {strategies.map((strategy) => {
            const Icon = strategy.icon;
            const colorClass =
              strategy.color === "blue" ? "text-blue-400 border-blue-500 bg-blue-500" :
              strategy.color === "indigo" ? "text-indigo-400 border-indigo-500 bg-indigo-500" :
              strategy.color === "amber" ? "text-amber-400 border-amber-500 bg-amber-500" :
              "text-purple-400 border-purple-500 bg-purple-500";

            return (
              <Link
                key={strategy.id}
                href={`/screener/${strategy.id}`}
                className="group relative overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-8 transition-all duration-300 hover:bg-slate-800/70 hover:border-slate-600/60 hover:shadow-2xl hover:-translate-y-1 cursor-pointer flex flex-col"
              >
                {/* Background icon */}
                <div className="absolute -top-4 -right-4 opacity-[0.06] group-hover:opacity-[0.12] transition-opacity duration-500">
                  <Icon className="w-40 h-40" />
                </div>

                {/* Header */}
                <div className="flex items-center gap-4 mb-4 relative z-10">
                  <div className={`p-3 rounded-lg border ${colorClass.replace("text-", "text-").replace("border-", "border-").replace("bg-", "bg-").split(" ").map(c => c.startsWith("bg-") ? c + "/15" : c.startsWith("border-") ? c + "/25" : c).join(" ")}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">
                      {lang === "en" ? strategy.name : strategy.nameZh}
                    </h2>
                    <p className="text-sm text-slate-500">
                      {lang === "en" ? strategy.nameZh : strategy.name}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-slate-400 mb-6 leading-relaxed relative z-10 flex-1">
                  {lang === "en" ? strategy.description : strategy.descriptionZh}
                </p>

                {/* Metrics */}
                <div className="space-y-2 relative z-10 mb-6">
                  {strategy.metrics.map((metric) => (
                    <div
                      key={metric.label}
                      className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-900/60 border border-slate-700/40"
                    >
                      <span className="text-xs font-medium text-slate-300">{metric.label}</span>
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
