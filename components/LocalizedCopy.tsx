"use client";

import { useLanguage } from "@/components/LanguageProvider";

export function LocalizedCopy({ en, ta, si }: { en: string; ta: string; si: string }) {
  const { language } = useLanguage();
  return <>{language === "ta" ? ta : language === "si" ? si : en}</>;
}
