import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db";
import { defaultTheme } from "@/lib/theme";
import { ThemeSettings } from "@/models/ThemeSettings";
import { BrandingEditor } from "@/components/BrandingEditor";

export default async function BrandingPage() {
  const session = await auth();
  if (session?.user?.role !== "owner") redirect("/admin/login");
  let initial = defaultTheme;
  if (process.env.MONGODB_URI) {
    await connectToDatabase();
    const saved = await ThemeSettings.findOne({ key: "default" }).lean();
    if (saved) initial = JSON.parse(JSON.stringify(saved));
  }
  return <main className="admin-shell"><a className="back-link" href="/admin">← Dashboard</a><div className="page-heading"><span className="eyebrow">BRAND SETTINGS</span><h1>Make it yours.</h1><p>Your colors and business identity update across the whole site.</p></div><BrandingEditor initial={initial} /></main>;
}
