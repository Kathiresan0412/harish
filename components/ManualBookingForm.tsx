"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, LoaderCircle } from "lucide-react";
import type { CatalogItem, CatalogPrice, CatalogVehicle } from "@/components/CatalogManager";
import { createManualBooking } from "@/app/actions/bookings";
import { formatLkr } from "@/lib/money";

type ManualItem = Pick<CatalogItem, "id" | "name" | "description" | "durationMinutes" | "prices">;
type Slot = { startTime: string; endTime: string };

export function ManualBookingForm({ services, addons, vehicles, today, maxAdvanceDays }: { services: ManualItem[]; addons: ManualItem[]; vehicles: CatalogVehicle[]; today: string; maxAdvanceDays: number }) {
  const [vehicleId, setVehicleId] = useState(vehicles.find((vehicle) => vehicle.active)?.id ?? "");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [checking, setChecking] = useState(false);
  const [slotError, setSlotError] = useState("");
  const selectedItems = useMemo(() => [...services.filter((item) => serviceIds.includes(item.id)), ...addons.filter((item) => addonIds.includes(item.id))], [services, addons, serviceIds, addonIds]);
  const duration = useMemo(() => selectedItems.reduce((sum, item) => sum + item.durationMinutes, 0), [selectedItems]);
  const total = selectedItems.reduce((sum, item) => sum + (item.prices.find((price) => price.vehicleType === vehicleId)?.amount ?? 0), 0);
  const maxDate = useMemo(() => { const value = new Date(`${today}T12:00:00.000Z`); value.setUTCDate(value.getUTCDate() + maxAdvanceDays); return value.toISOString().slice(0, 10); }, [maxAdvanceDays, today]);

  useEffect(() => {
    setStartTime("");
    if (!date || !duration) { setSlots([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setChecking(true); setSlotError("");
      try {
        const response = await fetch(`/api/availability?date=${encodeURIComponent(date)}&duration=${duration}`, { signal: controller.signal, cache: "no-store" });
        const result = await response.json() as { slots?: Slot[]; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Unable to check availability.");
        setSlots(result.slots ?? []);
      } catch (error) { if (!controller.signal.aborted) { setSlots([]); setSlotError(error instanceof Error ? error.message : "Unable to check availability."); } }
      finally { if (!controller.signal.aborted) setChecking(false); }
    }, 120);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [date, duration]);

  function toggle(id: string, current: string[], set: (ids: string[]) => void) { set(current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  function priceFor(item: ManualItem) { return item.prices.find((price: CatalogPrice) => price.vehicleType === vehicleId)?.amount ?? 0; }

  return <form action={createManualBooking} className="manual-booking-form"><section className="manual-form-section"><span className="eyebrow">CUSTOMER & VEHICLE</span><div className="manual-form-grid"><label>Customer name<input name="name" required minLength={2} maxLength={80} placeholder="Customer name" /></label><label>Phone / WhatsApp<input name="phone" type="tel" required placeholder="+94 77 123 4567" /></label><label>Vehicle type<select name="vehicleTypeId" value={vehicleId} onChange={(event) => { setVehicleId(event.target.value); setServiceIds([]); setAddonIds([]); }} required>{vehicles.filter((vehicle) => vehicle.active).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}</select></label><label>Vehicle number<input name="vehicleNumber" maxLength={20} placeholder="Optional" /></label></div></section>
    <section className="manual-form-section"><span className="eyebrow">SERVICES</span><div className="manual-catalog-list">{services.map((service) => <label className="manual-catalog-row" key={service.id}><input type="checkbox" name="serviceIds" value={service.id} checked={serviceIds.includes(service.id)} onChange={() => toggle(service.id, serviceIds, setServiceIds)} /><span><strong>{service.name}</strong><small>{service.durationMinutes} min · {service.description}</small></span><b>{formatLkr(priceFor(service))}</b></label>)}</div><span className="eyebrow manual-addon-eyebrow">OPTIONAL ADD-ONS</span><div className="manual-catalog-list">{addons.map((addon) => <label className="manual-catalog-row" key={addon.id}><input type="checkbox" name="addonIds" value={addon.id} checked={addonIds.includes(addon.id)} onChange={() => toggle(addon.id, addonIds, setAddonIds)} /><span><strong>{addon.name}</strong><small>+{addon.durationMinutes} min · {addon.description}</small></span><b>{formatLkr(priceFor(addon))}</b></label>)}</div><div className="manual-total-row"><span>{duration || 0} min estimate</span><strong>{formatLkr(total)}</strong></div></section>
    <section className="manual-form-section"><span className="eyebrow">DATE & AVAILABLE TIME</span><div className="manual-time-controls"><label>Date<input type="date" name="date" min={today} max={maxDate} value={date} onChange={(event) => setDate(event.target.value)} required /></label><span>{checking ? <><LoaderCircle className="spin" size={14} /> Checking slots…</> : `${slots.length} available`}</span></div><input type="hidden" name="startTime" value={startTime} />{slotError ? <p className="manual-slot-message error">{slotError}</p> : slots.length ? <div className="booking-time-grid manual-time-grid">{slots.map((slot) => <button type="button" className={`booking-time-chip ${startTime === slot.startTime ? "selected" : ""}`} key={slot.startTime} onClick={() => setStartTime(slot.startTime)}>{slot.startTime}<small>Until {slot.endTime}</small></button>)}</div> : <p className="manual-slot-message">{duration ? "No available times for this date. Choose another." : "Select services to see available times."}</p>}</section>
    <section className="manual-form-section"><span className="eyebrow">OWNER NOTES</span><label className="manual-notes-field">Private notes<textarea name="notes" rows={3} maxLength={500} placeholder="Walk-in, call details, or special instructions" /></label></section><div className="manual-booking-footer"><a className="quiet-button" href="/admin/bookings"><ArrowLeft size={14} /> Back to bookings</a><button className="button" type="submit" disabled={!startTime || !serviceIds.length}><CalendarDays size={15} /> Save manual booking</button></div>
  </form>;
}
