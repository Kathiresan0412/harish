export type WeeklyHours = { day: number; open: boolean; start: string; end: string };
export type SlotSettings = {
  timezone: string;
  weeklyHours: WeeklyHours[];
  slotIntervalMinutes: number;
  bufferMinutes: number;
  capacity: number;
  minimumNoticeMinutes: number;
  maximumAdvanceDays: number;
  autoReleasePending: boolean;
};
export type SlotBooking = { dateKey: string; startTime: string; endTime: string; status: string; pendingExpiresAt?: Date | string | null };
export type SlotBlock = { dateKey: string; allDay: boolean; startTime?: string; endTime?: string };
export type AvailableSlot = { startTime: string; endTime: string; durationMinutes: number };

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function parseDateKey(value: string) {
  if (!DATE_KEY.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function minutes(value: string) {
  if (!TIME.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  return hour! * 60 + minute!;
}

function toTime(value: number) {
  return `${String(Math.floor(value / 60) % 24).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function localParts(date: Date, timezone: string) {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => values.find((value) => value.type === type)?.value ?? "00";
  return { dateKey: `${part("year")}-${part("month")}-${part("day")}`, minute: Number(part("hour")) * 60 + Number(part("minute")) };
}

// Converts a wall-clock appointment time into an instant for minimum-notice checks.
function zonedMinuteToEpoch(dateKey: string, minute: number, timezone: string) {
  const date = parseDateKey(dateKey);
  if (!date) return null;
  const target = date.getTime() + minute * 60_000;
  let candidate = target;
  for (let attempt = 0; attempt < 3; attempt++) {
    const actual = localParts(new Date(candidate), timezone);
    const actualDate = parseDateKey(actual.dateKey);
    if (!actualDate) return null;
    const actualWallTime = actualDate.getTime() + actual.minute * 60_000;
    candidate += target - actualWallTime;
  }
  const resolved = localParts(new Date(candidate), timezone);
  return resolved.dateKey === dateKey && resolved.minute === minute ? candidate : null;
}

export function zonedTimeToEpoch(dateKey: string, time: string, timezone: string) {
  const minute = minutes(time);
  return minute === null ? null : zonedMinuteToEpoch(dateKey, minute, timezone);
}

function pendingHasExpired(booking: SlotBooking, settings: SlotSettings, now: Date) {
  if (booking.status !== "Pending" || !settings.autoReleasePending || !booking.pendingExpiresAt) return false;
  const expiresAt = new Date(booking.pendingExpiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= now.getTime();
}

function exceedsCapacity(start: number, end: number, bookings: SlotBooking[], buffer: number, capacity: number) {
  const events: Array<{ at: number; delta: number }> = [];
  for (const booking of bookings) {
    if (!["Pending", "Confirmed", "In Progress"].includes(booking.status)) continue;
    const bookingStart = minutes(booking.startTime);
    const bookingEnd = minutes(booking.endTime);
    if (bookingStart === null || bookingEnd === null || bookingEnd <= bookingStart) continue;
    // Enforce the buffer once between sequential jobs; overlapping jobs still
    // consume capacity in parallel when the owner has configured it above one.
    const overlaps = start < bookingEnd && end > bookingStart;
    const gapBefore = end <= bookingStart && end + buffer > bookingStart;
    const gapAfter = start >= bookingEnd && start < bookingEnd + buffer;
    if (gapBefore || gapAfter) return true;
    if (!overlaps) continue;
    const occupiedStart = Math.max(start, bookingStart);
    const occupiedEnd = Math.min(end, bookingEnd);
    if (occupiedStart >= occupiedEnd) continue;
    events.push({ at: occupiedStart, delta: 1 }, { at: occupiedEnd, delta: -1 });
  }
  events.sort((a, b) => a.at - b.at || a.delta - b.delta);
  let concurrent = 0;
  for (const event of events) {
    concurrent += event.delta;
    if (concurrent >= capacity) return true;
  }
  return false;
}

/** Generate only bookable start times. Dates use YYYY-MM-DD in the business timezone. */
export function generateAvailableSlots(input: {
  date: string;
  durationMinutes: number;
  settings: SlotSettings;
  bookings?: SlotBooking[];
  blockedSlots?: SlotBlock[];
  now?: Date;
}): AvailableSlot[] {
  const { date, durationMinutes, settings } = input;
  const parsedDate = parseDateKey(date);
  const interval = settings.slotIntervalMinutes;
  const now = input.now ?? new Date();
  if (!parsedDate || !Number.isInteger(durationMinutes) || durationMinutes <= 0 || !Number.isInteger(interval) || interval <= 0 || settings.capacity < 1) return [];

  const weekday = parsedDate.getUTCDay();
  const hours = settings.weeklyHours.find((entry) => entry.day === weekday);
  const opening = hours?.open ? minutes(hours.start) : null;
  const closing = hours?.open ? minutes(hours.end) : null;
  if (opening === null || closing === null || opening >= closing) return [];

  let todayKey: string;
  try { todayKey = localParts(now, settings.timezone).dateKey; }
  catch { return []; }
  const today = parseDateKey(todayKey);
  if (!today) return [];
  const dayDistance = Math.floor((parsedDate.getTime() - today.getTime()) / 86_400_000);
  if (dayDistance < 0 || dayDistance > settings.maximumAdvanceDays) return [];

  const dateBlocks = (input.blockedSlots ?? []).filter((block) => block.dateKey === date);
  if (dateBlocks.some((block) => block.allDay)) return [];
  const timeBlocks = dateBlocks.flatMap((block) => {
    const start = block.startTime ? minutes(block.startTime) : null;
    const end = block.endTime ? minutes(block.endTime) : null;
    return start !== null && end !== null && start < end ? [{ start, end }] : [];
  });
  const bookings = (input.bookings ?? []).filter((booking) => booking.dateKey === date && !pendingHasExpired(booking, settings, now));
  const result: AvailableSlot[] = [];
  const minimumNoticeMs = Math.max(0, settings.minimumNoticeMinutes) * 60_000;
  const buffer = Math.max(0, settings.bufferMinutes);

  for (let start = opening; start + durationMinutes <= closing; start += interval) {
    const end = start + durationMinutes;
    const startEpoch = zonedMinuteToEpoch(date, start, settings.timezone);
    if (startEpoch === null || startEpoch - now.getTime() < minimumNoticeMs) continue;
    if (timeBlocks.some((block) => start < block.end && end > block.start)) continue;
    if (exceedsCapacity(start, end, bookings, buffer, settings.capacity)) continue;
    result.push({ startTime: toTime(start), endTime: toTime(end), durationMinutes });
  }
  return result;
}

export function storedDateKey(date: Date | string) {
  const parsed = date instanceof Date ? date : new Date(date);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

export function localDateKey(now: Date, timezone: string) {
  return localParts(now, timezone).dateKey;
}
