import { redirect } from "next/navigation";
import { Search, Users } from "lucide-react";
import { auth } from "@/auth";
import { saveCustomerNotes } from "@/app/actions/operations";
import { AdminNavigation } from "@/components/AdminNavigation";
import { connectToDatabase } from "@/lib/db";
import { Booking } from "@/models/Booking";
import { Customer } from "@/models/Operations";

export const dynamic = "force-dynamic";
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const money = (value: number) => new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 0 }).format(value / 100);

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "owner") redirect("/admin/login");
  const params = await searchParams;
  const q = params.q?.trim().slice(0, 80) ?? "";
  let customers: Array<{ name: string; phone: string; vehicles: string[]; visits: number; spend: number; lastVisit: string; notes: string }> = [];
  if (process.env.MONGODB_URI) {
    await connectToDatabase();
    const match = q ? { $match: { $or: [{ "customer.name": new RegExp(escapeRegex(q), "i") }, { "customer.phone": new RegExp(escapeRegex(q), "i") }] } } : { $match: {} };
    const [groups, customerDocs] = await Promise.all([
      Booking.aggregate([match, { $lookup: { from: "payments", localField: "_id", foreignField: "booking", as: "payments" } }, { $addFields: { paid: { $sum: "$payments.amount" } } }, { $group: { _id: "$customer.phone", name: { $last: "$customer.name" }, vehicles: { $addToSet: "$vehicleNumber" }, visits: { $sum: 1 }, spend: { $sum: "$paid" }, lastVisit: { $max: "$date" } } }, { $sort: { lastVisit: -1 } }, { $limit: 100 }]),
      q ? Customer.find({ $or: [{ name: new RegExp(escapeRegex(q), "i") }, { phone: new RegExp(escapeRegex(q), "i") }] }).select("phone notes").lean() : Customer.find().select("phone notes").lean(),
    ]);
    const notes = new Map((customerDocs as unknown as Array<{ phone: string; notes: string }>).map((customer) => [customer.phone, customer.notes]));
    customers = groups.map((row: { _id: string; name: string; vehicles: string[]; visits: number; spend: number; lastVisit: Date }) => ({ name: row.name, phone: row._id, vehicles: row.vehicles.filter(Boolean), visits: row.visits, spend: row.spend, lastVisit: row.lastVisit.toISOString().slice(0, 10), notes: notes.get(row._id) ?? "" }));
  }
  return <main className="admin-shell"><AdminNavigation active="customers" /><div className="admin-top operations-heading"><div><span className="eyebrow">OWNER PORTAL · CUSTOMER RECORDS</span><h1>Customers.</h1><p>Booking history, recorded payments, vehicles, and private notes.</p></div></div><form className="customer-search-form" action="/admin/customers"><label><Search size={15} /><input type="search" name="q" defaultValue={q} placeholder="Search by customer name or phone" /></label><button className="quiet-button" type="submit">Search</button></form>{!process.env.MONGODB_URI ? <section className="bookings-empty"><h2>Connect your database</h2></section> : customers.length ? <div className="customer-record-list">{customers.map((customer) => <article className="customer-record" key={customer.phone}><header><div><h2>{customer.name}</h2><a href={`tel:${customer.phone}`}>{customer.phone}</a></div><span>{customer.visits} booking{customer.visits === 1 ? "" : "s"}</span></header><div className="customer-record-stats"><span>Last booking <strong>{customer.lastVisit}</strong></span><span>Recorded spend <strong>{money(customer.spend)}</strong></span><span>Vehicles <strong>{customer.vehicles.length ? customer.vehicles.join(", ") : "Not recorded"}</strong></span></div><form action={saveCustomerNotes}><input type="hidden" name="name" value={customer.name} /><input type="hidden" name="phone" value={customer.phone} /><label>Private customer notes<textarea name="notes" rows={2} maxLength={1000} defaultValue={customer.notes} placeholder="Preferences or customer details" /></label><button className="quiet-button" type="submit">Save notes</button></form></article>)}</div> : <section className="bookings-empty"><Users size={20} /><h2>No customer bookings found</h2><p>Customer records appear when bookings are received.</p></section>}</main>;
}
