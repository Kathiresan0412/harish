import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { allowPublicRequest, normalizePhone } from "@/lib/public-safety";
import { localDateKey, zonedTimeToEpoch } from "@/lib/slots";
import { Booking } from "@/models/Booking";
import { AvailabilitySettings } from "@/models/Operations";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  reference: z.string().trim().regex(/^CW-\d{4,10}$/i),
  phone: z.string().trim().min(8).max(24),
  action: z.enum(["lookup", "request"]).default("lookup"),
  requestType: z.enum(["cancel", "reschedule"]).optional(),
  requestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  requestedStartTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional(),
  note: z.string().trim().max(300).default(""),
  website: z.string().max(0).optional(),
});

function validDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function POST(request: Request) {
  let raw: unknown;
  try { raw = await request.json(); }
  catch { return NextResponse.json({ error: "Enter your booking reference and phone number." }, { status: 400 }); }
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success || (parsed.data.requestedDate && !validDate(parsed.data.requestedDate))) return NextResponse.json({ error: "Check the details and try again." }, { status: 400 });
  if (parsed.data.website) return NextResponse.json({ error: "Unable to accept this request." }, { status: 400 });
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
  try {
    await connectToDatabase();
    if (!(await allowPublicRequest(request, "booking-lookup", 20))) return NextResponse.json({ error: "Too many attempts. Please wait and try again." }, { status: 429 });
  } catch {
    return NextResponse.json({ error: "Lookup is temporarily unavailable." }, { status: 503 });
  }

  const booking = await Booking.findOne({ reference: parsed.data.reference.toUpperCase(), "customer.phone": phone });
  if (!booking) return NextResponse.json({ error: "We couldn’t find a booking with that reference and phone number." }, { status: 404 });

  if (parsed.data.action === "request") {
    if (!["Pending", "Confirmed"].includes(booking.status)) return NextResponse.json({ error: "This booking can no longer be changed online. Please contact the business." }, { status: 409 });
    if (booking.customerRequest?.status === "Pending") return NextResponse.json({ error: "You already have a request waiting for the owner." }, { status: 409 });
    const type = parsed.data.requestType;
    if (!type) return NextResponse.json({ error: "Choose cancellation or reschedule." }, { status: 400 });
    if (type === "reschedule" && (!parsed.data.requestedDate || !parsed.data.requestedStartTime)) return NextResponse.json({ error: "Choose a requested date and time." }, { status: 400 });
    if (type === "reschedule" && parsed.data.requestedDate && parsed.data.requestedStartTime) {
      const availability = await AvailabilitySettings.findOne({ key: "default" }).select("timezone").lean() as unknown as { timezone?: string } | null;
      const timezone = availability?.timezone ?? "Asia/Colombo";
      const requestedAt = zonedTimeToEpoch(parsed.data.requestedDate, parsed.data.requestedStartTime, timezone);
      if (!requestedAt || parsed.data.requestedDate < localDateKey(new Date(), timezone) || requestedAt <= Date.now()) return NextResponse.json({ error: "Choose a future date and time for your reschedule request." }, { status: 400 });
    }
    booking.customerRequest = {
      type,
      requestedDate: type === "reschedule" && parsed.data.requestedDate ? new Date(`${parsed.data.requestedDate}T00:00:00.000Z`) : null,
      requestedStartTime: type === "reschedule" ? parsed.data.requestedStartTime ?? "" : "",
      note: parsed.data.note,
      status: "Pending",
      createdAt: new Date(),
    };
    await booking.save();
    return NextResponse.json({ message: "Your request has been sent to the owner for approval." }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({ booking: {
    reference: booking.reference,
    status: booking.status,
    date: booking.date.toISOString().slice(0, 10),
    startTime: booking.startTime,
    endTime: booking.endTime,
    vehicleType: booking.vehicleTypeName,
    vehicleNumber: booking.vehicleNumber,
    items: booking.items.map((item: { name: string; kind: string }) => ({ name: item.name, kind: item.kind })),
    totalPrice: booking.totalPrice,
    paymentStatus: booking.paymentStatus,
    customerRequest: booking.customerRequest ? { type: booking.customerRequest.type, status: booking.customerRequest.status, requestedDate: booking.customerRequest.requestedDate?.toISOString().slice(0, 10) ?? null, requestedStartTime: booking.customerRequest.requestedStartTime } : null,
  } }, { headers: { "Cache-Control": "no-store" } });
}
