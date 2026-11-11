"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { z } from "zod";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db";
import { findAvailableSlot, lockAvailability, nextBookingReference } from "@/lib/admin-bookings";
import { normalizePhone } from "@/lib/public-safety";
import { Addon, Service, VehicleType } from "@/models/catalog";
import { Booking } from "@/models/Booking";
import { AuditLog, Customer, Payment } from "@/models/Operations";

async function owner() {
  const session = await auth();
  if (session?.user?.role !== "owner") throw new Error("Unauthorized");
  const connection = await connectToDatabase();
  return { session, connection };
}

async function audit(session: mongoose.ClientSession, actorId: string | undefined, action: string, bookingId: string, details: Record<string, unknown> = {}) {
  await AuditLog.create([{ actor: actorId, action, entity: "Booking", entityId: bookingId, details }], { session });
}

function refreshBookingPages() {
  revalidatePath("/admin");
  revalidatePath("/admin/bookings");
  revalidatePath("/");
}

export async function updateBookingStatus(formData: FormData): Promise<void> {
  const { session, connection } = await owner();
  const values = z.object({ id: z.string().min(1), status: z.enum(["Pending", "Confirmed", "In Progress", "Completed", "Cancelled", "No-show"]) }).parse({ id: formData.get("id"), status: formData.get("status") });
  const mongoSession = await connection.startSession();
  try {
    await mongoSession.withTransaction(async () => {
      const booking = await Booking.findById(values.id).session(mongoSession);
      if (!booking) throw new Error("Booking not found");
      const previousStatus = booking.status;
      const transitions: Record<string, string[]> = { Pending: ["Confirmed", "Cancelled"], Confirmed: ["In Progress", "Completed", "Cancelled", "No-show"], "In Progress": ["Completed", "Cancelled"] };
      if (!transitions[previousStatus]?.includes(values.status)) throw new Error("This status change is not allowed");
      if (values.status === "Confirmed") {
        const settings = await lockAvailability(mongoSession);
        const date = booking.date.toISOString().slice(0, 10);
        const slot = await findAvailableSlot({ session: mongoSession, date, durationMinutes: booking.totalDuration, startTime: booking.startTime, settings, excludeBookingId: booking._id });
        if (!slot) throw new Error("This time is no longer available. Reschedule the booking before confirming it.");
      } else if (["Cancelled", "No-show"].includes(values.status)) await lockAvailability(mongoSession);
      booking.status = values.status;
      booking.pendingExpiresAt = null;
      await booking.save({ session: mongoSession });
      await audit(mongoSession, session.user?.id, "status_changed", booking.id, { from: previousStatus, to: values.status });
    });
  } finally { await mongoSession.endSession(); }
  refreshBookingPages();
}

export async function saveBookingNotes(formData: FormData): Promise<void> {
  const { session } = await owner();
  const values = z.object({ id: z.string().min(1), notes: z.string().trim().max(1000) }).parse({ id: formData.get("id"), notes: formData.get("notes") });
  const booking = await Booking.findByIdAndUpdate(values.id, { notes: values.notes }, { new: true, runValidators: true });
  if (!booking) throw new Error("Booking not found");
  await AuditLog.create({ actor: session.user?.id, action: "notes_updated", entity: "Booking", entityId: booking.id });
  refreshBookingPages();
}

export async function recordBookingPayment(formData: FormData): Promise<void> {
  const { session, connection } = await owner();
  const values = z.object({ id: z.string().min(1), amount: z.coerce.number().positive().max(10_000_000), method: z.enum(["cash", "bank", "card"]), note: z.string().trim().max(300) }).parse({ id: formData.get("id"), amount: formData.get("amount"), method: formData.get("method"), note: formData.get("note") || "" });
  const mongoSession = await connection.startSession();
  try {
    await mongoSession.withTransaction(async () => {
      const booking = await Booking.findById(values.id).session(mongoSession);
      if (!booking) throw new Error("Booking not found");
      const amount = Math.round(values.amount * 100);
      await Payment.create([{ booking: booking._id, amount, method: values.method, note: values.note }], { session: mongoSession });
      const paid = await Payment.aggregate([{ $match: { booking: booking._id } }, { $group: { _id: null, total: { $sum: "$amount" } } }]).session(mongoSession);
      booking.paymentStatus = (paid[0]?.total ?? 0) >= booking.totalPrice ? "Paid" : "Partial";
      await booking.save({ session: mongoSession });
      await audit(mongoSession, session.user?.id, "payment_recorded", booking.id, { amount, method: values.method });
    });
  } finally { await mongoSession.endSession(); }
  refreshBookingPages();
}

