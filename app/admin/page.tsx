import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarDays, Clock3, Coins, Sparkles } from "lucide-react";
import { auth } from "@/auth";
import { AdminDashboardCharts } from "@/components/AdminDashboardCharts";
import { AdminNavigation } from "@/components/AdminNavigation";
import { connectToDatabase } from "@/lib/db";
import { localDateKey } from "@/lib/slots";
import { Booking } from "@/models/Booking";
import { AvailabilitySettings, Payment } from "@/models/Operations";

export const dynamic = "force-dynamic";
const dateAtUtc = (year: number, month: number, day = 1) => new Date(Date.UTC(year, month, day));
const lkr = (amount: number) => new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 0 }).format(amount / 100);

export default async function AdminPage() {
  const session = await auth();
  if (session?.user?.role !== "owner") redirect("/admin/login");
  const today = new Date();
  const defaultIncome = Array.from({ length: 6 }, (_, index) => {
    const date = dateAtUtc(today.getUTCFullYear(), today.getUTCMonth() - 5 + index);
    return { month: new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(date), amount: 0 };
  });
  let metrics = { todayCount: 0, upcomingCount: 0, pendingCount: 0, todayIncome: 0, monthIncome: 0, popularService: "No bookings yet" };
  let income = defaultIncome;
  let statuses = ["Pending", "Confirmed", "In Progress", "Completed", "Cancelled", "No-show"].map((name) => ({ name, count: 0 }));
  let upcoming: Array<{ id: string; reference: string; name: string; date: string; startTime: string; status: string }> = [];
  if (process.env.MONGODB_URI) {
    await connectToDatabase();
    const settings = await AvailabilitySettings.findOne({ key: "default" }).select("timezone").lean() as unknown as { timezone?: string } | null;
    const timezone = settings?.timezone ?? "Asia/Colombo";
    const todayKey = localDateKey(new Date(), timezone);
    const currentYear = Number(todayKey.slice(0, 4));
    const currentMonth = Number(todayKey.slice(5, 7)) - 1;
    const monthStart = dateAtUtc(currentYear, currentMonth);
    const nextMonth = dateAtUtc(currentYear, currentMonth + 1);
    const sixMonthStart = dateAtUtc(currentYear, currentMonth - 5);
    const todayStart = new Date(`${todayKey}T00:00:00.000Z`);
    const tomorrow = new Date(todayStart.getTime() + 86_400_000);
    const [todayCount, upcomingCount, pendingCount, todayPayments, monthPayments, monthlyPayments, statusRows, popularRows, upcomingDocs] = await Promise.all([
      Booking.countDocuments({ date: todayStart, status: { $nin: ["Cancelled", "No-show"] } }),
      Booking.countDocuments({ date: { $gte: todayStart }, status: { $nin: ["Cancelled", "No-show"] } }),
      Booking.countDocuments({ status: "Pending" }),
      Payment.aggregate([{ $match: { paidAt: { $gte: todayStart, $lt: tomorrow } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Payment.aggregate([{ $match: { paidAt: { $gte: monthStart, $lt: nextMonth } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Payment.aggregate([{ $match: { paidAt: { $gte: sixMonthStart, $lt: nextMonth } } }, { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$paidAt", timezone } }, total: { $sum: "$amount" } } }]),
      Booking.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Booking.aggregate([{ $match: { status: { $nin: ["Cancelled", "No-show"] } } }, { $unwind: "$items" }, { $group: { _id: "$items.name", count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }, { $limit: 1 }]),
      Booking.find({ date: { $gte: todayStart }, status: { $nin: ["Cancelled", "No-show"] } }).sort({ date: 1, startTime: 1 }).limit(5).select("reference customer.name date startTime status").lean(),
    ]);
    const incomeMap = new Map(monthlyPayments.map((row: { _id: string; total: number }) => [row._id, Number(row.total)]));
    income = defaultIncome.map((entry, index) => {
      const keyDate = dateAtUtc(currentYear, currentMonth - 5 + index);
      return { ...entry, amount: incomeMap.get(`${keyDate.getUTCFullYear()}-${String(keyDate.getUTCMonth() + 1).padStart(2, "0")}`) ?? 0 };
    });
    const statusMap = new Map(statusRows.map((row: { _id: string; count: number }) => [row._id, Number(row.count)]));
    statuses = statuses.map((row) => ({ ...row, count: statusMap.get(row.name) ?? 0 }));
    metrics = { todayCount, upcomingCount, pendingCount, todayIncome: Number(todayPayments[0]?.total ?? 0), monthIncome: Number(monthPayments[0]?.total ?? 0), popularService: popularRows[0]?._id ?? "No bookings yet" };
    upcoming = (upcomingDocs as unknown as Array<{ _id: unknown; reference: string; customer: { name: string }; date: Date; startTime: string; status: string }>).map((row) => ({ id: String(row._id), reference: row.reference, name: row.customer.name, date: row.date.toISOString().slice(0, 10), startTime: row.startTime, status: row.status }));
  }
  return <main className="admin-shell"><AdminNavigation active="dashboard" /><div className="admin-top dashboard-heading"><div><span className="eyebrow">OWNER PORTAL · OVERVIEW</span><h1>Good to see you.</h1><p>Here is what is happening at your shop.</p></div><Link className="button" href="/admin/bookings"><CalendarDays size={15} /> Manage bookings</Link></div>
    <section className="dashboard-metrics"><article><span><CalendarDays size={14} /> BOOKINGS TODAY</span><strong>{metrics.todayCount}</strong><small>{metrics.pendingCount} awaiting confirmation</small></article><article><span><Clock3 size={14} /> UPCOMING</span><strong>{metrics.upcomingCount}</strong><small>Scheduled from today onward</small></article><article><span><Coins size={14} /> COLLECTED TODAY</span><strong>{lkr(metrics.todayIncome)}</strong><small>{lkr(metrics.monthIncome)} received this month</small></article><article><span><Sparkles size={14} /> POPULAR SERVICE</span><strong className="popular-service-value">{metrics.popularService}</strong><small>Most selected across bookings</small></article></section>
    {process.env.MONGODB_URI ? <><AdminDashboardCharts income={income} statuses={statuses} /><section className="dashboard-upcoming"><div className="dashboard-section-heading"><div><span className="eyebrow">NEXT ON THE SCHEDULE</span><h2>Upcoming bookings</h2></div><Link href="/admin/bookings">View all <ArrowRight size={14} /></Link></div>{upcoming.length ? <div className="dashboard-upcoming-list">{upcoming.map((booking) => <Link key={booking.id} href={`/admin/bookings?date=${booking.date}&q=${encodeURIComponent(booking.reference)}`}><span className="dashboard-upcoming-time">{booking.date} <b>{booking.startTime}</b></span><span><strong>{booking.name}</strong><small>{booking.reference}</small></span><span className={`booking-status status-${booking.status.toLowerCase().replaceAll(" ", "-")}`}>{booking.status}</span><ArrowRight size={14} /></Link>)}</div> : <div className="dashboard-no-upcoming">No upcoming bookings. <Link href="/admin/bookings/new">Add a booking</Link></div>}</section></> : <section className="welcome-panel"><div className="panel-icon">✦</div><div><span className="eyebrow">DATABASE CONNECTION REQUIRED</span><h2>Connect your shop data.</h2><p>Set MONGODB_URI and seed the app to see booking activity, income, and service trends here.</p><a className="button" href="/admin/settings/branding">Set up your brand</a></div></section>}
  </main>;
}
