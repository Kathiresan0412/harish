"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { languageNames, type Language, msg, type MessageKey } from "@/lib/i18n";

const LanguageContext = createContext<{ language: Language; t: (key: MessageKey) => string }>({ language: "en", t: (key) => msg("en", key) });
export function useLanguage() { return useContext(LanguageContext); }

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [language, setLanguage] = useState<Language>("en");
  useEffect(() => {
    const saved = localStorage.getItem("site-language");
    if (saved === "ta" || saved === "si" || saved === "en") setLanguage(saved);
  }, []);
  function changeLanguage(value: Language) {
    setLanguage(value);
    localStorage.setItem("site-language", value);
    document.documentElement.lang = value;
  }
  return <LanguageContext.Provider value={{ language, t: (key) => msg(language, key) }}>
    {!pathname.startsWith("/admin") && <label className="language-picker"><span>{msg(language, "language")}</span><select aria-label={msg(language, "language")} value={language} onChange={(event) => changeLanguage(event.target.value as Language)}>{Object.entries(languageNames).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>}
    {children}
  </LanguageContext.Provider>;
}