export async function rescheduleBooking(formData: FormData): Promise<void> {
  const { session, connection } = await owner();
  const values = z.object({ id: z.string().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/) }).parse({ id: formData.get("id"), date: formData.get("date"), startTime: formData.get("startTime") });
  const mongoSession = await connection.startSession();
  try {
    await mongoSession.withTransaction(async () => {
      const settings = await lockAvailability(mongoSession);
      const booking = await Booking.findById(values.id).session(mongoSession);
      if (!booking || ["Cancelled", "Completed", "No-show"].includes(booking.status)) throw new Error("This booking cannot be rescheduled");
      const slot = await findAvailableSlot({ session: mongoSession, date: values.date, durationMinutes: booking.totalDuration, startTime: values.startTime, settings, excludeBookingId: booking._id });
      if (!slot) throw new Error("That time is unavailable. Select another date or time.");
      const previous = { date: booking.date.toISOString().slice(0, 10), startTime: booking.startTime };
      booking.date = new Date(`${values.date}T00:00:00.000Z`);
      booking.startTime = slot.startTime;
      booking.endTime = slot.endTime;
      if (booking.status === "Pending") booking.pendingExpiresAt = settings.autoReleasePending ? new Date(Date.now() + settings.pendingHoldMinutes * 60_000) : null;
      await booking.save({ session: mongoSession });
      await audit(mongoSession, session.user?.id, "booking_rescheduled", booking.id, { from: previous, to: { date: values.date, startTime: slot.startTime } });
    });
  } finally { await mongoSession.endSession(); }
  refreshBookingPages();
}

export async function reviewCustomerRequest(formData: FormData): Promise<void> {
  const { session, connection } = await owner();
  const values = z.object({ id: z.string().min(1), decision: z.enum(["approve", "reject"]) }).parse({ id: formData.get("id"), decision: formData.get("decision") });
  const mongoSession = await connection.startSession();
  try {
    await mongoSession.withTransaction(async () => {
      const bookingBefore = await Booking.findById(values.id).session(mongoSession);
      if (!bookingBefore?.customerRequest || bookingBefore.customerRequest.status !== "Pending") throw new Error("No pending customer request exists");
      if (values.decision === "reject") {
        bookingBefore.customerRequest.status = "Rejected";
        await bookingBefore.save({ session: mongoSession });
        await audit(mongoSession, session.user?.id, "customer_request_rejected", bookingBefore.id, { requestType: bookingBefore.customerRequest.type });
        return;
      }
      const requestType = bookingBefore.customerRequest.type;
      if (requestType === "cancel") {
        await lockAvailability(mongoSession);
        bookingBefore.status = "Cancelled";
        bookingBefore.pendingExpiresAt = null;
        bookingBefore.customerRequest.status = "Approved";
        await bookingBefore.save({ session: mongoSession });
        await audit(mongoSession, session.user?.id, "customer_cancel_approved", bookingBefore.id);
        return;
      }
      const requestedDate = bookingBefore.customerRequest.requestedDate?.toISOString().slice(0, 10);
      const requestedStartTime = bookingBefore.customerRequest.requestedStartTime;
      if (!requestedDate || !requestedStartTime) throw new Error("The requested reschedule details are incomplete");
      const settings = await lockAvailability(mongoSession);
      const slot = await findAvailableSlot({ session: mongoSession, date: requestedDate, durationMinutes: bookingBefore.totalDuration, startTime: requestedStartTime, settings, excludeBookingId: bookingBefore._id });
      if (!slot) throw new Error("The requested time is unavailable. Reject the request or contact the customer.");
      bookingBefore.date = new Date(`${requestedDate}T00:00:00.000Z`);
      bookingBefore.startTime = slot.startTime;
      bookingBefore.endTime = slot.endTime;
      bookingBefore.customerRequest.status = "Approved";
      if (bookingBefore.status === "Pending") bookingBefore.pendingExpiresAt = settings.autoReleasePending ? new Date(Date.now() + settings.pendingHoldMinutes * 60_000) : null;
      await bookingBefore.save({ session: mongoSession });
      await audit(mongoSession, session.user?.id, "customer_reschedule_approved", bookingBefore.id, { to: { date: requestedDate, startTime: slot.startTime } });
    });
  } finally { await mongoSession.endSession(); }
  refreshBookingPages();
}

