import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminNavigation } from "@/components/AdminNavigation";
import { AvailabilityEditor } from "@/components/AvailabilityEditor";
import { defaultAvailability } from "@/lib/availability-defaults";
import { connectToDatabase } from "@/lib/db";
import { localDateKey } from "@/lib/slots";
import { AvailabilitySettings, BlockedSlot } from "@/models/Operations";

export default async function AvailabilityAdminPage() {
  const session = await auth();
  if (session?.user?.role !== "owner") redirect("/admin/login");
  let settings = defaultAvailability;
  let blocks: Array<{ id: string; dateKey: string; startTime: string; endTime: string; allDay: boolean; reason: string }> = [];
  if (process.env.MONGODB_URI) {
    await connectToDatabase();
    const saved = await AvailabilitySettings.findOne({ key: "default" }).lean();
    if (saved) settings = { ...defaultAvailability, ...JSON.parse(JSON.stringify(saved)) };
    const savedToday = localDateKey(new Date(), settings.timezone);
    const blocked = await BlockedSlot.find({ date: { $gte: new Date(`${savedToday}T00:00:00.000Z`) } }).sort({ date: 1, startTime: 1 }).lean();
    blocks = blocked.map((block) => ({ id: String(block._id), dateKey: block.date.toISOString().slice(0, 10), startTime: block.startTime, endTime: block.endTime, allDay: block.allDay, reason: block.reason }));
  }
  const today = localDateKey(new Date(), settings.timezone);
  return <main className="admin-shell"><AdminNavigation active="availability" /><div className="page-heading"><span className="eyebrow">SCHEDULE & CAPACITY</span><h1>Set your availability.</h1><p>Choose your working hours, job spacing, and dates you’re unavailable.</p></div><AvailabilityEditor initial={JSON.parse(JSON.stringify(settings))} blocks={blocks} today={today} /></main>;
}
