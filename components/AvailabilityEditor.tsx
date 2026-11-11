"use client";

import { useEffect, useMemo, useState } from "react";
import { addBlockedSlot, deleteBlockedSlot, saveAvailability } from "@/app/actions/availability";
import { CalendarDays, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";

type DayHours = { day: number; open: boolean; start: string; end: string };
type Block = { id: string; dateKey: string; startTime: string; endTime: string; allDay: boolean; reason: string };
type Settings = { timezone: string; weeklyHours: DayHours[]; slotIntervalMinutes: number; bufferMinutes: number; capacity: number; minimumNoticeMinutes: number; maximumAdvanceDays: number; pendingHoldMinutes: number; autoReleasePending: boolean };
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function SlotPreview({ settings, today }: { settings: Settings; today: string }) {
  const [date, setDate] = useState(today);
  const [duration, setDuration] = useState(60);
  const [slots, setSlots] = useState<Array<{ startTime: string; endTime: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timezone, setTimezone] = useState(settings.timezone);
  const settingsKey = `${settings.timezone}:${settings.slotIntervalMinutes}:${settings.bufferMinutes}:${settings.capacity}:${settings.minimumNoticeMinutes}:${settings.maximumAdvanceDays}:${JSON.stringify(settings.weeklyHours)}`;

  useEffect(() => {
    if (!date || duration < 1) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/availability?date=${encodeURIComponent(date)}&duration=${duration}`, { signal: controller.signal, cache: "no-store" });
        const result = await response.json() as { slots?: Array<{ startTime: string; endTime: string }>; error?: string; timezone?: string };
        if (!response.ok) throw new Error(result.error ?? "Could not load slots.");
        setSlots(result.slots ?? []);
        if (result.timezone) setTimezone(result.timezone);
      } catch (fetchError) {
        if (!controller.signal.aborted) setError(fetchError instanceof Error ? fetchError.message : "Could not load slots.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [date, duration, settingsKey]);

  const maximumDate = useMemo(() => {
    const dateValue = new Date(`${today}T12:00:00.000Z`);
    dateValue.setUTCDate(dateValue.getUTCDate() + settings.maximumAdvanceDays);
    return dateValue.toISOString().slice(0, 10);
  }, [settings.maximumAdvanceDays, today]);

  return <section className="availability-preview"><div className="availability-preview-heading"><div className="catalog-icon"><CalendarDays size={18} /></div><div><span className="eyebrow">LIVE PREVIEW</span><h2>Check available slots</h2></div></div><div className="preview-controls"><label>Date<input type="date" min={today} max={maximumDate} value={date} onChange={(event) => setDate(event.target.value)} /></label><label>Job duration (minutes)<input type="number" min="1" max="600" step="5" value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label></div><p className="availability-timezone">Times shown in {timezone}. Saved hours, blocks, and bookings are included.</p>{loading ? <div className="availability-loading"><LoaderCircle className="spin" size={17} /> Finding available times…</div> : error ? <p className="availability-empty" role="alert">{error}</p> : slots.length ? <div className="available-slot-chips">{slots.map((slot) => <span className="available-slot-chip" key={slot.startTime}>{slot.startTime}<small>to {slot.endTime}</small></span>)}</div> : <p className="availability-empty">No available slots for this date and duration. Try another date or a shorter job.</p>}</section>;
}

export function AvailabilityEditor({ initial, blocks, today }: { initial: Settings; blocks: Block[]; today: string }) {
  const [weeklyHours, setWeeklyHours] = useState(() => [...initial.weeklyHours].sort((a, b) => a.day - b.day));
  function updateDay(day: number, changes: Partial<DayHours>) {
    setWeeklyHours((current) => current.map((entry) => entry.day === day ? { ...entry, ...changes } : entry));
  }

  return <div className="availability-layout"><div className="availability-main">
    <form action={saveAvailability} className="availability-form">
      <section className="availability-card"><div className="availability-card-heading"><div><span className="eyebrow">YOUR WEEK</span><h2>Working hours</h2><p>Set the hours customers can request each day.</p></div></div><input type="hidden" name="weeklyHours" value={JSON.stringify(weeklyHours)} readOnly />
        <div className="weekly-hours-grid">{weeklyHours.map((entry) => <div className={`weekly-hours-row ${entry.open ? "is-open" : "is-closed"}`} key={entry.day}><label className="day-toggle"><input type="checkbox" checked={entry.open} onChange={(event) => updateDay(entry.day, { open: event.target.checked })} /><span className="day-toggle-ui" /><strong>{dayNames[entry.day]}</strong></label><div className="day-times"><input aria-label={`${dayNames[entry.day]} opening time`} type="time" value={entry.start} disabled={!entry.open} onChange={(event) => updateDay(entry.day, { start: event.target.value })} /><span>to</span><input aria-label={`${dayNames[entry.day]} closing time`} type="time" value={entry.end} disabled={!entry.open} onChange={(event) => updateDay(entry.day, { end: event.target.value })} /></div><span className="day-status">{entry.open ? "Open" : "Closed"}</span></div>)}</div>
      </section>
      <section className="availability-card"><div className="availability-card-heading"><div><span className="eyebrow">SCHEDULING RULES</span><h2>Appointment spacing</h2><p>These rules apply to all booking requests.</p></div></div><div className="availability-settings-grid"><label>Timezone<input name="timezone" defaultValue={initial.timezone} required placeholder="Asia/Colombo" /><small>Use an IANA timezone, such as Asia/Colombo.</small></label><label>Slot interval<select name="slotIntervalMinutes" defaultValue={initial.slotIntervalMinutes}><option value="15">Every 15 minutes</option><option value="30">Every 30 minutes</option><option value="45">Every 45 minutes</option><option value="60">Every 60 minutes</option></select></label><label>Buffer between jobs (min)<input name="bufferMinutes" type="number" min="0" max="240" step="5" defaultValue={initial.bufferMinutes} /></label><label>Concurrent vehicle capacity<input name="capacity" type="number" min="1" max="50" defaultValue={initial.capacity} /><small>How many vehicles can be washed at once.</small></label><label>Minimum notice (minutes)<input name="minimumNoticeMinutes" type="number" min="0" max="43200" step="15" defaultValue={initial.minimumNoticeMinutes} /></label><label>Maximum advance (days)<input name="maximumAdvanceDays" type="number" min="1" max="365" defaultValue={initial.maximumAdvanceDays} /></label><label>Pending booking hold (minutes)<input name="pendingHoldMinutes" type="number" min="1" max="10080" step="15" defaultValue={initial.pendingHoldMinutes} /><small>Used when pending requests are automatically released.</small></label><label>Release expired pending holds<select name="autoReleasePending" defaultValue={initial.autoReleasePending ? "true" : "false"}><option value="true">Yes, release after the hold</option><option value="false">No, keep pending slots reserved</option></select></label></div><div className="availability-form-footer"><p>Pending bookings without an expiry time remain reserved until updated.</p><button className="button" type="submit"><Save size={15} /> Save availability</button></div></section>
    </form>
    <section className="availability-card blocked-card"><div className="availability-card-heading"><div><span className="eyebrow">TIME OFF</span><h2>Blocked dates & times</h2><p>Close for a holiday or block a personal break.</p></div></div><form action={addBlockedSlot} className="blocked-slot-form"><label>Date<input type="date" name="date" min={today} required /></label><label>Block<select name="allDay"><option value="true">All day</option><option value="false">Time range</option></select></label><label>Start time<input type="time" name="startTime" /></label><label>End time<input type="time" name="endTime" /></label><label className="blocked-reason">Reason (optional)<input type="text" name="reason" maxLength={120} placeholder="Holiday, lunch break…" /></label><button type="submit" className="button"><Plus size={15} /> Add block</button></form>
      {blocks.length ? <div className="blocked-slot-list">{blocks.map((block) => <article className="blocked-slot-row" key={block.id}><span className="blocked-date">{block.dateKey}</span><span>{block.allDay ? "All day" : `${block.startTime}–${block.endTime}`}</span><span className="blocked-reason-text">{block.reason || "Unavailable"}</span><form action={deleteBlockedSlot}><input type="hidden" name="id" value={block.id} /><button type="submit" className="remove-block" aria-label={`Remove blocked time on ${block.dateKey}`}><Trash2 size={15} /></button></form></article>)}</div> : <p className="blocked-empty">No dates or times are blocked yet.</p>}
    </section>
  </div><SlotPreview settings={initial} today={today} /></div>;
}
