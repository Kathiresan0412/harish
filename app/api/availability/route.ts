import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { defaultAvailability } from "@/lib/availability-defaults";
import { generateAvailableSlots, storedDateKey, type SlotBooking, type SlotBlock } from "@/lib/slots";
import { Booking } from "@/models/Booking";
import { AvailabilitySettings, BlockedSlot } from "@/models/Operations";

export const dynamic = "force-dynamic";

const querySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), duration: z.coerce.number().int().min(1).max(600) });

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ date: url.searchParams.get("date"), duration: url.searchParams.get("duration") });
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid date and duration." }, { status: 400 });
  const dateStart = new Date(`${parsed.data.date}T00:00:00.000Z`);
  if (Number.isNaN(dateStart.getTime()) || dateStart.toISOString().slice(0, 10) !== parsed.data.date) return NextResponse.json({ error: "Choose a valid calendar date." }, { status: 400 });
  const dateEnd = new Date(dateStart.getTime() + 86_400_000);

  try {
    await connectToDatabase();
    const [settingsDoc, bookingDocs, blockedDocs] = await Promise.all([
      AvailabilitySettings.findOne({ key: "default" }).lean(),
      Booking.find({ date: { $gte: dateStart, $lt: dateEnd }, status: { $in: ["Pending", "Confirmed", "In Progress"] } }).select("date startTime endTime status pendingExpiresAt").lean(),
      BlockedSlot.find({ date: { $gte: dateStart, $lt: dateEnd } }).select("date startTime endTime allDay").lean(),
    ]);
    const settings = settingsDoc ? { ...defaultAvailability, ...JSON.parse(JSON.stringify(settingsDoc)) } : defaultAvailability;
    const bookings: SlotBooking[] = bookingDocs.map((booking) => ({ dateKey: storedDateKey(booking.date), startTime: booking.startTime, endTime: booking.endTime, status: booking.status, pendingExpiresAt: booking.pendingExpiresAt }));
    const blocks: SlotBlock[] = blockedDocs.map((block) => ({ dateKey: storedDateKey(block.date), startTime: block.startTime, endTime: block.endTime, allDay: block.allDay }));
    const slots = generateAvailableSlots({ date: parsed.data.date, durationMinutes: parsed.data.duration, settings, bookings, blockedSlots: blocks });
    return NextResponse.json({ date: parsed.data.date, timezone: settings.timezone, slots }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Availability is temporarily unavailable." }, { status: 503 });
  }
}
