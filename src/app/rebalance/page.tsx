"use client";

import Link from "next/link";
import { ArrowLeft, Gem, Activity, ExternalLink } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

export default function MacroEventWarningDashboard() {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen flex flex-col py-8 px-4 sm:px-6 max-w-[1200px] mx-auto w-full justify-center items-center">
      <div className="mb-6 flex items-center gap-4 self-start">
        <Link href="/" className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <Gem className="w-5 h-5 text-blue-400" />
        </Link>
      </div>

      <div className="relative w-full max-w-2xl p-8 rounded-2xl bg-slate-900/60 border border-slate-700/50 backdrop-blur-md overflow-hidden text-center">
        {/* Glow effect */}
        <div className="absolute -inset-10 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 blur-2xl opacity-50 pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl mb-6 animate-pulse">
            <Activity className="w-12 h-12 text-blue-400" />
          </div>

          <h1 className="text-3xl font-bold tracking-tight mb-4 flex items-center gap-2">
            {t("Macro Event Warning", "宏观事件预警")}
          </h1>

          <div className="w-12 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full mb-6" />

          <p className="text-slate-300 text-lg mb-4 font-medium leading-relaxed">
            {t(
              "This feature has migrated to DailyStock",
              "该功能已正式迁移至 DailyStock"
            )}
          </p>

          <p className="text-slate-400 text-sm leading-relaxed mb-8 max-w-md">
            {t(
              "To provide a more integrated experience, the Macro Event Warning (including 60/40 drift warnings, window dressing signals, and holding risk assessments) is now part of DailyStock. Paid and Super plan subscribers can access it under the 'Macro Alert' tab, using their primary notification settings.",
              "为了提供更完整的服务体验，宏观事件预警（包含 60/40 股债漂移预警、季末橱窗粉饰动量预判及持仓风险评估）已并入 DailyStock 平台。付费及超级计划订阅用户可直接在 DailyStock 控制台的“宏观预警”标签页访问，并自动使用其主预警推送设置。"
            )}
          </p>

          <a
            href="https://dailystock.vanpower.live"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all duration-200 transform hover:-translate-y-0.5"
          >
            {t("Go to DailyStock", "前往 DailyStock")}
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </main>
  );
}
