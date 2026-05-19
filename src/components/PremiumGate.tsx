// ============================================================
// PremiumGate — Wraps content that requires a paid subscription.
// Shows a beautiful upgrade prompt for trial users.
// ============================================================

"use client";

import { type ReactNode } from "react";
import { Lock, Crown, Gem, ArrowRight, Sparkles } from "lucide-react";
import { useAuth, type PlanType } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";

interface PremiumGateProps {
  children: ReactNode;
  /** Feature name shown in the upgrade prompt */
  featureName?: string;
}

const PLAN_LABELS: Record<PlanType, { en: string; zh: string; color: string }> = {
  trial: { en: "Trial", zh: "试用版", color: "text-slate-400" },
  paid: { en: "Paid", zh: "付费版", color: "text-blue-400" },
  super: { en: "Super", zh: "超级版", color: "text-amber-400" },
};

export default function PremiumGate({ children, featureName }: PremiumGateProps) {
  const { user } = useAuth();
  const { t } = useLanguage();

  // Paid/super users pass through
  if (user?.isPremium) {
    return <>{children}</>;
  }

  const currentPlan = user?.planType || "trial";
  const planLabel = PLAN_LABELS[currentPlan];

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 py-16 text-center">
      {/* Lock icon with glow */}
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full scale-150" />
        <div className="relative p-6 bg-slate-800/80 border border-slate-700/50 rounded-3xl backdrop-blur-sm">
          <Lock className="w-12 h-12 text-blue-400" />
        </div>
      </div>

      {/* Title */}
      <h2 className="text-3xl font-bold tracking-tight mb-3">
        {t("Premium Feature", "高级功能")}
      </h2>

      {featureName && (
        <p className="text-lg text-blue-400 font-semibold mb-4">
          {featureName}
        </p>
      )}

      <p className="text-slate-400 max-w-md mb-8 leading-relaxed">
        {user?.isExpired
          ? t(
              "Your plan has expired. Please renew to continue using quantitative screening, AI analysis, and portfolio management.",
              "您的计划已到期。请续费以继续使用量化选股、AI分析报告及投资组合管理。"
            )
          : t(
              "Upgrade to a paid plan to unlock quantitative screening, AI-powered analysis reports, and portfolio management tools.",
              "升级付费计划，解锁量化选股、AI驱动的分析报告以及投资组合管理工具。"
            )}
      </p>

      {/* Current plan badge */}
      <div className="flex items-center gap-2 mb-8 px-4 py-2 rounded-full bg-slate-800/60 border border-slate-700/50">
        <Gem className="w-4 h-4 text-slate-500" />
        <span className="text-sm text-slate-500">
          {t("Current Plan:", "当前计划：")}
        </span>
        <span className={`text-sm font-bold ${planLabel.color}`}>
          {t(planLabel.en, planLabel.zh)}
        </span>
        {user?.isExpired && (
          <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded font-bold">
            {t("Expired", "已过期")}
          </span>
        )}
      </div>

      {/* Upgrade tiers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg mb-8">
        {/* Paid */}
        <div className="p-6 rounded-2xl bg-slate-800/40 border border-blue-500/20 hover:border-blue-500/40 transition-all group cursor-pointer">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Sparkles className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-blue-400">{t("Paid Plan", "付费版")}</h3>
              <p className="text-xs text-slate-500">{t("Full Screener Access", "完整选股权限")}</p>
            </div>
          </div>
          <ul className="text-xs text-slate-400 space-y-1.5 text-left">
            <li>✓ {t("4 Screening Strategies", "4种选股策略")}</li>
            <li>✓ {t("AI Analysis Reports", "AI分析报告")}</li>
            <li>✓ {t("Watchlist (20 stocks)", "自选股 (20只)")}</li>
          </ul>
        </div>

        {/* Super */}
        <div className="p-6 rounded-2xl bg-slate-800/40 border border-amber-500/20 hover:border-amber-500/40 transition-all group cursor-pointer relative overflow-hidden">
          <div className="absolute top-2 right-2 px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-wider rounded-full">
            {t("Recommended", "推荐")}
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Crown className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-amber-400">{t("Super Plan", "超级版")}</h3>
              <p className="text-xs text-slate-500">{t("Full Platform Access", "全平台权限")}</p>
            </div>
          </div>
          <ul className="text-xs text-slate-400 space-y-1.5 text-left">
            <li>✓ {t("Everything in Paid", "包含付费版所有功能")}</li>
            <li>✓ {t("Unlimited Watchlist", "无限自选股")}</li>
            <li>✓ {t("DailyStock Reports", "DailyStock研报")}</li>
          </ul>
        </div>
      </div>

      {/* CTA */}
      <a
        href="https://dailystock.vanpower.live"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/25 hover:shadow-blue-500/35 hover:scale-105"
      >
        {t("Upgrade Now", "立即升级")}
        <ArrowRight className="w-4 h-4" />
      </a>
    </div>
  );
}
