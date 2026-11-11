"use client";

import { useState } from "react";
import { CalendarDays, Check, Clock3, LoaderCircle, Search } from "lucide-react";
import { formatLkr } from "@/lib/public-catalog";

type BookingResult = { reference: string; status: string; date: string; startTime: string; endTime: string; vehicleType: string; vehicleNumber: string; items: Array<{ name: string; kind: string }>; totalPrice: number; paymentStatus: string; customerRequest: null | { type: string; status: string; requestedDate: string | null; requestedStartTime: string } };

export function BookingLookup({ today }: { today: string }) {
  const [reference, setReference] = useState("");
  const [phone, setPhone] = useState("");
  const [booking, setBooking] = useState<BookingResult | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function sendRequest(payload: Record<string, unknown>) {
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/booking-lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string; message?: string; booking?: BookingResult };
      if (!response.ok) throw new Error(result.error ?? "Could not complete this request.");
      if (result.booking) setBooking(result.booking);
      if (result.message) {
        setMessage(result.message);
        setBooking((current) => current ? { ...current, customerRequest: { type: String(payload.requestType), status: "Pending", requestedDate: typeof payload.requestedDate === "string" ? payload.requestedDate : null, requestedStartTime: typeof payload.requestedStartTime === "string" ? payload.requestedStartTime : "" } } : current);
      }
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Could not complete this request."); }
    finally { setPending(false); }
  }

  function lookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBooking(null);
    void sendRequest({ action: "lookup", reference, phone });
  }

  function requestChange(requestType: "cancel" | "reschedule", requestedDate?: string, requestedStartTime?: string, note?: string) {
    if (requestType === "cancel" && !window.confirm("Send a cancellation request to the owner? The booking stays active until they approve it.")) return;
    void sendRequest({ action: "request", requestType, reference, phone, requestedDate, requestedStartTime, note });
  }

  return <div className="lookup-layout"><section className="lookup-card"><div className="lookup-heading-icon"><Search size={19} /></div><span className="eyebrow">BOOKING LOOKUP</span><h1>Find your booking.</h1><p>Enter the reference from your confirmation and the phone number you used.</p><form className="lookup-form" onSubmit={lookup}><label>Booking reference<input required autoCapitalize="characters" value={reference} onChange={(event) => setReference(event.target.value.toUpperCase())} placeholder="CW-0001" /></label><label>Phone number<input required autoComplete="tel" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+94 77 123 4567" /></label><button className="button" type="submit" disabled={pending}>{pending ? <LoaderCircle className="spin" size={16} /> : <Search size={16} />}Look up booking</button></form>{error && <p className="lookup-error" role="alert">{error}</p>}</section>
    {booking && <section className="lookup-result"><div className="lookup-result-head"><div><span className="eyebrow">YOUR BOOKING</span><h2>{booking.reference}</h2></div><span className={`booking-status status-${booking.status.toLowerCase().replaceAll(" ", "-")}`}>{booking.status}</span></div><div className="lookup-details"><p><span>Date & time</span><strong>{booking.date} · {booking.startTime}–{booking.endTime}</strong></p><p><span>Vehicle</span><strong>{booking.vehicleType}{booking.vehicleNumber ? ` · ${booking.vehicleNumber}` : ""}</strong></p><p><span>Services</span><strong>{booking.items.map((item) => item.name).join(", ")}</strong></p><p><span>Total</span><strong>{formatLkr(booking.totalPrice)}</strong></p><p><span>Payment</span><strong>{booking.paymentStatus}</strong></p></div>
      {booking.customerRequest?.status === "Pending" ? <div className="lookup-pending-request"><Clock3 size={16} /><span>Your {booking.customerRequest.type} request is waiting for the owner.</span></div> : ["Pending", "Confirmed"].includes(booking.status) ? <div className="lookup-change-area"><span className="eyebrow">NEED TO CHANGE SOMETHING?</span><h3>Request a change</h3><p>The owner will review and approve your request. Your current booking stays active until then.</p><form className="reschedule-request-form" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); requestChange("reschedule", String(form.get("requestedDate")), String(form.get("requestedStartTime")), String(form.get("note"))); }}><label>New date<input name="requestedDate" type="date" min={today} required /></label><label>Preferred time<input name="requestedStartTime" type="time" required /></label><label className="request-note">Note (optional)<input name="note" maxLength={300} placeholder="Reason or preferred times" /></label><button className="quiet-button" type="submit" disabled={pending}><CalendarDays size={14} /> Request reschedule</button></form><button className="cancel-request-button" type="button" disabled={pending} onClick={() => requestChange("cancel", undefined, undefined, "Customer requested cancellation")}>Request cancellation</button></div> : <p className="lookup-closed-note">This booking can no longer be changed online. Please contact the business.</p>}
      {message && <p className="lookup-success-message" role="status"><Check size={15} />{message}</p>}
    </section>}
  </div>;
}
