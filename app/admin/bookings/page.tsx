import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, Plus, Search } from "lucide-react";
import { auth } from "@/auth";
import { AdminNavigation } from "@/components/AdminNavigation";
import { BookingAdminCard, type AdminBooking } from "@/components/BookingAdminCard";
import { BookingCalendar } from "@/components/BookingCalendar";
import { connectToDatabase } from "@/lib/db";
import { localDateKey } from "@/lib/slots";
import { Booking } from "@/models/Booking";
import { AvailabilitySettings, Payment } from "@/models/Operations";
import { Service, VehicleType } from "@/models/catalog";

export const dynamic = "force-dynamic";
const statuses = ["Pending", "Confirmed", "In Progress", "Completed", "Cancelled", "No-show"];
const validDateKey = (value?: string) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value);
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const offsetDate = (date: string, offset: number) => { const result = new Date(`${date}T00:00:00.000Z`); result.setUTCDate(result.getUTCDate() + offset); return result.toISOString().slice(0, 10); };

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; status?: string; service?: string; vehicle?: string; q?: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "owner") redirect("/admin/login");
  const params = await searchParams;
  const view = params.view === "week" ? "week" : "list";
  let timezone = "Asia/Colombo";
  let bookings: AdminBooking[] = [];
  let services: Array<{ id: string; name: string }> = [];
  let vehicles: Array<{ id: string; name: string }> = [];
  let rangeStart = "";
  let rangeEnd = "";
  if (process.env.MONGODB_URI) {
    await connectToDatabase();
    const settings = await AvailabilitySettings.findOne({ key: "default" }).select("timezone").lean() as unknown as { timezone?: string } | null;
    timezone = settings?.timezone ?? timezone;
    const today = localDateKey(new Date(), timezone);
    const requestedDate = validDateKey(params.date) ? params.date! : today;
    if (view === "week") {
      const day = new Date(`${requestedDate}T00:00:00.000Z`).getUTCDay();
      rangeStart = offsetDate(requestedDate, -((day + 6) % 7));
      rangeEnd = offsetDate(rangeStart, 7);
    } else if (validDateKey(params.date)) {
      rangeStart = requestedDate;
      rangeEnd = offsetDate(requestedDate, 1);
    } else if (!params.q) {
      rangeStart = today;
      rangeEnd = offsetDate(today, 15);
    }
    const filter: Record<string, unknown> = {};
    if (rangeStart) filter.date = { $gte: new Date(`${rangeStart}T00:00:00.000Z`), $lt: new Date(`${rangeEnd}T00:00:00.000Z`) };
    if (statuses.includes(params.status ?? "")) filter.status = params.status;
    if (/^[a-f\d]{24}$/i.test(params.vehicle ?? "")) filter.vehicleType = params.vehicle;
    if (/^[a-f\d]{24}$/i.test(params.service ?? "")) filter["items.itemId"] = params.service;
    if (params.q?.trim()) {
      const query = new RegExp(escapeRegex(params.q.trim().slice(0, 80)), "i");
      filter.$or = [{ reference: query }, { "customer.name": query }, { "customer.phone": query }];
    }
    const [docs, serviceDocs, vehicleDocs] = await Promise.all([
      Booking.find(filter).sort({ date: 1, startTime: 1 }).limit(200).lean(),
      Service.find({ active: true, deletedAt: null }).select("_id name").sort({ sortOrder: 1, name: 1 }).lean(),
      VehicleType.find({ active: true }).select("_id name").sort({ sortOrder: 1, name: 1 }).lean(),
    ]);
    const bookingIds = docs.map((booking) => booking._id);
    const paymentTotals = bookingIds.length ? await Payment.aggregate([{ $match: { booking: { $in: bookingIds } } }, { $group: { _id: "$booking", total: { $sum: "$amount" } } }]) : [];
    const paidByBooking = new Map(paymentTotals.map((payment) => [String(payment._id), Number(payment.total)]));
    bookings = docs.map((booking: (typeof docs)[number]) => ({
      id: String(booking._id), reference: booking.reference, customer: { name: booking.customer.name, phone: booking.customer.phone }, vehicleTypeName: booking.vehicleTypeName, vehicleNumber: booking.vehicleNumber,
      items: booking.items.map((item: { name: string; kind: string; price: number }) => ({ name: item.name, kind: item.kind, price: item.price })), totalPrice: booking.totalPrice, totalDuration: booking.totalDuration,
      date: booking.date.toISOString().slice(0, 10), startTime: booking.startTime, endTime: booking.endTime, status: booking.status, paymentStatus: booking.paymentStatus, notes: booking.notes, source: booking.source,
      customerRequest: booking.customerRequest ? { type: booking.customerRequest.type, status: booking.customerRequest.status, requestedDate: booking.customerRequest.requestedDate?.toISOString().slice(0, 10) ?? null, requestedStartTime: booking.customerRequest.requestedStartTime, note: booking.customerRequest.note } : null,
      paidAmount: paidByBooking.get(String(booking._id)) ?? 0,
    }));
    services = serviceDocs.map((item) => ({ id: String(item._id), name: item.name }));
    vehicles = vehicleDocs.map((item) => ({ id: String(item._id), name: item.name }));
  }
  const anchorDate = validDateKey(params.date) ? params.date! : localDateKey(new Date(), timezone);
  const rangeTitle = view === "week" ? `${rangeStart} – ${offsetDate(rangeEnd, -1)}` : params.date ? anchorDate : "Upcoming bookings";
  const queryParts = new URLSearchParams();
  if (params.date) queryParts.set("date", params.date);
  if (params.status) queryParts.set("status", params.status);
  if (params.service) queryParts.set("service", params.service);
  if (params.vehicle) queryParts.set("vehicle", params.vehicle);
  if (params.q) queryParts.set("q", params.q);
  const filterQuery = queryParts.toString();
  const viewLink = (nextView: string, date: string) => `/admin/bookings?${new URLSearchParams({ ...(params.status ? { status: params.status } : {}), ...(params.service ? { service: params.service } : {}), ...(params.vehicle ? { vehicle: params.vehicle } : {}), ...(params.q ? { q: params.q } : {}), view: nextView, date }).toString()}`;
  const navDate = view === "week" ? rangeStart : anchorDate;
  return <main className="admin-shell"><AdminNavigation active="bookings" /><div className="admin-top bookings-page-heading"><div><span className="eyebrow">OWNER PORTAL · BOOKINGS</span><h1>Bookings.</h1><p>Review requests, manage appointments, and keep every visit on track.</p></div><Link className="button" href="/admin/bookings/new"><Plus size={16} /> Add booking</Link></div>
    <form className="booking-filters" action="/admin/bookings" method="get"><input type="hidden" name="view" value={view} /><label className="booking-search-field"><Search size={15} /><input type="search" name="q" defaultValue={params.q} placeholder="Search name, phone, or reference" /></label><label><span>Status</span><select name="status" defaultValue={params.status ?? ""}><option value="">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label><label><span>Date</span><input type="date" name="date" defaultValue={params.date ?? ""} /></label><label><span>Service</span><select name="service" defaultValue={params.service ?? ""}><option value="">All services</option>{services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>Vehicle</span><select name="vehicle" defaultValue={params.vehicle ?? ""}><option value="">All vehicles</option>{vehicles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button className="quiet-button" type="submit">Apply filters</button></form>
    <div className="bookings-view-toolbar"><div className="bookings-view-switch"><Link className={view === "list" ? "selected" : ""} href={`/admin/bookings${filterQuery ? `?${filterQuery}` : ""}`}>List</Link><Link className={view === "week" ? "selected" : ""} href={viewLink("week", anchorDate)}>Week</Link></div><div className="bookings-range-nav"><Link aria-label="Previous period" href={viewLink(view, offsetDate(navDate, view === "week" ? -7 : -1))}><ArrowLeft size={14} /></Link><strong>{rangeTitle}</strong><Link aria-label="Next period" href={viewLink(view, offsetDate(navDate, view === "week" ? 7 : 1))}><ArrowRight size={14} /></Link></div><span className="bookings-result-count">{bookings.length} booking{bookings.length === 1 ? "" : "s"}</span></div>
    {!process.env.MONGODB_URI ? <div className="bookings-empty"><CalendarDays size={20} /><h2>Connect your database</h2><p>Set MONGODB_URI and seed the app to load bookings.</p></div> : view === "week" ? <BookingCalendar bookings={bookings} weekStart={rangeStart} timezone={timezone} /> : bookings.length ? <div className="admin-booking-list">{bookings.map((booking) => <BookingAdminCard key={booking.id} booking={booking} timezone={timezone} />)}</div> : <div className="bookings-empty"><CalendarDays size={20} /><h2>No bookings found</h2><p>Try changing your filters or add a manual booking.</p><Link className="button" href="/admin/bookings/new"><Plus size={15} /> Add a booking</Link></div>}
  </main>;
}
