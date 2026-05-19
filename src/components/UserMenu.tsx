// ============================================================
// UserMenu — Header component showing auth state
// Shows login button or user avatar + dropdown
// ============================================================

"use client";

import { useState, useRef, useEffect } from "react";
import { LogIn, LogOut, Crown, User, ChevronDown } from "lucide-react";
import { useAuth, type PlanType } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import AuthModal from "./AuthModal";

const PLAN_BADGE: Record<PlanType, { label: string; labelZh: string; bg: string; text: string }> = {
  trial: { label: "Trial", labelZh: "试用", bg: "bg-slate-700", text: "text-slate-300" },
  paid: { label: "Paid", labelZh: "付费", bg: "bg-blue-500/20", text: "text-blue-400" },
  super: { label: "Super", labelZh: "超级", bg: "bg-amber-500/20", text: "text-amber-400" },
};

export default function UserMenu() {
  const { user, loading, signOut } = useAuth();
  const { t } = useLanguage();

  const [showModal, setShowModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-slate-800 animate-pulse" />
    );
  }

  // Not logged in — show sign in button
  if (!user) {
    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30"
        >
          <LogIn className="w-4 h-4" />
          {t("Sign In", "登录")}
        </button>
        {showModal && <AuthModal onClose={() => setShowModal(false)} />}
      </>
    );
  }

  // Logged in — show avatar + dropdown
  const planBadge = PLAN_BADGE[user.planType];
  const initials = (user.displayName || user.email || "U")
    .charAt(0)
    .toUpperCase();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600/50 rounded-xl transition-all"
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt=""
            className="w-7 h-7 rounded-full object-cover ring-2 ring-slate-700"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">
            {initials}
          </div>
        )}
        <span className="text-sm text-slate-300 font-medium hidden sm:inline max-w-[120px] truncate">
          {user.displayName || user.email}
        </span>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${planBadge.bg} ${planBadge.text}`}>
          {t(planBadge.label, planBadge.labelZh)}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* User info */}
          <div className="px-4 py-3 border-b border-slate-800">
            <p className="text-sm font-medium text-white truncate">
              {user.displayName || t("User", "用户")}
            </p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>

          {/* Plan info */}
          <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
            <Crown className={`w-4 h-4 ${planBadge.text}`} />
            <span className="text-sm text-slate-400">
              {t("Plan:", "计划：")}
            </span>
            <span className={`text-sm font-bold ${planBadge.text}`}>
              {t(planBadge.label, planBadge.labelZh)}
            </span>
            {user.isExpired && (
              <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                {t("Expired", "已过期")}
              </span>
            )}
          </div>

          {/* Actions */}
          {!user.isPremium && (
            <a
              href="https://dailystock.vanpower.live"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 transition-colors border-b border-slate-800"
            >
              <Crown className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-amber-400 font-medium">
                {t("Upgrade Plan", "升级计划")}
              </span>
            </a>
          )}

          <a
            href="https://dailystock.vanpower.live"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 transition-colors border-b border-slate-800"
          >
            <User className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-400">
              {t("DailyStock Portal", "DailyStock 主站")}
            </span>
          </a>

          <button
            onClick={async () => {
              await signOut();
              setShowDropdown(false);
            }}
            className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 transition-colors w-full text-left"
          >
            <LogOut className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-400">{t("Sign Out", "退出登录")}</span>
          </button>
        </div>
      )}
    </div>
  );
}
