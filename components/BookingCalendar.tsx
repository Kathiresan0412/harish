import Link from "next/link";
import type { AdminBooking } from "@/components/BookingAdminCard";

export function BookingCalendar({ bookings, weekStart, timezone }: { bookings: AdminBooking[]; weekStart: string; timezone: string }) {
  const start = new Date(`${weekStart}T00:00:00.000Z`);
  const days = Array.from({ length: 7 }, (_, index) => new Date(start.getTime() + index * 86_400_000).toISOString().slice(0, 10));
  const byDate = new Map<string, AdminBooking[]>();
  for (const booking of bookings) byDate.set(booking.date, [...(byDate.get(booking.date) ?? []), booking]);
  return <div className="booking-week-calendar">{days.map((date) => {
    const dateBookings = byDate.get(date) ?? [];
    const label = new Intl.DateTimeFormat("en-LK", { weekday: "short", day: "numeric", month: "short", timeZone: timezone }).format(new Date(`${date}T12:00:00.000Z`));
    return <section className={`booking-calendar-day-column ${dateBookings.length ? "has-bookings" : ""}`} key={date}><header><strong>{label}</strong><span>{dateBookings.length}</span></header>{dateBookings.length ? <div className="booking-calendar-day-list">{dateBookings.map((booking) => <Link className={`booking-calendar-event event-${booking.status.toLowerCase().replaceAll(" ", "-")}`} href={`/admin/bookings?date=${booking.date}&q=${encodeURIComponent(booking.reference)}`} key={booking.id}><b>{booking.startTime}</b><span>{booking.customer.name}</span><small>{booking.reference} · {booking.status}</small></Link>)}</div> : <p>No bookings</p>}</section>;
  })}</div>;
}
