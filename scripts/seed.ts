import "dotenv/config";
import { hash } from "bcryptjs";
import { connectToDatabase } from "../lib/db";
import { User } from "../models/User";
import { ThemeSettings } from "../models/ThemeSettings";
import { BusinessSettings } from "../models/BusinessSettings";
import { AvailabilitySettings } from "../models/Operations";
import { Service, VehicleType } from "../models/catalog";
import { defaultTheme } from "../lib/theme";

async function seed() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required");
  if (password.length < 12) throw new Error("SEED_ADMIN_PASSWORD must be at least 12 characters");
  await connectToDatabase();
  await User.findOneAndUpdate({ email }, { $setOnInsert: { email, name: "Business Owner", passwordHash: await hash(password, 12), role: "owner", active: true } }, { upsert: true, new: true, runValidators: true });
  await ThemeSettings.findOneAndUpdate({ key: "default" }, { $setOnInsert: defaultTheme }, { upsert: true, runValidators: true });
  await BusinessSettings.findOneAndUpdate({ key: "default" }, { $setOnInsert: { key: "default", currency: "LKR", timezone: "Asia/Colombo" } }, { upsert: true, runValidators: true });
  const vehicleDefinitions = [{ name: "Car", slug: "car" }, { name: "SUV / Van", slug: "suv-van" }, { name: "Bike", slug: "bike" }, { name: "Bus / Lorry", slug: "bus-lorry" }];
  for (const vehicle of vehicleDefinitions) await VehicleType.findOneAndUpdate({ slug: vehicle.slug }, { $setOnInsert: vehicle }, { upsert: true, runValidators: true });
  const vehicleTypes = await VehicleType.find({ slug: { $in: vehicleDefinitions.map((vehicle) => vehicle.slug) } }).lean();
  const samples = [
    { name: "Exterior Hand Wash", slug: "exterior-hand-wash", description: "A careful exterior wash and hand dry.", durationMinutes: 40, basePrice: 150000 },
    { name: "Full Wash", slug: "full-wash", description: "Exterior wash with a tidy interior refresh.", durationMinutes: 60, basePrice: 250000 },
    { name: "Interior Refresh", slug: "interior-refresh", description: "Vacuum and wipe-down for a fresher cabin.", durationMinutes: 45, basePrice: 180000 },
    { name: "Premium Detail", slug: "premium-detail", description: "A deeper clean with extra attention to detail.", durationMinutes: 120, basePrice: 600000 },
    { name: "Wax & Shine", slug: "wax-and-shine", description: "Protective wax for a smooth, glossy finish.", durationMinutes: 60, basePrice: 350000 },
  ];
  for (const service of samples) {
    const prices = vehicleTypes.map((vehicle, index) => ({ vehicleType: vehicle._id, amount: service.basePrice * [1, 1.4, 0.65, 2.2][index]! }));
    await Service.findOneAndUpdate({ slug: service.slug }, { $setOnInsert: { ...service, prices } }, { upsert: true, runValidators: true });
  }
  await AvailabilitySettings.findOneAndUpdate({ key: "default" }, { $setOnInsert: { key: "default", timezone: "Asia/Colombo", weeklyHours: [1, 2, 3, 4, 5, 6].map((day) => ({ day, open: true, start: "08:00", end: "17:00" })).concat([{ day: 0, open: false, start: "08:00", end: "17:00" }]), slotIntervalMinutes: 30, bufferMinutes: 0, capacity: 1, minimumNoticeMinutes: 120, maximumAdvanceDays: 30, pendingHoldMinutes: 120, autoReleasePending: true } }, { upsert: true, runValidators: true });
  console.log(`Seed complete for owner ${email}`);
  process.exit(0);
}

seed().catch((error) => { console.error(error); process.exit(1); });
