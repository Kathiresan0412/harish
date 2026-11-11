import { ArrowDown, ArrowUpRight, Clock3, MapPin, Sparkles, Waves } from "lucide-react";
import Image from "next/image";
import { connectToDatabase } from "@/lib/db";
import { defaultTheme } from "@/lib/theme";
import { ThemeSettings } from "@/models/ThemeSettings";
import { BusinessSettings } from "@/models/BusinessSettings";
import { getPublicCatalog } from "@/lib/public-catalog";
import { PublicAddonList, PublicServiceCards } from "@/components/PublicCatalog";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let theme = defaultTheme;
  let business = { address: "Your neighborhood", mapUrl: "" };
  let catalog = { services: [], addons: [], vehicles: [] } as Awaited<ReturnType<typeof getPublicCatalog>>;
  if (process.env.MONGODB_URI) {
    try {
      await connectToDatabase();
      const [savedTheme, savedBusiness, savedCatalog] = await Promise.all([ThemeSettings.findOne({ key: "default" }).lean(), BusinessSettings.findOne({ key: "default" }).lean(), getPublicCatalog()]);
      if (savedTheme) theme = { ...defaultTheme, ...JSON.parse(JSON.stringify(savedTheme)) };
      if (savedBusiness) business = { ...business, ...JSON.parse(JSON.stringify(savedBusiness)) };
      catalog = savedCatalog;
    } catch { /* Show defaults until configuration is available. */ }
  }
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const localBusiness = { "@context": "https://schema.org", "@type": "AutoWash", name: theme.businessName, description: theme.tagline, url: baseUrl, telephone: (business as typeof business & { phone?: string }).phone || undefined, address: business.address !== "Your neighborhood" ? business.address : undefined, image: theme.logoUrl || undefined, priceRange: "LKR" };
  const jsonLd = JSON.stringify(localBusiness).replaceAll("<", "\\u003c");
  return <main className="public-shell"><a className="skip-link" href="#main-content">Skip to content</a><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} /><nav className="public-nav" aria-label="Main navigation"><a href="#top" className="brand-lockup"><span className="brand-mark" style={{ background: "var(--primary)" }}>{theme.logoUrl ? <Image src={theme.logoUrl} alt="" width={40} height={40} unoptimized /> : <Waves size={21} />}</span><span><strong>{theme.businessName}</strong><small>AT-HOME AUTO CARE</small></span></a><div className="nav-links"><a href="#services">Our services</a><a href="#visit">Find us</a></div><a className="button nav-book" href="/book">Book a wash <ArrowUpRight size={16} /></a></nav>
    <section className="hero" id="main-content"><div className="hero-copy"><div className="eyebrow"><Sparkles size={14} /> A LITTLE EXTRA CARE GOES A LONG WAY</div><h1>Make every drive<br /><em>feel like new.</em></h1><p>{theme.tagline} A thoughtful wash and detail, right in your neighborhood.</p><div className="hero-actions"><a href="/book" className="button">Book your wash <ArrowUpRight size={17} /></a><a href="#services" className="text-link">Explore services <ArrowDown size={15} /></a></div><div className="hero-meta"><span><Clock3 size={15} /> Mon–Sat, 8am–5pm</span><span><MapPin size={15} /> {business.address}</span></div></div><div className="hero-art" aria-label="Illustration of a freshly washed car"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="sun-disc" /><div className="bubble bubble-one" /><div className="bubble bubble-two" /><div className="bubble bubble-three" /><div className="car-shadow" /><div className="car-body"><div className="car-roof" /><div className="car-window window-left" /><div className="car-window window-right" /><div className="car-light" /><div className="car-wheel wheel-left" /><div className="car-wheel wheel-right" /><div className="car-highlight" /></div><span className="art-caption">THE NEIGHBORHOOD SHINE</span></div></section>
    <div className="trust-strip"><span>PERSONAL, CAREFUL SERVICE</span><i /><span>NO RUSH, NO SHORTCUTS</span><i /><span>MADE FOR YOUR DAILY DRIVE</span></div>
    <section id="services" className="intro-section"><div className="eyebrow">THE GOOD CLEAN</div><div className="intro-content"><h2>Great care.<br />Right where you are.</h2><div><p>From a quick refresh to a little well-earned pampering, your car gets the time and attention it deserves. Explore our services and pricing by vehicle type.</p><a className="inline-link" href="/services">See all services <ArrowUpRight size={15} /></a></div></div><PublicServiceCards services={catalog.services.slice(0, 3)} vehicles={catalog.vehicles} /><PublicAddonList addons={catalog.addons.slice(0, 3)} vehicles={catalog.vehicles} /></section>
    <section id="visit" className="visit-section"><div><div className="eyebrow">COME SAY HELLO</div><h2>Your car&apos;s new<br /><em>happy place.</em></h2><p>{business.address}. Get in touch for availability and directions.</p>{business.mapUrl && <a className="button" href={business.mapUrl} target="_blank" rel="noreferrer">Get directions <ArrowUpRight size={16} /></a>}</div><div className="visit-card"><span className="visit-icon"><Clock3 /></span><span className="eyebrow">WHEN WE&apos;RE OPEN</span><h3>Monday – Saturday</h3><p>8:00 am — 5:00 pm</p><div className="closed-note">Sunday · taking a little rest</div></div></section>
    <footer className="public-footer"><a href="#top" className="brand-lockup"><span className="brand-mark"><Waves size={19} /></span><span><strong>{theme.businessName}</strong><small>AT-HOME AUTO CARE</small></span></a><span>Good people. Clean cars. Happy drives.</span><a href="/lookup">My booking</a><a href="/admin/login">Owner sign in</a><small>© {new Date().getFullYear()} {theme.businessName}</small></footer><a className="mobile-book" href="/book">Let&apos;s get your car shining <ArrowUpRight size={17} /></a></main>;
}
