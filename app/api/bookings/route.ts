import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { defaultAvailability } from "@/lib/availability-defaults";
import { allowPublicRequest, normalizePhone, whatsappDigits } from "@/lib/public-safety";
import { generateAvailableSlots, storedDateKey, zonedTimeToEpoch, type SlotBooking, type SlotBlock } from "@/lib/slots";
import { Addon, Service, VehicleType } from "@/models/catalog";
import { Booking } from "@/models/Booking";
import { AvailabilitySettings, BlockedSlot, Counter, Customer } from "@/models/Operations";
import { BusinessSettings } from "@/models/BusinessSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bookingInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  vehicleTypeId: z.string().regex(/^[a-f\d]{24}$/i),
  serviceIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1).max(10),
  addonIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(10),
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(8).max(24),
  vehicleNumber: z.string().trim().max(20),
  notes: z.string().trim().max(500),
  website: z.string().max(0).optional(),
});

function formatLkr(amount: number) {
  return new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 2 }).format(amount / 100);
}

function isValidDateKey(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 16_000) return NextResponse.json({ error: "Booking details are too large." }, { status: 413 });
  let raw: unknown;
  try { raw = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid booking request." }, { status: 400 }); }
  const parsed = bookingInput.safeParse(raw);
  if (!parsed.success || !isValidDateKey(parsed.data?.date ?? "")) return NextResponse.json({ error: "Check the booking details and try again." }, { status: 400 });
  if (parsed.data.website) return NextResponse.json({ error: "Unable to accept this request." }, { status: 400 });
  const customerPhone = normalizePhone(parsed.data.phone);
  if (!customerPhone) return NextResponse.json({ error: "Enter a valid phone number with country code, or a Sri Lankan mobile number." }, { status: 400 });

  try {
    await connectToDatabase();
    if (!(await allowPublicRequest(request, "booking-create", 8))) return NextResponse.json({ error: "Too many booking requests. Please try again in a few minutes." }, { status: 429 });
  } catch {
    return NextResponse.json({ error: "Booking is temporarily unavailable. Please try again." }, { status: 503 });
  }

  const data = parsed.data;
  if (new Set(data.serviceIds).size !== data.serviceIds.length || new Set(data.addonIds).size !== data.addonIds.length) return NextResponse.json({ error: "Remove duplicate services and try again." }, { status: 400 });
  const dateStart = new Date(`${data.date}T00:00:00.000Z`);
  const dateEnd = new Date(dateStart.getTime() + 86_400_000);
  const connection = await connectToDatabase();
  const session = await connection.startSession();
  let responseData: Record<string, unknown> | null = null;
  let failure = "Unable to confirm this booking. Please try again.";
  let status = 500;

  try {
    await session.withTransaction(async () => {
      // Writing this single per-business record serializes booking attempts before the overlap check.
      // The slot is re-checked in the same transaction that inserts the booking.
      const availabilityDoc = await AvailabilitySettings.findOneAndUpdate(
        { key: "default" }, { $inc: { reservationVersion: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true, session },
      ).lean();
      const savedSettings = availabilityDoc ? JSON.parse(JSON.stringify(availabilityDoc)) : {};
      const settings = { ...defaultAvailability, ...savedSettings, weeklyHours: savedSettings.weeklyHours?.length ? savedSettings.weeklyHours : defaultAvailability.weeklyHours };

      const vehicle = await VehicleType.findOne({ _id: data.vehicleTypeId, active: true }).session(session).lean() as unknown as { _id: mongoose.Types.ObjectId; name: string } | null;
      if (!vehicle) { failure = "Choose an available vehicle type."; status = 400; throw new Error("INVALID_VEHICLE"); }
      type CatalogRow = { _id: mongoose.Types.ObjectId; name: string; durationMinutes: number; prices: Array<{ vehicleType: unknown; amount: number }> };
      const services = await Service.find({ _id: { $in: data.serviceIds }, active: true, deletedAt: null }).session(session).lean() as unknown as CatalogRow[];
      const addons = data.addonIds.length ? await Addon.find({ _id: { $in: data.addonIds }, active: true, deletedAt: null }).session(session).lean() as unknown as CatalogRow[] : [];
      if (services.length !== data.serviceIds.length || addons.length !== data.addonIds.length) { failure = "One or more selected items are no longer available."; status = 400; throw new Error("INVALID_ITEMS"); }

      const snapshots = [
        ...services.map((service) => ({ itemId: service._id, name: service.name, kind: "service" as const, durationMinutes: service.durationMinutes, price: service.prices.find((price) => String(price.vehicleType) === String(vehicle._id))?.amount })),
        ...addons.map((addon) => ({ itemId: addon._id, name: addon.name, kind: "addon" as const, durationMinutes: addon.durationMinutes, price: addon.prices.find((price) => String(price.vehicleType) === String(vehicle._id))?.amount })),
      ];
      if (snapshots.some((item) => item.price === undefined)) { failure = "Pricing is not set for this vehicle. Please contact the business."; status = 400; throw new Error("MISSING_PRICE"); }
      const items = snapshots.map((item) => ({ itemId: item.itemId, name: item.name, kind: item.kind, durationMinutes: item.durationMinutes, price: item.price! }));
      const totalPrice = items.reduce((sum, item) => sum + item.price, 0);
      const totalDuration = items.reduce((sum, item) => sum + item.durationMinutes, 0);

      const bookingDocs = await Booking.find({ date: { $gte: dateStart, $lt: dateEnd }, status: { $in: ["Pending", "Confirmed", "In Progress"] } }).select("date startTime endTime status pendingExpiresAt").session(session).lean();
      const blockDocs = await BlockedSlot.find({ date: { $gte: dateStart, $lt: dateEnd } }).select("date startTime endTime allDay").session(session).lean();
      const bookings: SlotBooking[] = bookingDocs.map((booking) => ({ dateKey: storedDateKey(booking.date), startTime: booking.startTime, endTime: booking.endTime, status: booking.status, pendingExpiresAt: booking.pendingExpiresAt }));
      const blocks: SlotBlock[] = blockDocs.map((block) => ({ dateKey: storedDateKey(block.date), startTime: block.startTime, endTime: block.endTime, allDay: block.allDay }));
      const available = generateAvailableSlots({ date: data.date, durationMinutes: totalDuration, settings, bookings, blockedSlots: blocks });
      const chosenSlot = available.find((slot) => slot.startTime === data.startTime);
      if (!chosenSlot) { failure = "That time is no longer available. Please choose another slot."; status = 409; throw new Error("SLOT_UNAVAILABLE"); }

      const sequence = await Counter.findOneAndUpdate({ key: "booking" }, { $inc: { sequence: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true, session });
      const reference = `CW-${String(sequence?.sequence ?? 1).padStart(4, "0")}`;
      const createdAt = new Date();
      const pendingExpiresAt = settings.autoReleasePending ? new Date(createdAt.getTime() + settings.pendingHoldMinutes * 60_000) : null;
      await Booking.create([{
        reference,
        customer: { name: data.name, phone: customerPhone },
        vehicleType: vehicle._id,
        vehicleTypeName: vehicle.name,
        vehicleNumber: data.vehicleNumber.toUpperCase(),
        items,
        totalPrice,
        totalDuration,
        date: dateStart,
        startTime: chosenSlot.startTime,
        endTime: chosenSlot.endTime,
        status: "Pending",
        paymentStatus: "Unpaid",
        notes: data.notes,
        source: "online",
        pendingExpiresAt,
      }], { session });
      await Customer.updateOne({ phone: customerPhone }, { $set: { name: data.name }, ...(data.vehicleNumber ? { $addToSet: { vehicles: data.vehicleNumber.toUpperCase() } } : {}) }, { upsert: true, session, runValidators: true, setDefaultsOnInsert: true });

      const business = await BusinessSettings.findOne({ key: "default" }).session(session).lean() as unknown as { whatsappNumber?: string } | null;
      const ownerDigits = business?.whatsappNumber ? whatsappDigits(business.whatsappNumber) : null;
      const summary = {
        reference, date: data.date, startTime: chosenSlot.startTime, endTime: chosenSlot.endTime, timezone: settings.timezone,
        startAt: new Date(zonedTimeToEpoch(data.date, chosenSlot.startTime, settings.timezone) ?? createdAt.getTime()).toISOString(),
        endAt: new Date(zonedTimeToEpoch(data.date, chosenSlot.endTime, settings.timezone) ?? createdAt.getTime()).toISOString(),
        vehicleType: vehicle.name, vehicleNumber: data.vehicleNumber.toUpperCase(), itemNames: items.map((item) => item.name), totalPrice, totalDuration,
      };
      const whatsappMessage = [
        `Car wash booking request ${reference}`,
        `Name: ${data.name}`,
        `Vehicle: ${vehicle.name}${data.vehicleNumber ? ` (${data.vehicleNumber.toUpperCase()})` : ""}`,
        `Services: ${items.map((item) => item.name).join(", ")}`,
        `Date: ${data.date} at ${chosenSlot.startTime} (${settings.timezone})`,
        `Duration: ${totalDuration} minutes`,
        `Total: ${formatLkr(totalPrice)}`,
      ].join("\n");
      responseData = { reference, summary, whatsappUrl: ownerDigits ? `https://wa.me/${ownerDigits}?text=${encodeURIComponent(whatsappMessage)}` : null };
    });
  } catch (error) {
    if (status === 500 && error instanceof Error && ["INVALID_VEHICLE", "INVALID_ITEMS", "MISSING_PRICE", "SLOT_UNAVAILABLE"].includes(error.message)) status = error.message === "SLOT_UNAVAILABLE" ? 409 : 400;
    if (status === 500) failure = "Booking could not be saved. Please try again in a moment.";
    if (status !== 500) failure = failure || "Check the booking and try again.";
    return NextResponse.json({ error: failure }, { status });
  } finally {
    await session.endSession();
  }

  return NextResponse.json(responseData, { status: 201, headers: { "Cache-Control": "no-store" } });
}
