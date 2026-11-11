import type { ClientSession, Types } from "mongoose";
import { defaultAvailability } from "@/lib/availability-defaults";
import { generateAvailableSlots, storedDateKey, type SlotBooking, type SlotBlock } from "@/lib/slots";
import { Booking } from "@/models/Booking";
import { AvailabilitySettings, BlockedSlot, Counter } from "@/models/Operations";

export async function lockAvailability(session: ClientSession) {
  const doc = await AvailabilitySettings.findOneAndUpdate({ key: "default" }, { $inc: { reservationVersion: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true, session }).lean();
  const saved = doc ? JSON.parse(JSON.stringify(doc)) : {};
  return { ...defaultAvailability, ...saved, weeklyHours: saved.weeklyHours?.length ? saved.weeklyHours : defaultAvailability.weeklyHours };
}

export async function findAvailableSlot(input: { session: ClientSession; date: string; durationMinutes: number; startTime: string; settings: Awaited<ReturnType<typeof lockAvailability>>; excludeBookingId?: Types.ObjectId | string }) {
  const dateStart = new Date(`${input.date}T00:00:00.000Z`);
  if (Number.isNaN(dateStart.getTime()) || dateStart.toISOString().slice(0, 10) !== input.date) return null;
  const dateEnd = new Date(dateStart.getTime() + 86_400_000);
  const query: Record<string, unknown> = { date: { $gte: dateStart, $lt: dateEnd }, status: { $in: ["Pending", "Confirmed", "In Progress"] } };
  if (input.excludeBookingId) query._id = { $ne: input.excludeBookingId };
  const bookings = await Booking.find(query).select("date startTime endTime status pendingExpiresAt").session(input.session).lean();
  const blocks = await BlockedSlot.find({ date: { $gte: dateStart, $lt: dateEnd } }).select("date startTime endTime allDay").session(input.session).lean();
  const slotBookings: SlotBooking[] = bookings.map((booking) => ({ dateKey: storedDateKey(booking.date), startTime: booking.startTime, endTime: booking.endTime, status: booking.status, pendingExpiresAt: booking.pendingExpiresAt }));
  const slotBlocks: SlotBlock[] = blocks.map((block) => ({ dateKey: storedDateKey(block.date), startTime: block.startTime, endTime: block.endTime, allDay: block.allDay }));
  return generateAvailableSlots({ date: input.date, durationMinutes: input.durationMinutes, settings: input.settings, bookings: slotBookings, blockedSlots: slotBlocks }).find((slot) => slot.startTime === input.startTime) ?? null;
}

export async function nextBookingReference(session: ClientSession) {
  const counter = await Counter.findOneAndUpdate({ key: "booking" }, { $inc: { sequence: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true, session });
  return `CW-${String(counter?.sequence ?? 1).padStart(4, "0")}`;
}
