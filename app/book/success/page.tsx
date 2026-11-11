import type { Metadata } from "next";
import { BookingSuccess } from "@/components/BookingFlow";

export const metadata: Metadata = { title: "Booking request saved", robots: { index: false, follow: false } };

export default async function BookingSuccessPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  const reference = typeof ref === "string" && /^CW-\d{4,10}$/i.test(ref) ? ref.toUpperCase() : "Booking";
  return <BookingSuccess reference={reference} />;
}
