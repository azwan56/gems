"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Gem, ArrowLeft, StarOff, Trash2, Shield, Sword, Rocket, CircleDollarSign, RefreshCcw, AlertTriangle, HelpCircle, ChevronDown, Languages } from "lucide-react";
import type { WatchlistItem } from "@/lib/types";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import UserMenu from "@/components/UserMenu";
import PremiumGate from "@/components/PremiumGate";

type RoleKey = "anchor" | "striker" | "rocket" | "core_dividend" | "turnaround" | "special_situation" | "unassigned";

export default function WatchlistPage() {
  const { lang, setLang, t } = useLanguage();
  const { user, getIdToken } = useAuth();

  const getRoleConfigs = () => ({
    anchor: { icon: Shield, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", label: t("Anchor (Stability)", "压舱石 (稳健)"), desc: t("Low volatility, strong cash flow", "低波动，强现金流") },
    striker: { icon: Sword, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", label: t("Striker (Core Growth)", "攻击手 (核心成长)"), desc: t("High conviction, steady compounding", "高信念，稳健复利") },
    rocket: { icon: Rocket, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", label: t("Rocket (High Beta)", "火箭 (高Beta)"), desc: t("High risk/reward, hyper-growth", "高风险高回报，超高速成长") },
    core_dividend: { icon: CircleDollarSign, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", label: t("Core Dividend", "核心收息"), desc: t("Value: Reliable yield", "价值：可靠收益率") },
    turnaround: { icon: RefreshCcw, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20", label: t("Turnaround", "困境反转"), desc: t("Value: Cyclical reversion", "价值：周期均值回归") },
    special_situation: { icon: AlertTriangle, color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20", label: t("Special Sit.", "特殊情况"), desc: t("Value: Event-driven", "价值：事件驱动") },
    unassigned: { icon: HelpCircle, color: "text-slate-400", bg: "bg-slate-800", border: "border-slate-700", label: t("Unassigned", "未分配"), desc: t("Needs allocation", "需要分配角色") }
  });

  const ROLE_CONFIGS = getRoleConfigs();

  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.uid) fetchWatchlist();
  }, [user?.uid]);

  const fetchWatchlist = async () => {
    if (!user?.uid) return;
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/watchlist?userId=${user.uid}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setWatchlist(data.watchlist);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  const removeItem = async (symbol: string) => {
    if (!user?.uid) return;
    try {
      const token = await getIdToken();
      const res = await fetch("/api/watchlist", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ symbol }),
      });
      if (res.ok) {
        setWatchlist((prev) => prev.filter((w) => w.symbol !== symbol));
      }
    } catch { /* ignore */ }
  };

  const updateRole = async (symbol: string, newRole: RoleKey) => {
    if (!user?.uid) return;
    const roleToSend = newRole === "unassigned" ? undefined : newRole;
    try {
      // Optimistic UI update
      setWatchlist(prev => prev.map(item => 
        item.symbol === symbol ? { ...item, role: roleToSend } : item
      ));

      const token = await getIdToken();
      await fetch("/api/watchlist", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId: user.uid, symbol, role: roleToSend }),
      });
    } catch { 
      // Revert on failure by refetching
      fetchWatchlist();
    }
  };

  // Group items
  const grouped = watchlist.reduce((acc, item) => {
    const role = item.role || "unassigned";
    if (!acc[role]) acc[role] = [];
    acc[role].push(item);
    return acc;
  }, {} as Record<string, WatchlistItem[]>);

  // Growth layout vs Value layout vs Unassigned
  const growthRoles: RoleKey[] = ["anchor", "striker", "rocket"];
  const valueRoles: RoleKey[] = ["core_dividend", "turnaround", "special_situation"];

  const renderStockCard = (item: WatchlistItem) => (
    <div key={item.symbol} className="bg-slate-800/40 border border-slate-700/60 rounded-xl px-3 py-2 flex items-center justify-between hover:bg-slate-800 hover:border-slate-600 transition-all group">
      <span className="font-bold text-white text-base tracking-wide">{item.symbol}</span>
      <div className="flex items-center gap-1.5">
        <div className="relative">
          <select
            value={item.role || "unassigned"}
            onChange={(e) => updateRole(item.symbol, e.target.value as RoleKey)}
            className="appearance-none bg-slate-900/60 border border-slate-700/50 hover:border-slate-600 text-xs text-slate-400 hover:text-slate-300 rounded-lg pl-2 pr-6 py-1 outline-none cursor-pointer transition-colors"
          >
            <option value="unassigned">--</option>
            <option value="anchor">{t("Anchor", "压舱石")}</option>
            <option value="striker">{t("Striker", "攻击手")}</option>
            <option value="rocket">{t("Rocket", "火箭")}</option>
            <option value="core_dividend">{t("Dividend", "收息")}</option>
            <option value="turnaround">{t("Turnaround", "反转")}</option>
            <option value="special_situation">{t("Special", "特殊")}</option>
          </select>
          <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2 top-2 pointer-events-none" />
        </div>
        <button
          onClick={() => removeItem(item.symbol)}
          className="p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title={t("Remove from portfolio", "从投资组合中移除")}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  const renderColumn = (roleKey: RoleKey) => {
    const config = ROLE_CONFIGS[roleKey];
    const items = grouped[roleKey] || [];
    const Icon = config.icon;

    return (
      <div key={roleKey} className={`flex flex-col rounded-2xl border ${config.border} bg-slate-900/50 overflow-hidden`}>
        <div className={`p-4 border-b ${config.border} ${config.bg} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-slate-900 ${config.color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h2 className={`font-bold ${config.color}`}>{config.label}</h2>
              <p className="text-xs text-slate-400">{config.desc}</p>
            </div>
          </div>
          <span className="text-sm font-mono font-bold text-slate-500 bg-slate-900 px-2.5 py-1 rounded-md">{items.length}</span>
        </div>
        <div className="p-4 flex-1 space-y-3 min-h-[150px]">
          {items.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-600 border-2 border-dashed border-slate-800 rounded-xl p-6 text-center">
              {t("No stocks assigned to this role", "尚未有股票分配至此角色")}
            </div>
          ) : (
            items.map(renderStockCard)
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <Gem className="w-5 h-5 text-blue-400" />
              <span className="font-bold text-white">Gems</span>
            </Link>
            <div className="h-5 w-px bg-slate-700" />
            <h1 className="text-sm font-semibold">{t("Portfolio Dashboard", "投资组合面板")}</h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-sm text-slate-400">
              {t("Total Conviction Picks:", "总计高信念优选：")} <span className="text-white font-bold">{watchlist.length}</span> / 10
            </div>
            <div className="h-5 w-px bg-slate-700" />
            <button 
              onClick={() => setLang(lang === "en" ? "zh" : "en")}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors border border-slate-700"
            >
              <Languages className="w-4 h-4 text-blue-400" />
              {lang === "en" ? "中文" : "English"}
            </button>
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Content — Premium Only */}
      <PremiumGate featureName={t("Portfolio Dashboard", "投资组合面板")}>
      <div className="flex-1 px-6 py-8 overflow-x-auto">
        <div className="max-w-7xl mx-auto min-w-[1000px]">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : watchlist.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <StarOff className="w-16 h-16 text-slate-700 mb-6" />
              <h2 className="text-2xl font-bold text-slate-300 mb-3">{t("Your Portfolio is Empty", "您的投资组合为空")}</h2>
              <p className="text-slate-500 mb-8 max-w-md">
                {t("Run a screening strategy to find high-conviction stocks and assign them to your portfolio formation.", "运行选股策略以寻找高信念股票，并将其分配到您的投资组合阵型中。")}
              </p>
              <Link
                href="/"
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all hover:scale-105 shadow-lg shadow-blue-500/20"
              >
                {t("Browse Strategies", "浏览策略")}
              </Link>
            </div>
          ) : (
            <div className="space-y-8">
              
              {/* Unassigned Pool */}
              {(grouped["unassigned"]?.length > 0) && (
                <div className="mb-8">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4" /> {t("Needs Allocation", "待分配")} ({grouped["unassigned"].length})
                  </h3>
                  <div className="grid grid-cols-4 gap-4">
                    {grouped["unassigned"].map(renderStockCard)}
                  </div>
                </div>
              )}

              {/* Growth Formation */}
              <div>
                <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-4">{t("Growth & Scale Formation", "成长与扩张阵型")}</h3>
                <div className="grid grid-cols-3 gap-6">
                  {growthRoles.map(renderColumn)}
                </div>
              </div>

              <div className="h-px bg-slate-800 my-8" />

              {/* Value Formation */}
              <div>
                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-widest mb-4">{t("Value & Income Formation", "价值与收益阵型")}</h3>
                <div className="grid grid-cols-3 gap-6">
                  {valueRoles.map(renderColumn)}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
      </PremiumGate>


    </div>
  );
}