export async function createManualBooking(formData: FormData): Promise<void> {
  const { session, connection } = await owner();
  const values = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/), vehicleTypeId: z.string().regex(/^[a-f\d]{24}$/i), serviceIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1).max(10), addonIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(10), name: z.string().trim().min(2).max(80), phone: z.string().trim().min(8).max(24), vehicleNumber: z.string().trim().max(20), notes: z.string().trim().max(500) }).parse({
    date: formData.get("date"), startTime: formData.get("startTime"), vehicleTypeId: formData.get("vehicleTypeId"), serviceIds: formData.getAll("serviceIds"), addonIds: formData.getAll("addonIds"), name: formData.get("name"), phone: formData.get("phone"), vehicleNumber: formData.get("vehicleNumber") || "", notes: formData.get("notes") || "",
  });
  const phone = normalizePhone(values.phone);
  if (!phone) throw new Error("Enter a valid phone number");
  if (new Set(values.serviceIds).size !== values.serviceIds.length || new Set(values.addonIds).size !== values.addonIds.length) throw new Error("Duplicate service selection");
  const connectionSession = await connection.startSession();
  try {
    await connectionSession.withTransaction(async () => {
      const settings = await lockAvailability(connectionSession);
      const vehicle = await VehicleType.findOne({ _id: values.vehicleTypeId, active: true }).session(connectionSession).lean() as unknown as { _id: mongoose.Types.ObjectId; name: string } | null;
      if (!vehicle) throw new Error("Choose an active vehicle type");
      type CatalogRow = { _id: mongoose.Types.ObjectId; name: string; durationMinutes: number; prices: Array<{ vehicleType: unknown; amount: number }> };
      const services = await Service.find({ _id: { $in: values.serviceIds }, active: true, deletedAt: null }).session(connectionSession).lean() as unknown as CatalogRow[];
      const addons = values.addonIds.length ? await Addon.find({ _id: { $in: values.addonIds }, active: true, deletedAt: null }).session(connectionSession).lean() as unknown as CatalogRow[] : [];
      if (services.length !== values.serviceIds.length || addons.length !== values.addonIds.length) throw new Error("A selected service is no longer active");
      const rows = [...services.map((item) => ({ ...item, kind: "service" as const })), ...addons.map((item) => ({ ...item, kind: "addon" as const }))];
      const items = rows.map((item) => {
        const price = item.prices.find((entry) => String(entry.vehicleType) === String(vehicle._id))?.amount;
        if (price === undefined) throw new Error(`Price is missing for ${item.name} and this vehicle type`);
        return { itemId: item._id, name: item.name, kind: item.kind, price, durationMinutes: item.durationMinutes };
      });
      const totalDuration = items.reduce((sum, item) => sum + item.durationMinutes, 0);
      const slot = await findAvailableSlot({ session: connectionSession, date: values.date, durationMinutes: totalDuration, startTime: values.startTime, settings });
      if (!slot) throw new Error("That time is unavailable. Choose another time.");
      const reference = await nextBookingReference(connectionSession);
      const created = await Booking.create([{
        reference, customer: { name: values.name, phone }, vehicleType: vehicle._id, vehicleTypeName: vehicle.name,
        vehicleNumber: values.vehicleNumber.toUpperCase(), items, totalPrice: items.reduce((sum, item) => sum + item.price, 0), totalDuration,
        date: new Date(`${values.date}T00:00:00.000Z`), startTime: slot.startTime, endTime: slot.endTime, status: "Confirmed", paymentStatus: "Unpaid", notes: values.notes, source: "manual", pendingExpiresAt: null,
      }], { session: connectionSession });
      await Customer.updateOne({ phone }, { $set: { name: values.name }, ...(values.vehicleNumber ? { $addToSet: { vehicles: values.vehicleNumber.toUpperCase() } } : {}) }, { upsert: true, session: connectionSession, runValidators: true, setDefaultsOnInsert: true });
      await audit(connectionSession, session.user?.id, "manual_booking_created", String(created[0]!._id), { reference });
    });
  } finally { await connectionSession.endSession(); }
  revalidatePath("/admin");
  revalidatePath("/admin/bookings");
}
