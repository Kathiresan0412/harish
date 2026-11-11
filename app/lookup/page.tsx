import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Waves } from "lucide-react";
import { BookingLookup } from "@/components/BookingLookup";
import { defaultAvailability } from "@/lib/availability-defaults";
import { localDateKey } from "@/lib/slots";
import { connectToDatabase } from "@/lib/db";
import { AvailabilitySettings } from "@/models/Operations";
import { ThemeSettings } from "@/models/ThemeSettings";

export const metadata: Metadata = { title: "Look up your booking", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function LookupPage() {
  let timezone = defaultAvailability.timezone;
  let businessName = "Harbor Auto Spa";
  if (process.env.MONGODB_URI) {
    await connectToDatabase();
    const [settings, theme] = await Promise.all([
      AvailabilitySettings.findOne({ key: "default" }).lean() as unknown as Promise<{ timezone?: string } | null>,
      ThemeSettings.findOne({ key: "default" }).lean() as unknown as Promise<{ businessName?: string } | null>,
    ]);
    timezone = settings?.timezone ?? timezone;
    businessName = theme?.businessName ?? businessName;
  }
  const today = localDateKey(new Date(), timezone);
  return <main className="booking-page"><header className="booking-public-nav"><Link href="/" className="brand-lockup"><span className="brand-mark"><Waves size={20} /></span><span><strong>{businessName}</strong><small>AT-HOME AUTO CARE</small></span></Link><Link className="booking-nav-back" href="/"><ArrowLeft size={14} /> Home</Link></header><BookingLookup today={today} /></main>;
}
