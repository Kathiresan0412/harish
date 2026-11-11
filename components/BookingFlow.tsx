"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Droplets, LoaderCircle } from "lucide-react";
import type { PublicCatalogItem, PublicVehicle } from "@/lib/public-catalog";
import { formatLkr } from "@/lib/money";

type BookingSettings = { timezone: string; maximumAdvanceDays: number };
type Slot = { startTime: string; endTime: string };

export function BookingFlow({ services, addons, vehicles, settings, today, businessName, whatsappReady }: { services: PublicCatalogItem[]; addons: PublicCatalogItem[]; vehicles: PublicVehicle[]; settings: BookingSettings; today: string; businessName: string; whatsappReady: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [vehicleId, setVehicleId] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [date, setDate] = useState(today);
  const [calendarMonth, setCalendarMonth] = useState(today.slice(0, 7));
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [customer, setCustomer] = useState({ name: "", phone: "", vehicleNumber: "", notes: "", website: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const vehicle = vehicles.find((item) => item.id === vehicleId);
  const selectedServices = services.filter((item) => serviceIds.includes(item.id));
  const selectedAddons = addons.filter((item) => addonIds.includes(item.id));
  const totalPrice = useMemo(() => [...selectedServices, ...selectedAddons].reduce((total, item) => total + (item.prices.find((price) => price.vehicleType === vehicleId)?.amount ?? 0), 0), [selectedServices, selectedAddons, vehicleId]);
  const totalDuration = useMemo(() => [...selectedServices, ...selectedAddons].reduce((total, item) => total + item.durationMinutes, 0), [selectedServices, selectedAddons]);
  const maxDate = useMemo(() => { const value = new Date(`${today}T12:00:00.000Z`); value.setUTCDate(value.getUTCDate() + settings.maximumAdvanceDays); return value.toISOString().slice(0, 10); }, [settings.maximumAdvanceDays, today]);
  const monthStart = `${calendarMonth}-01`;
  const monthDate = new Date(`${monthStart}T00:00:00.000Z`);
  const monthDays = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)).getUTCDate();
  const firstWeekday = monthDate.getUTCDay();
  const monthLabel = new Intl.DateTimeFormat("en-LK", { month: "long", year: "numeric", timeZone: "UTC" }).format(monthDate);
  const previousMonth = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  const nextMonth = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 1)).toISOString().slice(0, 7);

  useEffect(() => {
    if (step !== 2 || totalDuration < 1) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoadingCalendar(true);
      try {
        const response = await fetch(`/api/availability/calendar?start=${monthStart}&duration=${totalDuration}&days=42`, { signal: controller.signal, cache: "no-store" });
        const result = await response.json() as { availableDates?: string[] };
        setAvailableDates(response.ok ? result.availableDates ?? [] : []);
      } catch { if (!controller.signal.aborted) setAvailableDates([]); }
      finally { if (!controller.signal.aborted) setLoadingCalendar(false); }
    }, 100);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [step, monthStart, totalDuration]);

  useEffect(() => {
    if (step !== 2) return;
    setStartTime("");
    if (!date || totalDuration < 1) { setSlots([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoadingSlots(true);
      try {
        const response = await fetch(`/api/availability?date=${encodeURIComponent(date)}&duration=${totalDuration}`, { signal: controller.signal, cache: "no-store" });
        const result = await response.json() as { slots?: Slot[] };
        setSlots(response.ok ? result.slots ?? [] : []);
      } catch { if (!controller.signal.aborted) setSlots([]); }
      finally { if (!controller.signal.aborted) setLoadingSlots(false); }
    }, 120);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [date, totalDuration, step]);

  function toggleSelected(id: string, current: string[], update: (next: string[]) => void) {
    update(current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function continueToDetails() {
    const form = document.getElementById("booking-customer-form") as HTMLFormElement | null;
    if (form?.reportValidity()) { setError(""); setStep(4); }
  }

  async function confirmBooking() {
    if (!vehicle || !startTime) return;
    setSubmitting(true);
    setError("");
    const whatsappWindow = whatsappReady ? window.open("about:blank", "_blank") : null;
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, startTime, vehicleTypeId: vehicle.id, serviceIds, addonIds, ...customer }),
      });
      const result = await response.json() as { error?: string; reference?: string; whatsappUrl?: string | null; summary?: Record<string, unknown> };
      if (!response.ok || !result.reference || !result.summary) throw new Error(result.error ?? "Could not save this booking. Please try again.");
      if (whatsappWindow && result.whatsappUrl) { whatsappWindow.opener = null; whatsappWindow.location.href = result.whatsappUrl; }
      else whatsappWindow?.close();
      sessionStorage.setItem(`carwash-booking:${result.reference}`, JSON.stringify({ ...result.summary, whatsappUrl: result.whatsappUrl ?? null, businessName }));
      router.push(`/book/success?ref=${encodeURIComponent(result.reference)}`);
    } catch (submitError) {
      whatsappWindow?.close();
      setError(submitError instanceof Error ? submitError.message : "Could not save this booking. Please try again.");
    } finally { setSubmitting(false); }
  }

  return <div className="booking-flow"><div className="booking-progress" aria-label={`Step ${step} of 4`}>{["Wash", "Time", "You", "Review"].map((label, index) => { const number = index + 1; return <div className={`booking-progress-step ${step >= number ? "active" : ""} ${step === number ? "current" : ""}`} key={label}><span>{step > number ? <Check size={13} /> : number}</span><small>{label}</small></div>; })}</div>
    {step === 1 && <section className="booking-step"><span className="eyebrow">STEP 1 OF 4 · CHOOSE YOUR WASH</span><h1>What are we washing?</h1><p className="booking-step-intro">Choose your vehicle, then pick one or more services.</p><h2 className="booking-subheading">Your vehicle</h2><div className="vehicle-choice-grid">{vehicles.map((item) => <button type="button" key={item.id} className={`vehicle-choice ${vehicleId === item.id ? "selected" : ""}`} onClick={() => { setVehicleId(item.id); setServiceIds([]); setAddonIds([]); }}><span className="vehicle-choice-icon"><Droplets size={18} /></span><strong>{item.name}</strong>{vehicleId === item.id && <Check className="vehicle-choice-check" size={15} />}</button>)}</div><h2 className="booking-subheading">Services <small>Select at least one</small></h2>{vehicleId ? <div className="booking-item-list">{services.map((item) => <button type="button" key={item.id} className={`booking-item-card ${serviceIds.includes(item.id) ? "selected" : ""}`} onClick={() => toggleSelected(item.id, serviceIds, setServiceIds)}><span className="booking-item-check">{serviceIds.includes(item.id) && <Check size={14} />}</span><span className="booking-item-info"><strong>{item.name}</strong><small><Clock3 size={12} /> {item.durationMinutes} min{item.description ? ` · ${item.description}` : ""}</small></span><span className="booking-item-price">{formatLkr(item.prices.find((price) => price.vehicleType === vehicleId)?.amount ?? 0)}</span></button>)}</div> : <p className="booking-empty-hint">Select your vehicle type to see prices.</p>}
      {vehicleId && addons.length > 0 && <><h2 className="booking-subheading addons-subheading">Optional extras</h2><div className="booking-item-list">{addons.map((item) => <button type="button" key={item.id} className={`booking-item-card addon-booking-item ${addonIds.includes(item.id) ? "selected" : ""}`} onClick={() => toggleSelected(item.id, addonIds, setAddonIds)}><span className="booking-item-check">{addonIds.includes(item.id) && <Check size={14} />}</span><span className="booking-item-info"><strong>{item.name}</strong><small><Clock3 size={12} /> +{item.durationMinutes} min{item.description ? ` · ${item.description}` : ""}</small></span><span className="booking-item-price">{formatLkr(item.prices.find((price) => price.vehicleType === vehicleId)?.amount ?? 0)}</span></button>)}</div></>}
      <div className="booking-total-bar"><span>{totalDuration ? `${totalDuration} min estimated` : "Choose a service"}</span><strong>{formatLkr(totalPrice)}</strong></div><button type="button" className="button booking-next-button" disabled={!vehicleId || !serviceIds.length} onClick={() => { setDate(today); setCalendarMonth(today.slice(0, 7)); setStep(2); }}>Choose date & time <ArrowRight size={16} /></button>
    </section>}
    {step === 2 && <section className="booking-step"><span className="eyebrow">STEP 2 OF 4 · PICK A TIME</span><h1>When works for you?</h1><p className="booking-step-intro">We only show dates and times with room for your full {totalDuration}-minute visit.</p><div className="booking-calendar"><div className="booking-calendar-head"><button type="button" aria-label="Previous month" disabled={previousMonth < today.slice(0, 7)} onClick={() => setCalendarMonth(previousMonth)}><ChevronLeft size={17} /></button><strong>{monthLabel}</strong><button type="button" aria-label="Next month" disabled={nextMonth > maxDate.slice(0, 7)} onClick={() => setCalendarMonth(nextMonth)}><ChevronRight size={17} /></button></div><div className="booking-calendar-grid calendar-weekdays">{["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="booking-calendar-grid">{Array.from({ length: firstWeekday }, (_, index) => <span className="calendar-blank" key={`blank-${index}`} />)}{Array.from({ length: monthDays }, (_, index) => { const dayKey = `${calendarMonth}-${String(index + 1).padStart(2, "0")}`; const isAvailable = availableDates.includes(dayKey); const disabled = dayKey < today || dayKey > maxDate || !isAvailable || loadingCalendar; return <button type="button" key={dayKey} disabled={disabled} aria-pressed={date === dayKey} className={`booking-calendar-day ${date === dayKey ? "selected" : ""} ${isAvailable ? "has-slots" : ""}`} onClick={() => setDate(dayKey)}>{index + 1}{isAvailable && <i />}</button>; })}</div>{loadingCalendar && <span className="calendar-loading"><LoaderCircle size={13} className="spin" /> Checking dates…</span>}</div><div className="booking-slot-heading"><h2 className="booking-subheading">{date === today ? "Today’s available times" : `Available times · ${date}`}</h2><span>{settings.timezone}</span></div>{loadingSlots ? <div className="booking-slots-message"><LoaderCircle size={17} className="spin" /> Checking availability…</div> : slots.length ? <div className="booking-time-grid">{slots.map((slot) => <button type="button" className={`booking-time-chip ${startTime === slot.startTime ? "selected" : ""}`} key={slot.startTime} onClick={() => setStartTime(slot.startTime)}>{slot.startTime}<small>Until {slot.endTime}</small></button>)}</div> : <p className="booking-slots-message">No times are available for this date. Choose a highlighted date.</p>}<div className="booking-step-actions"><button type="button" className="quiet-button" onClick={() => setStep(1)}><ArrowLeft size={14} /> Back</button><button type="button" className="button" disabled={!startTime} onClick={() => setStep(3)}>Your details <ArrowRight size={15} /></button></div></section>}
    {step === 3 && <section className="booking-step"><span className="eyebrow">STEP 3 OF 4 · YOUR DETAILS</span><h1>Who should we expect?</h1><p className="booking-step-intro">We’ll use your WhatsApp number to identify this booking.</p><form id="booking-customer-form" className="booking-customer-form" onSubmit={(event) => event.preventDefault()}><label>Your name<input autoComplete="name" required minLength={2} maxLength={80} value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} placeholder="Name" /></label><label>WhatsApp phone number<input type="tel" autoComplete="tel" required minLength={8} maxLength={24} value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} placeholder="+94 77 123 4567 or 077 123 4567" /><small>We’ll only use this to look up your booking and contact you about it.</small></label><label>Vehicle number<input autoComplete="off" maxLength={20} value={customer.vehicleNumber} onChange={(event) => setCustomer({ ...customer, vehicleNumber: event.target.value })} placeholder="Optional" /></label><label>Notes for the owner<textarea rows={3} maxLength={500} value={customer.notes} onChange={(event) => setCustomer({ ...customer, notes: event.target.value })} placeholder="Anything we should know? (optional)" /></label><label className="booking-honeypot" aria-hidden="true">Leave blank<input tabIndex={-1} autoComplete="off" value={customer.website} onChange={(event) => setCustomer({ ...customer, website: event.target.value })} /></label></form><div className="booking-step-actions"><button type="button" className="quiet-button" onClick={() => setStep(2)}><ArrowLeft size={14} /> Back</button><button type="button" className="button" onClick={continueToDetails}>Review booking <ArrowRight size={15} /></button></div></section>}
    {step === 4 && <section className="booking-step"><span className="eyebrow">STEP 4 OF 4 · REVIEW & CONFIRM</span><h1>All looking good?</h1><p className="booking-step-intro">Your request will be saved as pending. The owner will confirm your time.</p><div className="booking-review-card"><div className="booking-review-row"><span>Vehicle</span><strong>{vehicle?.name}{customer.vehicleNumber ? ` · ${customer.vehicleNumber.toUpperCase()}` : ""}</strong></div><div className="booking-review-row"><span>Date & time</span><strong>{new Date(`${date}T12:00:00.000Z`).toLocaleDateString("en-LK", { weekday: "long", day: "numeric", month: "long", timeZone: settings.timezone })} · {startTime}</strong></div><div className="booking-review-row review-items"><span>Services</span><strong>{[...selectedServices, ...selectedAddons].map((item) => item.name).join(", ")}</strong></div><div className="booking-review-row"><span>Estimated duration</span><strong>{totalDuration} minutes</strong></div><div className="booking-review-total"><span>Total</span><strong>{formatLkr(totalPrice)}</strong></div><p>Booking for {customer.name} · {customer.phone}</p>{customer.notes && <p className="review-note">Note: {customer.notes}</p>}</div>{error && <p className="booking-error" role="alert">{error}</p>}{!whatsappReady && <p className="booking-config-note">Your booking can be saved, but the business has not set its WhatsApp number yet.</p>}<div className="booking-step-actions"><button type="button" className="quiet-button" disabled={submitting} onClick={() => setStep(3)}><ArrowLeft size={14} /> Edit details</button><button type="button" className="button booking-confirm-button" disabled={submitting} onClick={confirmBooking}>{submitting ? <><LoaderCircle className="spin" size={16} /> Saving…</> : <>Confirm via WhatsApp <ArrowRight size={16} /></>}</button></div><button className="booking-review-back" type="button" onClick={() => setStep(1)}>Change services or vehicle</button></section>}
  </div>;
}

