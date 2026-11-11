import { connectToDatabase } from "@/lib/db";
import { Addon, Service, VehicleType } from "@/models/catalog";

export type PublicVehicle = { id: string; name: string };
export type PublicPrice = { vehicleType: string; amount: number };
export type PublicCatalogItem = { id: string; name: string; description: string; photoUrl?: string; durationMinutes: number; prices: PublicPrice[] };

export async function getPublicCatalog() {
  if (!process.env.MONGODB_URI) return { services: [] as PublicCatalogItem[], addons: [] as PublicCatalogItem[], vehicles: [] as PublicVehicle[] };
  try {
    await connectToDatabase();
    const [serviceDocs, addonDocs, vehicleDocs] = await Promise.all([
      Service.find({ active: true, deletedAt: null }).sort({ sortOrder: 1, name: 1 }).lean(),
      Addon.find({ active: true, deletedAt: null }).sort({ sortOrder: 1, name: 1 }).lean(),
      VehicleType.find({ active: true }).sort({ sortOrder: 1, name: 1 }).lean(),
    ]);
    const normalize = (items: typeof serviceDocs, includePhoto = false): PublicCatalogItem[] => items.map((item) => ({
      id: String(item._id), name: item.name, description: item.description, ...(includePhoto ? { photoUrl: item.photoUrl } : {}), durationMinutes: item.durationMinutes,
      prices: (item.prices as Array<{ vehicleType: unknown; amount: number }>).map((price) => ({ vehicleType: String(price.vehicleType), amount: price.amount })),
    }));
    return {
      services: normalize(serviceDocs, true),
      addons: normalize(addonDocs),
      vehicles: vehicleDocs.map((vehicle) => ({ id: String(vehicle._id), name: vehicle.name })),
    };
  } catch {
    return { services: [] as PublicCatalogItem[], addons: [] as PublicCatalogItem[], vehicles: [] as PublicVehicle[] };
  }
}

export function formatLkr(minorUnits: number) {
  return new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(minorUnits / 100);
}
