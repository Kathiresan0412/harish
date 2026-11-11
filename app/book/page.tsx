import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Waves } from "lucide-react";
import { BookingFlow } from "@/components/BookingFlow";
import { defaultAvailability } from "@/lib/availability-defaults";
import { getPublicCatalog } from "@/lib/public-catalog";
import { localDateKey } from "@/lib/slots";
import { whatsappDigits } from "@/lib/public-safety";
import { connectToDatabase } from "@/lib/db";
import { AvailabilitySettings } from "@/models/Operations";
import { BusinessSettings } from "@/models/BusinessSettings";
import { ThemeSettings } from "@/models/ThemeSettings";

export const metadata: Metadata = { title: "Book a wash", description: "Choose a car wash service and view available appointment times.", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function BookPage() {
  const catalogPromise = getPublicCatalog();
  let settings = defaultAvailability;
  let businessName = "Harbor Auto Spa";
  let whatsappNumber = "";
  if (process.env.MONGODB_URI) {
    await connectToDatabase();
    const [savedAvailability, business, theme] = await Promise.all([
      AvailabilitySettings.findOne({ key: "default" }).lean() as unknown as Promise<{ timezone?: string; weeklyHours?: unknown[]; [key: string]: unknown } | null>,
      BusinessSettings.findOne({ key: "default" }).lean() as unknown as Promise<{ whatsappNumber?: string } | null>,
      ThemeSettings.findOne({ key: "default" }).lean() as unknown as Promise<{ businessName?: string } | null>,
    ]);
    if (savedAvailability) settings = { ...defaultAvailability, ...JSON.parse(JSON.stringify(savedAvailability)) };
    whatsappNumber = business?.whatsappNumber ?? "";
    businessName = theme?.businessName ?? businessName;
  }
  const catalog = await catalogPromise;
  const serializableSettings = JSON.parse(JSON.stringify(settings));
  const today = localDateKey(new Date(), settings.timezone);
  return <main className="booking-page"><a className="skip-link" href="#booking-content">Skip to booking form</a><header className="booking-public-nav" aria-label="Booking navigation"><Link href="/" className="brand-lockup"><span className="brand-mark"><Waves size={20} /></span><span><strong>{businessName}</strong><small>AT-HOME AUTO CARE</small></span></Link><Link className="booking-nav-back" href="/services"><ArrowLeft size={14} /> Services</Link></header><div id="booking-content"><BookingFlow services={catalog.services} addons={catalog.addons} vehicles={catalog.vehicles} settings={serializableSettings} today={today} businessName={businessName} whatsappReady={Boolean(whatsappDigits(whatsappNumber))} /></div><footer className="booking-page-footer">Your booking details are private. <Link href="/lookup">Look up an existing booking</Link></footer></main>;
}
