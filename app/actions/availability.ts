"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db";
import { AvailabilitySettings, BlockedSlot } from "@/models/Operations";

async function requireOwner() {
  const session = await auth();
  if (session?.user?.role !== "owner") throw new Error("Unauthorized");
  await connectToDatabase();
}

const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const hoursSchema = z.array(z.object({ day: z.number().int().min(0).max(6), open: z.boolean(), start: timeSchema, end: timeSchema })).length(7).refine((days) => new Set(days.map((day) => day.day)).size === 7, "Set each weekday exactly once").refine((days) => days.every((day) => !day.open || day.start < day.end), "Opening time must be earlier than closing time");

export async function saveAvailability(formData: FormData): Promise<void> {
  await requireOwner();
  const rawWeek = formData.get("weeklyHours");
  let weeklyHours: unknown;
  try { weeklyHours = JSON.parse(typeof rawWeek === "string" ? rawWeek : ""); }
  catch { throw new Error("Weekly hours could not be read"); }
  const values = z.object({
    timezone: z.string().trim().min(1).max(80),
    slotIntervalMinutes: z.coerce.number().int().min(5).max(240),
    bufferMinutes: z.coerce.number().int().min(0).max(240),
    capacity: z.coerce.number().int().min(1).max(50),
    minimumNoticeMinutes: z.coerce.number().int().min(0).max(43_200),
    maximumAdvanceDays: z.coerce.number().int().min(1).max(365),
    pendingHoldMinutes: z.coerce.number().int().min(1).max(10_080),
    autoReleasePending: z.enum(["true", "false"]).transform((value) => value === "true"),
  }).parse({
    timezone: formData.get("timezone"), slotIntervalMinutes: formData.get("slotIntervalMinutes"), bufferMinutes: formData.get("bufferMinutes"), capacity: formData.get("capacity"), minimumNoticeMinutes: formData.get("minimumNoticeMinutes"), maximumAdvanceDays: formData.get("maximumAdvanceDays"), pendingHoldMinutes: formData.get("pendingHoldMinutes"), autoReleasePending: formData.get("autoReleasePending"),
  });
  try { new Intl.DateTimeFormat("en", { timeZone: values.timezone }); }
  catch { throw new Error("Enter a valid timezone, such as Asia/Colombo"); }
  const schedule = hoursSchema.parse(weeklyHours);
  await AvailabilitySettings.findOneAndUpdate({ key: "default" }, { ...values, weeklyHours: schedule }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
  revalidatePath("/admin/availability");
}

export async function addBlockedSlot(formData: FormData): Promise<void> {
  await requireOwner();
  const allDay = formData.get("allDay") === "true";
  const values = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), allDay: z.boolean(), startTime: timeSchema.optional(), endTime: timeSchema.optional(), reason: z.string().trim().max(120) }).parse({
    date: formData.get("date"), allDay, startTime: formData.get("startTime") || undefined, endTime: formData.get("endTime") || undefined, reason: formData.get("reason") || "",
  });
  const parsedDate = new Date(`${values.date}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== values.date) throw new Error("Choose a valid date");
  if (!values.allDay && (!values.startTime || !values.endTime || values.startTime >= values.endTime)) throw new Error("Choose a valid start and end time for a time block");
  const connection = await connectToDatabase();
  const session = await connection.startSession();
  try {
    await session.withTransaction(async () => {
      await AvailabilitySettings.findOneAndUpdate({ key: "default" }, { $inc: { reservationVersion: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true, session });
      await BlockedSlot.create([{ date: parsedDate, allDay: values.allDay, startTime: values.allDay ? "" : values.startTime, endTime: values.allDay ? "" : values.endTime, reason: values.reason }], { session });
    });
  } finally { await session.endSession(); }
  revalidatePath("/admin/availability");
}

export async function deleteBlockedSlot(formData: FormData): Promise<void> {
  await requireOwner();
  const id = z.string().min(1).parse(formData.get("id"));
  const connection = await connectToDatabase();
  const session = await connection.startSession();
  try {
    await session.withTransaction(async () => {
      await AvailabilitySettings.findOneAndUpdate({ key: "default" }, { $inc: { reservationVersion: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true, session });
      await BlockedSlot.findByIdAndDelete(id).session(session);
    });
  } finally { await session.endSession(); }
  revalidatePath("/admin/availability");
}
