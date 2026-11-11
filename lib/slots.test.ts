import assert from "node:assert/strict";
import test from "node:test";
import { generateAvailableSlots, type SlotSettings } from "@/lib/slots";

const settings: SlotSettings = {
  timezone: "Asia/Colombo",
  weeklyHours: [
    { day: 1, open: true, start: "08:00", end: "11:00" },
    { day: 2, open: false, start: "08:00", end: "17:00" },
    { day: 3, open: false, start: "08:00", end: "17:00" },
    { day: 4, open: false, start: "08:00", end: "17:00" },
    { day: 5, open: false, start: "08:00", end: "17:00" },
    { day: 6, open: false, start: "08:00", end: "17:00" },
    { day: 0, open: false, start: "08:00", end: "17:00" },
  ],
  slotIntervalMinutes: 30,
  bufferMinutes: 0,
  capacity: 1,
  minimumNoticeMinutes: 0,
  maximumAdvanceDays: 30,
  autoReleasePending: true,
};
const date = "2026-11-09"; // Monday in Asia/Colombo
const now = new Date("2026-11-08T00:00:00.000Z");

test("generates starts only when the full selected duration fits within opening hours", () => {
  const slots = generateAvailableSlots({ date, durationMinutes: 60, settings, now });
  assert.deepEqual(slots.map((slot) => slot.startTime), ["08:00", "08:30", "09:00", "09:30", "10:00"]);
  assert.equal(slots.at(-1)?.endTime, "11:00");
});

test("closed weekdays and all-day blocks return no slots", () => {
  assert.deepEqual(generateAvailableSlots({ date: "2026-11-10", durationMinutes: 30, settings, now }), []);
  assert.deepEqual(generateAvailableSlots({ date, durationMinutes: 30, settings, blockedSlots: [{ dateKey: date, allDay: true }], now }), []);
});

test("pending and confirmed bookings block conflicting slots while cancelled bookings do not", () => {
  const bookings = [
    { dateKey: date, startTime: "09:00", endTime: "10:00", status: "Pending" },
    { dateKey: date, startTime: "08:00", endTime: "08:30", status: "Cancelled" },
  ];
  const slots = generateAvailableSlots({ date, durationMinutes: 30, settings, bookings, now });
  assert.deepEqual(slots.map((slot) => slot.startTime), ["08:00", "08:30", "10:00", "10:30"]);
});

test("expired pending holds are released when automatic release is enabled", () => {
  const slots = generateAvailableSlots({ date, durationMinutes: 30, settings, now, bookings: [{ dateKey: date, startTime: "08:00", endTime: "09:00", status: "Pending", pendingExpiresAt: "2026-11-07T00:00:00.000Z" }] });
  assert.equal(slots[0]?.startTime, "08:00");
});

test("capacity allows parallel work up to the configured limit", () => {
  const slots = generateAvailableSlots({ date, durationMinutes: 60, settings: { ...settings, capacity: 2 }, now, bookings: [{ dateKey: date, startTime: "08:30", endTime: "09:30", status: "Confirmed" }] });
  assert.deepEqual(slots.map((slot) => slot.startTime), ["08:00", "08:30", "09:00", "09:30", "10:00"]);
});

test("buffer time is enforced once between sequential jobs", () => {
  const slots = generateAvailableSlots({ date, durationMinutes: 30, settings: { ...settings, slotIntervalMinutes: 15, bufferMinutes: 15 }, now, bookings: [{ dateKey: date, startTime: "09:00", endTime: "10:00", status: "Confirmed" }] });
  assert.deepEqual(slots.map((slot) => slot.startTime), ["08:00", "08:15", "10:15", "10:30"]);
});

test("partial blocks, minimum notice, and maximum advance are respected", () => {
  const sameDayNow = new Date("2026-11-09T00:00:00.000Z"); // 05:30 Colombo time
  const slots = generateAvailableSlots({ date, durationMinutes: 30, settings: { ...settings, minimumNoticeMinutes: 120, maximumAdvanceDays: 0 }, now: sameDayNow, blockedSlots: [{ dateKey: date, allDay: false, startTime: "09:00", endTime: "10:00" }] });
  assert.deepEqual(slots.map((slot) => slot.startTime), ["08:00", "08:30", "10:00", "10:30"]);
  assert.deepEqual(generateAvailableSlots({ date: "2026-11-10", durationMinutes: 30, settings: { ...settings, maximumAdvanceDays: 0 }, now: sameDayNow }), []);
});