type SuccessSummary = { reference: string; date: string; startTime: string; endTime: string; timezone: string; startAt: string; endAt: string; vehicleType: string; vehicleNumber: string; itemNames: string[]; totalPrice: number; totalDuration: number; whatsappUrl: string | null; businessName: string };

export function BookingSuccess({ reference }: { reference: string }) {
  const [summary, setSummary] = useState<SuccessSummary | null>(null);
  useEffect(() => {
    const stored = sessionStorage.getItem(`carwash-booking:${reference}`);
    if (stored) {
      try { setSummary(JSON.parse(stored) as SuccessSummary); }
      catch { sessionStorage.removeItem(`carwash-booking:${reference}`); }
    }
  }, [reference]);

  function downloadCalendar() {
    if (!summary) return;
    const dateValue = (value: string) => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const escape = (value: string) => value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Car Wash Booking//EN", "BEGIN:VEVENT", `UID:${summary.reference}@carwash-booking`, `DTSTAMP:${dateValue(new Date().toISOString())}`, `DTSTART:${dateValue(summary.startAt)}`, `DTEND:${dateValue(summary.endAt)}`, `SUMMARY:${escape(`${summary.businessName} · ${summary.vehicleType} wash`)}`, `DESCRIPTION:${escape(`${summary.itemNames.join(", ")}\\nBooking reference: ${summary.reference}`)}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${summary.reference}.ics`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <main className="booking-success-page"><div className="booking-success-card"><span className="success-mark"><Check size={27} /></span><span className="eyebrow">REQUEST SAVED</span><h1>Thanks, you’re on the list.</h1><p className="success-intro">Your booking is pending until the owner confirms it. Keep this reference to check the status later.</p><div className="success-reference"><span>BOOKING REFERENCE</span><strong>{reference}</strong></div>{summary ? <><div className="success-summary"><p><span>When</span><strong>{summary.date} · {summary.startTime}–{summary.endTime}</strong></p><p><span>Vehicle</span><strong>{summary.vehicleType}{summary.vehicleNumber ? ` · ${summary.vehicleNumber}` : ""}</strong></p><p><span>Services</span><strong>{summary.itemNames.join(", ")}</strong></p><p><span>Estimated total</span><strong>{formatLkr(summary.totalPrice)}</strong></p></div><button type="button" className="button success-calendar-button" onClick={downloadCalendar}><CalendarDays size={16} /> Add to calendar</button>{summary.whatsappUrl ? <a className="success-whatsapp" href={summary.whatsappUrl} target="_blank" rel="noreferrer">Open your WhatsApp message <ArrowRight size={15} /></a> : <p className="booking-config-note">The business WhatsApp number is not set yet. Your booking is saved; you can check its status with your reference and phone.</p>}</> : <p className="success-intro">Your booking request was saved. Look it up with this reference and your phone number.</p>}<Link className="success-home-link" href="/">Back to home</Link></div></main>;
}
