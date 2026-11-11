import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Clock3, Waves } from "lucide-react";
import { PublicAddonList, PublicServiceCards } from "@/components/PublicCatalog";
import { getPublicCatalog } from "@/lib/public-catalog";
import { defaultTheme } from "@/lib/theme";
import { connectToDatabase } from "@/lib/db";
import { ThemeSettings } from "@/models/ThemeSettings";
import { LocalizedCopy as L } from "@/components/LocalizedCopy";

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
  return <main className="public-shell services-page"><nav className="public-nav"><Link href="/" className="brand-lockup"><span className="brand-mark"><Waves size={20} /></span><span><strong>{theme.businessName}</strong><small>AT-HOME AUTO CARE</small></span></Link><div className="nav-links"><Link href="/#services"><L en="Our services" ta="எங்கள் சேவைகள்" si="අපගේ සේවා" /></Link><Link href="/#visit"><L en="Find us" ta="எங்களைக் கண்டறியுங்கள்" si="අපව සොයන්න" /></Link></div><Link className="button nav-book" href="/book"><L en="Book a wash" ta="கழுவ முன்பதிவு" si="සේවාවක් වෙන්කරන්න" /> <ArrowUpRight size={16} /></Link></nav>
    <Link className="back-link public-back-link" href="/"><ArrowLeft size={14} /> <L en="Home" ta="முகப்பு" si="මුල් පිටුව" /></Link><header className="services-heading"><div className="eyebrow"><SparklesIcon /> <L en="CARE FOR EVERY KIND OF DRIVE" ta="ஒவ்வொரு பயணத்திற்கும் பராமரிப்பு" si="සෑම ගමනකටම සැලකිල්ල" /></div><h1><L en="A little care goes" ta="சிறு கவனம்" si="කුඩා සැලකිල්ලක්" /><br /><em><L en="a long way." ta="பெரிய மாற்றம் தரும்." si="විශාල වෙනසක් කරයි." /></em></h1><p><L en="Find the right wash for your vehicle. Prices vary by vehicle type so you know what to expect." ta="உங்கள் வாகனத்திற்கான சரியான சுத்தத்தைத் தேர்ந்தெடுங்கள். வாகன வகைக்கு ஏற்ப விலைகள் மாறும்." si="ඔබේ වාහනයට ගැළපෙන සේදීම තෝරන්න. වාහන වර්ගය අනුව මිල වෙනස් වේ." /></p></header>
    <section className="services-catalog"><div className="catalog-public-title"><div><span className="eyebrow"><L en="THE SERVICE MENU" ta="சேவை பட்டியல்" si="සේවා ලැයිස්තුව" /></span><h2><L en="Pick your kind of clean." ta="உங்கள் சுத்தத்தைத் தேர்ந்தெடுங்கள்." si="ඔබේ පිරිසිදු කිරීම තෝරන්න." /></h2></div><span className="catalog-time-note"><Clock3 size={14} /> <L en="Times are approximate" ta="நேரம் தோராயமானது" si="කාලය ආසන්න ඇස්තමේන්තුවකි" /></span></div><PublicServiceCards services={catalog.services} vehicles={catalog.vehicles} /><PublicAddonList addons={catalog.addons} vehicles={catalog.vehicles} /></section>
    <section className="services-contact"><div><span className="eyebrow"><L en="NOT SURE WHAT YOU NEED?" ta="எது தேவை எனத் தெரியவில்லையா?" si="ඔබට අවශ්‍ය දේ ගැන විශ්වාස නැද්ද?" /></span><h2><L en="We can help you choose." ta="தேர்வு செய்ய நாங்கள் உதவுவோம்." si="තෝරා ගැනීමට අපි උදව් කරන්නම්." /></h2><p><L en="Tell us about your vehicle and we’ll recommend the right service." ta="உங்கள் வாகனத்தைப் பற்றிச் சொல்லுங்கள்; சரியான சேவையைப் பரிந்துரைக்கிறோம்." si="ඔබේ වාහනය ගැන කියන්න; අපි සුදුසු සේවාව නිර්දේශ කරන්නම්." /></p></div><Link className="button" href="/book"><L en="Book your wash" ta="கழுவ முன்பதிவு" si="සේවාව වෙන්කරන්න" /> <ArrowUpRight size={16} /></Link></section>
    <footer className="public-footer"><Link href="/" className="brand-lockup"><span className="brand-mark"><Waves size={19} /></span><span><strong>{theme.businessName}</strong><small>AT-HOME AUTO CARE</small></span></Link><span><L en="Good people. Clean cars. Happy drives." ta="நல்ல மனிதர்கள். சுத்தமான கார்கள். மகிழ்ச்சியான பயணங்கள்." si="හොඳ මිනිසුන්. පිරිසිදු වාහන. සතුටු ගමන්." /></span><a href="/admin/login"><L en="Owner sign in" ta="உரிமையாளர் உள்நுழைவு" si="හිමිකරු පිවිසීම" /></a><small>© {new Date().getFullYear()} {theme.businessName}</small></footer>
  </main>;
}

function SparklesIcon() { return <span aria-hidden="true">✦</span>; }
