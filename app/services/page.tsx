import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Clock3, Waves } from "lucide-react";
import { PublicAddonList, PublicServiceCards } from "@/components/PublicCatalog";
import { getPublicCatalog } from "@/lib/public-catalog";
import { defaultTheme } from "@/lib/theme";
import { connectToDatabase } from "@/lib/db";
import { ThemeSettings } from "@/models/ThemeSettings";

export const metadata: Metadata = { title: "Services & Pricing", description: "Browse car wash services, durations and prices by vehicle type." };
export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const catalogPromise = getPublicCatalog();
  let theme = defaultTheme;
  if (process.env.MONGODB_URI) {
    try {
      await connectToDatabase();
      const saved = await ThemeSettings.findOne({ key: "default" }).lean();
      if (saved) theme = { ...defaultTheme, ...JSON.parse(JSON.stringify(saved)) };
    } catch { /* Public catalog can render with the default business name. */ }
  }
  const catalog = await catalogPromise;
  return <main className="public-shell services-page"><nav className="public-nav"><Link href="/" className="brand-lockup"><span className="brand-mark"><Waves size={20} /></span><span><strong>{theme.businessName}</strong><small>AT-HOME AUTO CARE</small></span></Link><div className="nav-links"><Link href="/#services">Our services</Link><Link href="/#visit">Find us</Link></div><Link className="button nav-book" href="/book">Book a wash <ArrowUpRight size={16} /></Link></nav>
    <Link className="back-link public-back-link" href="/"><ArrowLeft size={14} /> Home</Link><header className="services-heading"><div className="eyebrow"><SparklesIcon /> CARE FOR EVERY KIND OF DRIVE</div><h1>A little care goes<br /><em>a long way.</em></h1><p>Find the right wash for your vehicle. Prices vary by vehicle type so you know what to expect.</p></header>
    <section className="services-catalog"><div className="catalog-public-title"><div><span className="eyebrow">THE SERVICE MENU</span><h2>Pick your kind of clean.</h2></div><span className="catalog-time-note"><Clock3 size={14} /> Times are approximate</span></div><PublicServiceCards services={catalog.services} vehicles={catalog.vehicles} /><PublicAddonList addons={catalog.addons} vehicles={catalog.vehicles} /></section>
    <section className="services-contact"><div><span className="eyebrow">NOT SURE WHAT YOU NEED?</span><h2>We can help you choose.</h2><p>Tell us about your vehicle and we’ll recommend the right service.</p></div><Link className="button" href="/book">Book your wash <ArrowUpRight size={16} /></Link></section>
    <footer className="public-footer"><Link href="/" className="brand-lockup"><span className="brand-mark"><Waves size={19} /></span><span><strong>{theme.businessName}</strong><small>AT-HOME AUTO CARE</small></span></Link><span>Good people. Clean cars. Happy drives.</span><a href="/admin/login">Owner sign in</a><small>© {new Date().getFullYear()} {theme.businessName}</small></footer>
  </main>;
}

function SparklesIcon() { return <span aria-hidden="true">✦</span>; }
