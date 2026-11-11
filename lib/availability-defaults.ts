import type { SlotSettings } from "@/lib/slots";

export const defaultAvailability: SlotSettings & { key: string; pendingHoldMinutes: number } = {
  key: "default",
  timezone: "Asia/Colombo",
  weeklyHours: [1, 2, 3, 4, 5, 6].map((day) => ({ day, open: true, start: "08:00", end: "17:00" })).concat([{ day: 0, open: false, start: "08:00", end: "17:00" }]),
  slotIntervalMinutes: 30,
  bufferMinutes: 0,
  capacity: 1,
  minimumNoticeMinutes: 120,
  maximumAdvanceDays: 30,
  pendingHoldMinutes: 120,
  autoReleasePending: true,
};
