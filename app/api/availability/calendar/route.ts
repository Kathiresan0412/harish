import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { defaultAvailability } from "@/lib/availability-defaults";
import { generateAvailableSlots, storedDateKey, type SlotBooking, type SlotBlock } from "@/lib/slots";
import { Booking } from "@/models/Booking";
import { AvailabilitySettings, BlockedSlot } from "@/models/Operations";

export const dynamic = "force-dynamic";
const querySchema = z.object({ start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), duration: z.coerce.number().int().min(1).max(600), days: z.coerce.number().int().min(1).max(62).default(42) });

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ start: url.searchParams.get("start"), duration: url.searchParams.get("duration"), days: url.searchParams.get("days") ?? "42" });
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid calendar range." }, { status: 400 });
  const dateStart = new Date(`${parsed.data.start}T00:00:00.000Z`);
  if (Number.isNaN(dateStart.getTime()) || dateStart.toISOString().slice(0, 10) !== parsed.data.start) return NextResponse.json({ error: "Choose a valid calendar date." }, { status: 400 });
  const dateEnd = new Date(dateStart.getTime() + parsed.data.days * 86_400_000);
  try {
    await connectToDatabase();
    const [saved, bookingDocs, blockDocs] = await Promise.all([
      AvailabilitySettings.findOne({ key: "default" }).lean(),
      Booking.find({ date: { $gte: dateStart, $lt: dateEnd }, status: { $in: ["Pending", "Confirmed", "In Progress"] } }).select("date startTime endTime status pendingExpiresAt").lean(),
      BlockedSlot.find({ date: { $gte: dateStart, $lt: dateEnd } }).select("date startTime endTime allDay").lean(),
    ]);
    const savedSettings = saved ? JSON.parse(JSON.stringify(saved)) : {};
    const settings = { ...defaultAvailability, ...savedSettings, weeklyHours: savedSettings.weeklyHours?.length ? savedSettings.weeklyHours : defaultAvailability.weeklyHours };
    const bookings: SlotBooking[] = bookingDocs.map((booking) => ({ dateKey: storedDateKey(booking.date), startTime: booking.startTime, endTime: booking.endTime, status: booking.status, pendingExpiresAt: booking.pendingExpiresAt }));
    const blocks: SlotBlock[] = blockDocs.map((block) => ({ dateKey: storedDateKey(block.date), startTime: block.startTime, endTime: block.endTime, allDay: block.allDay }));
    const now = new Date();
    const availableDates: string[] = [];
    for (let day = 0; day < parsed.data.days; day++) {
      const date = new Date(dateStart.getTime() + day * 86_400_000).toISOString().slice(0, 10);
      const slots = generateAvailableSlots({ date, durationMinutes: parsed.data.duration, settings, bookings, blockedSlots: blocks, now });
      if (slots.length) availableDates.push(date);
    }
    return NextResponse.json({ start: parsed.data.start, availableDates, timezone: settings.timezone }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Availability is temporarily unavailable." }, { status: 503 });
  }
}
