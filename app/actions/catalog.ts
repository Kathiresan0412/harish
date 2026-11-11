"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db";
import { Addon, Service, VehicleType } from "@/models/catalog";

const text = (value: FormDataEntryValue | null) => typeof value === "string" ? value.trim() : "";
const positiveInt = z.coerce.number().int().positive();
const nonNegativeInt = z.coerce.number().int().min(0);

async function requireOwner() {
  const session = await auth();
  if (session?.user?.role !== "owner") throw new Error("Unauthorized");
  await connectToDatabase();
}

function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function pricesFromForm(formData: FormData) {
  const vehicles = await VehicleType.find({ active: true }).select("_id").lean();
  if (vehicles.length === 0) throw new Error("Create an active vehicle type before adding catalog items");
  return vehicles.map((vehicle) => {
    const raw = text(formData.get(`price_${String(vehicle._id)}`));
    const majorUnits = z.coerce.number().finite().min(0).safeParse(raw);
    if (!majorUnits.success) throw new Error("Enter a valid price for every active vehicle type");
    return { vehicleType: vehicle._id, amount: Math.round(majorUnits.data * 100) };
  });
}

async function uniqueSlug(name: string, model: typeof Service | typeof Addon, id: string) {
  const base = slugify(name);
  if (!base) throw new Error("Use a name with letters or numbers");
  const conflict = await model.findOne({ slug: base, ...(id ? { _id: { $ne: id } } : {}) }).select("_id").lean();
  return conflict ? `${base}-${Date.now().toString(36)}` : base;
}

export async function saveService(formData: FormData): Promise<void> {
  await requireOwner();
  const parsed = z.object({ id: z.string().optional(), name: z.string().trim().min(2).max(80), nameTa: z.string().trim().max(80), nameSi: z.string().trim().max(80), description: z.string().trim().max(500), descriptionTa: z.string().trim().max(500), descriptionSi: z.string().trim().max(500), photoUrl: z.string().url().or(z.literal("")), durationMinutes: positiveInt.max(600), sortOrder: nonNegativeInt, active: z.enum(["true", "false"]) }).parse({
    id: text(formData.get("id")) || undefined, name: text(formData.get("name")), nameTa: text(formData.get("nameTa")), nameSi: text(formData.get("nameSi")), description: text(formData.get("description")), descriptionTa: text(formData.get("descriptionTa")), descriptionSi: text(formData.get("descriptionSi")), photoUrl: text(formData.get("photoUrl")), durationMinutes: text(formData.get("durationMinutes")), sortOrder: text(formData.get("sortOrder")) || "0", active: text(formData.get("active")) || "true",
  });
  const prices = await pricesFromForm(formData);
  const slug = await uniqueSlug(parsed.name, Service, parsed.id ?? "");
  const { id, ...values } = parsed;
  const update = { ...values, active: values.active === "true", slug, prices };
  if (id) await Service.findOneAndUpdate({ _id: id, deletedAt: null }, update, { runValidators: true });
  else await Service.create(update);
  revalidatePath("/");
  revalidatePath("/services");
  revalidatePath("/admin/services");
}

export async function saveAddon(formData: FormData): Promise<void> {
  await requireOwner();
  const parsed = z.object({ id: z.string().optional(), name: z.string().trim().min(2).max(80), nameTa: z.string().trim().max(80), nameSi: z.string().trim().max(80), description: z.string().trim().max(500), descriptionTa: z.string().trim().max(500), descriptionSi: z.string().trim().max(500), durationMinutes: z.coerce.number().int().min(0).max(600), sortOrder: nonNegativeInt, active: z.enum(["true", "false"]) }).parse({
    id: text(formData.get("id")) || undefined, name: text(formData.get("name")), nameTa: text(formData.get("nameTa")), nameSi: text(formData.get("nameSi")), description: text(formData.get("description")), descriptionTa: text(formData.get("descriptionTa")), descriptionSi: text(formData.get("descriptionSi")), durationMinutes: text(formData.get("durationMinutes")) || "0", sortOrder: text(formData.get("sortOrder")) || "0", active: text(formData.get("active")) || "true",
  });
  const prices = await pricesFromForm(formData);
  const slug = await uniqueSlug(parsed.name, Addon, parsed.id ?? "");
  const { id, ...values } = parsed;
  const update = { ...values, active: values.active === "true", slug, prices };
  if (id) await Addon.findOneAndUpdate({ _id: id, deletedAt: null }, update, { runValidators: true });
  else await Addon.create(update);
  revalidatePath("/");
  revalidatePath("/services");
  revalidatePath("/admin/services");
}

export async function archiveCatalogItem(formData: FormData): Promise<void> {
  await requireOwner();
  const kind = z.enum(["service", "addon"]).parse(text(formData.get("kind")));
  const id = z.string().min(1).parse(text(formData.get("id")));
  const target = kind === "service" ? Service : Addon;
  await target.findByIdAndUpdate(id, { active: false, deletedAt: new Date() }, { runValidators: true });
  revalidatePath("/");
  revalidatePath("/services");
  revalidatePath("/admin/services");
}

export async function saveVehicleType(formData: FormData): Promise<void> {
  await requireOwner();
  const parsed = z.object({ id: z.string().optional(), name: z.string().trim().min(2).max(40), sortOrder: nonNegativeInt, active: z.enum(["true", "false"]) }).parse({
    id: text(formData.get("id")) || undefined, name: text(formData.get("name")), sortOrder: text(formData.get("sortOrder")) || "0", active: text(formData.get("active")) || "true",
  });
  const slug = slugify(parsed.name);
  if (!slug) throw new Error("Use a vehicle type name with letters or numbers");
  const conflict = await VehicleType.findOne({ slug, ...(parsed.id ? { _id: { $ne: parsed.id } } : {}) }).select("_id").lean();
  if (conflict) throw new Error("A vehicle type with that name already exists");
  const { id, ...values } = parsed;
  const update = { ...values, active: values.active === "true", slug };
  if (id) await VehicleType.findByIdAndUpdate(id, update, { runValidators: true });
  else await VehicleType.create(update);
  revalidatePath("/");
  revalidatePath("/services");
  revalidatePath("/admin/services");
}
