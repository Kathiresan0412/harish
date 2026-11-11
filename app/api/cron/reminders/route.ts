import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { reminderIntegrationStatus, sendBookingReminder } from "@/lib/reminders";
import { localDateKey } from "@/lib/slots";
import { Booking } from "@/models/Booking";
import { AvailabilitySettings } from "@/models/Operations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!reminderIntegrationStatus().configured) return NextResponse.json({ error: "Reminder integration is not configured." }, { status: 503 });
  await connectToDatabase();
  const settings = await AvailabilitySettings.findOne({ key: "default" }).select("timezone").lean() as unknown as { timezone?: string } | null;
  const timezone = settings?.timezone ?? "Asia/Colombo";
  const tomorrow = new Date(`${localDateKey(new Date(), timezone)}T00:00:00.000Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const staleClaim = new Date(Date.now() - 15 * 60_000);
  let sent = 0;
  let failed = 0;
  const failedIds: unknown[] = [];
  for (let count = 0; count < 100; count++) {
    const booking = await Booking.findOneAndUpdate({ date: tomorrow, status: "Confirmed", reminderSentAt: null, _id: { $nin: failedIds }, $or: [{ reminderClaimedAt: null }, { reminderClaimedAt: { $lt: staleClaim } }] }, { $set: { reminderClaimedAt: new Date() } }, { new: true }).select("reference customer date startTime").lean() as unknown as { _id: unknown; reference: string; customer: { name: string; phone: string }; date: Date; startTime: string } | null;
    if (!booking) break;
    try {
      await sendBookingReminder({ reference: booking.reference, customer: booking.customer, date: booking.date.toISOString().slice(0, 10), startTime: booking.startTime });
      await Booking.updateOne({ _id: booking._id, reminderSentAt: null }, { $set: { reminderSentAt: new Date() }, $unset: { reminderClaimedAt: 1 } });
      sent++;
    } catch {
      await Booking.updateOne({ _id: booking._id, reminderSentAt: null }, { $unset: { reminderClaimedAt: 1 } });
      failedIds.push(booking._id);
      failed++;
    }
  }
  return NextResponse.json({ sent, failed, date: tomorrow.toISOString().slice(0, 10) }, { headers: { "Cache-Control": "no-store" } });
}
