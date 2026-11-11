import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { AdminNavigation } from "@/components/AdminNavigation";
import { ManualBookingForm } from "@/components/ManualBookingForm";
import { connectToDatabase } from "@/lib/db";
import { localDateKey } from "@/lib/slots";
import { AvailabilitySettings } from "@/models/Operations";
import { Addon, Service, VehicleType } from "@/models/catalog";

export const dynamic = "force-dynamic";
type Price = { vehicleType: unknown; amount: number };
type Item = { _id: unknown; name: string; description: string; durationMinutes: number; prices: Price[] };

export default async function NewManualBookingPage() {
  const session = await auth();
  if (session?.user?.role !== "owner") redirect("/admin/login");
  let services: Array<{ id: string; name: string; description: string; durationMinutes: number; prices: Array<{ vehicleType: string; amount: number }> }> = [];
  let addons: typeof services = [];
  let vehicles: Array<{ id: string; name: string; active: boolean; sortOrder: number }> = [];
  let maxAdvanceDays = 30;
  let timezone = "Asia/Colombo";
  if (process.env.MONGODB_URI) {
    await connectToDatabase();
    const [serviceDocs, addonDocs, vehicleDocs, settings] = await Promise.all([
      Service.find({ active: true, deletedAt: null }).sort({ sortOrder: 1, name: 1 }).lean(),
      Addon.find({ active: true, deletedAt: null }).sort({ sortOrder: 1, name: 1 }).lean(),
      VehicleType.find({ active: true }).sort({ sortOrder: 1, name: 1 }).lean(),
      AvailabilitySettings.findOne({ key: "default" }).select("maximumAdvanceDays timezone").lean(),
    ]);
    const mapItems = (docs: unknown[]) => (docs as Item[]).map((item) => ({ id: String(item._id), name: item.name, description: item.description, durationMinutes: item.durationMinutes, prices: item.prices.map((price) => ({ vehicleType: String(price.vehicleType), amount: price.amount })) }));
    services = mapItems(serviceDocs);
    addons = mapItems(addonDocs);
    vehicles = (vehicleDocs as unknown as Array<{ _id: unknown; name: string; active: boolean; sortOrder: number }>).map((vehicle) => ({ id: String(vehicle._id), name: vehicle.name, active: vehicle.active, sortOrder: vehicle.sortOrder }));
    maxAdvanceDays = (settings as { maximumAdvanceDays?: number } | null)?.maximumAdvanceDays ?? 30;
    timezone = (settings as { timezone?: string } | null)?.timezone ?? timezone;
  }
  const today = localDateKey(new Date(), timezone);
  return <main className="admin-shell"><AdminNavigation active="bookings" /><div className="admin-top manual-booking-heading"><div><Link className="back-link" href="/admin/bookings"><ArrowLeft size={14} /> Back to bookings</Link><span className="eyebrow">OWNER PORTAL · WALK-IN / PHONE</span><h1>Add a booking.</h1><p>Choose an open time and save a confirmed booking for your customer.</p></div></div>{!process.env.MONGODB_URI ? <section className="bookings-empty"><h2>Connect your database</h2><p>Set MONGODB_URI to add manual bookings.</p></section> : vehicles.length && services.length ? <ManualBookingForm services={services} addons={addons} vehicles={vehicles} today={today} maxAdvanceDays={maxAdvanceDays} /> : <section className="bookings-empty"><h2>Catalog setup needed</h2><p>Add at least one active vehicle type and service before creating a booking.</p><Link className="button" href="/admin/services">Manage services</Link></section>}</main>;
}
