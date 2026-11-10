import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";

export default async function AdminPage() {
  const session = await auth();
  if (session?.user?.role !== "owner") redirect("/admin/login");
  return <main className="admin-shell"><div className="admin-top"><div><span className="eyebrow">OWNER PORTAL</span><h1>Good to see you.</h1></div><form action={async () => { "use server"; await signOut({ redirectTo: "/admin/login" }); }}><button className="quiet-button">Sign out</button></form></div><section className="welcome-panel"><div className="panel-icon">✦</div><div><span className="eyebrow">PHASE 1 · BRANDING & SETUP</span><h2>Your shop, your look.</h2><p>Manage your business name, logo, and colors in one place. Booking and services tools arrive in the next phase.</p><a className="button" href="/admin/settings/branding">Set up your brand</a></div></section><div className="stat-grid"><article><span>BOOKINGS TODAY</span><strong>—</strong><small>Booking tools coming soon</small></article><article><span>MONTHLY INCOME</span><strong>—</strong><small>Reports coming soon</small></article><article><span>BRAND STATUS</span><strong className="status-ready">Ready to personalize</strong><small>Theme settings are active</small></article></div></main>;
}
