"use client";

import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { Sun, Moon } from "lucide-react";
import { useLanguage } from "./language-context";

export type ThemeMode = "dark" | "light";

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("dark");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("gems-theme") as ThemeMode | null;
      if (saved === "light" || saved === "dark") {
        setThemeState(saved);
        document.documentElement.setAttribute("data-theme", saved);
      } else {
        document.documentElement.setAttribute("data-theme", "dark");
      }
    } catch {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  const setTheme = (next: ThemeMode) => {
    setThemeState(next);
    try {
      localStorage.setItem("gems-theme", next);
    } catch {}
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", next);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeToggleButton({ showLabel = false, className = "" }: { showLabel?: boolean; className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isLight ? t("Switch to Dark Mode", "切换至暗黑模式") : t("Switch to Light Mode", "切换至明亮模式")}
      aria-label={isLight ? t("Switch to Dark Mode", "切换至暗黑模式") : t("Switch to Light Mode", "切换至明亮模式")}
      className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/80 hover:border-slate-600 text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${className}`}
    >
      {isLight ? (
        <>
          <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400 shrink-0" />
          {showLabel && <span>{t("Dark", "暗黑")}</span>}
        </>
      ) : (
        <>
          <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
          {showLabel && <span>{t("Light", "明亮")}</span>}
        </>
      )}
    </button>
  );
}
