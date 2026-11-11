"use client";

import { ArrowDown, ArrowUpRight, Sparkles } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

export function HomeHeroCopy({ tagline }: { tagline: string }) {
  const { t } = useLanguage();
  return <div className="hero-copy"><div className="eyebrow"><Sparkles size={14} /> {t("heroEyebrow")}</div><h1>{t("heroFirst")}<br /><em>{t("heroSecond")}</em></h1><p>{tagline} {t("heroDescription")}</p><div className="hero-actions"><a href="/book" className="button">{t("heroBook")} <ArrowUpRight size={17} /></a><a href="#services" className="text-link">{t("exploreServices")} <ArrowDown size={15} /></a></div></div>;
}
