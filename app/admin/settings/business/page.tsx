import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { saveContactSettings } from "@/app/actions/business";
import { AdminNavigation } from "@/components/AdminNavigation";
import { connectToDatabase } from "@/lib/db";
import { BusinessSettings } from "@/models/BusinessSettings";

export default async function BusinessSettingsPage() {
  const session = await auth();
  if (session?.user?.role !== "owner") redirect("/admin/login");
  let phone = "";
  let whatsappNumber = "";
  if (process.env.MONGODB_URI) {
    await connectToDatabase();
    const settings = await BusinessSettings.findOne({ key: "default" }).lean() as unknown as { phone?: string; whatsappNumber?: string } | null;
    phone = settings?.phone ?? "";
    whatsappNumber = settings?.whatsappNumber ?? "";
  }
  return <main className="admin-shell"><AdminNavigation active="business" /><div className="page-heading"><span className="eyebrow">BUSINESS SETTINGS</span><h1>Contact details.</h1><p>Your WhatsApp number receives customer booking requests.</p></div><form action={saveContactSettings} className="business-settings-card"><label>Business phone (optional)<input name="phone" type="tel" autoComplete="tel" defaultValue={phone} placeholder="+94 77 123 4567" /></label><label>WhatsApp number<input name="whatsappNumber" type="tel" autoComplete="tel" defaultValue={whatsappNumber} placeholder="+94 77 123 4567" /><small>Include the country code. A Sri Lankan mobile number beginning with 07 is also accepted.</small></label><p className="business-settings-hint">Customers will see a prefilled booking summary and can send it to this number after their booking is saved.</p><button className="button" type="submit">Save contact details</button></form></main>;
}
