import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminNavigation } from "@/components/AdminNavigation";
import { CatalogManager, type CatalogItem, type CatalogVehicle } from "@/components/CatalogManager";
import { connectToDatabase } from "@/lib/db";
import { Addon, Service, VehicleType } from "@/models/catalog";

export default async function ServicesAdminPage() {
  const session = await auth();
  if (session?.user?.role !== "owner") redirect("/admin/login");
  let services: Array<Record<string, unknown>> = [];
  let addons: Array<Record<string, unknown>> = [];
  let vehicles: Array<Record<string, unknown>> = [];
  if (process.env.MONGODB_URI) {
    await connectToDatabase();
    const [serviceDocs, addonDocs, vehicleDocs] = await Promise.all([
      Service.find({ deletedAt: null }).sort({ sortOrder: 1, name: 1 }).lean(),
      Addon.find({ deletedAt: null }).sort({ sortOrder: 1, name: 1 }).lean(),
      VehicleType.find().sort({ sortOrder: 1, name: 1 }).lean(),
    ]);
    services = JSON.parse(JSON.stringify(serviceDocs));
    addons = JSON.parse(JSON.stringify(addonDocs));
    vehicles = JSON.parse(JSON.stringify(vehicleDocs));
  }
  const normalizedVehicles: CatalogVehicle[] = vehicles.map((vehicle) => ({ id: String(vehicle._id), name: String(vehicle.name ?? ""), sortOrder: Number(vehicle.sortOrder ?? 0), active: Boolean(vehicle.active) }));
  const normalizeItems = (items: Array<Record<string, unknown>>): CatalogItem[] => items.map((item) => ({
    id: String(item._id), name: String(item.name ?? ""), description: String(item.description ?? ""), photoUrl: String(item.photoUrl ?? ""), durationMinutes: Number(item.durationMinutes ?? 0),
    sortOrder: Number(item.sortOrder ?? 0), active: Boolean(item.active),
    prices: Array.isArray(item.prices) ? item.prices.map((price) => { const row = price as Record<string, unknown>; return { vehicleType: String(row.vehicleType), amount: Number(row.amount ?? 0) }; }) : [],
  }));
  return <main className="admin-shell"><AdminNavigation active="services" /><div className="page-heading"><span className="eyebrow">YOUR CATALOG</span><h1>Services & pricing.</h1><p>Manage what customers can book. Prices are set separately for each vehicle type.</p></div><CatalogManager services={normalizeItems(services)} addons={normalizeItems(addons)} vehicles={normalizedVehicles} /></main>;
}
