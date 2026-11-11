import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Phone, Sparkles } from "lucide-react";
import { auth } from "@/auth";
import { AdminNavigation } from "@/components/AdminNavigation";

export default async function SettingsPage() {
  const session = await auth();
  if (session?.user?.role !== "owner") redirect("/admin/login");

  return <main className="admin-shell">
    <AdminNavigation active="settings" />
    <div className="page-heading"><span className="eyebrow">ADMIN SETTINGS</span><h1>Settings.</h1><p>Manage your business contact details and brand identity.</p></div>
    <div className="settings-overview-grid">
      <Link className="settings-overview-card" href="/admin/settings/business">
        <span className="settings-overview-icon"><Phone size={18} /></span>
        <span><strong>Contact details</strong><small>Business phone and WhatsApp number</small></span>
        <ArrowRight size={16} />
      </Link>
      <Link className="settings-overview-card" href="/admin/settings/branding">
        <span className="settings-overview-icon"><Sparkles size={18} /></span>
        <span><strong>Set up your brand</strong><small>Business identity, colors, and appearance</small></span>
        <ArrowRight size={16} />
      </Link>
    </div>
  </main>;
}
