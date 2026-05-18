"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Lang = "en" | "zh";

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (en: string, zh: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "zh",
  setLang: () => {},
  t: (en, zh) => zh,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("zh");

  // Persist language preference in localStorage
  useEffect(() => {
    const stored = localStorage.getItem("gems-lang") as Lang | null;
    if (stored === "en" || stored === "zh") {
      setLangState(stored);
    }
  }, []);

  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem("gems-lang", newLang);
  };

  const t = (en: string, zh: string) => (lang === "en" ? en : zh);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
