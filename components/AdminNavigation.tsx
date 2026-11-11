import { CalendarDays, CarFront, Clock3, LayoutDashboard, LogOut, Settings2, Sparkles, Phone, Users, ReceiptText, ChartNoAxesCombined } from "lucide-react";
import { signOut } from "@/auth";

export function AdminNavigation({ active }: { active: "dashboard" | "bookings" | "branding" | "business" | "services" | "availability" | "expenses" | "customers" | "reports" }) {
  return <div className="admin-navigation-wrap">
    <nav className="admin-navigation" aria-label="Owner navigation">
      <div className="admin-nav-links">
        <a className={`admin-nav-link ${active === "dashboard" ? "active" : ""}`} href="/admin" aria-current={active === "dashboard" ? "page" : undefined}>
          <LayoutDashboard size={16} /> <span>Dashboard</span>
        </a>
        <a className={`admin-nav-link ${active === "bookings" ? "active" : ""}`} href="/admin/bookings" aria-current={active === "bookings" ? "page" : undefined}>
          <CalendarDays size={16} /> <span>Bookings</span>
        </a>
        <a className={`admin-nav-link ${active === "services" ? "active" : ""}`} href="/admin/services" aria-current={active === "services" ? "page" : undefined}>
          <CarFront size={16} /> <span>Services</span>
        </a>
        <a className={`admin-nav-link ${active === "availability" ? "active" : ""}`} href="/admin/availability" aria-current={active === "availability" ? "page" : undefined}>
          <Clock3 size={16} /> <span>Availability</span>
        </a>
        <a className={`admin-nav-link ${active === "customers" ? "active" : ""}`} href="/admin/customers" aria-current={active === "customers" ? "page" : undefined}><Users size={16} /> <span>Customers</span></a>
        <a className={`admin-nav-link ${active === "expenses" ? "active" : ""}`} href="/admin/expenses" aria-current={active === "expenses" ? "page" : undefined}><ReceiptText size={16} /> <span>Expenses</span></a>
        <a className={`admin-nav-link ${active === "reports" ? "active" : ""}`} href="/admin/reports" aria-current={active === "reports" ? "page" : undefined}><ChartNoAxesCombined size={16} /> <span>Reports</span></a>
        <span className="admin-nav-divider" aria-hidden="true" />
        <span className="admin-nav-section"><Settings2 size={15} /> Settings</span>
        <a className={`admin-nav-link brand-nav-link ${active === "branding" ? "active" : ""}`} href="/admin/settings/branding" aria-current={active === "branding" ? "page" : undefined}>
          <Sparkles size={16} /><span>Set up your brand</span>
        </a>
        <a className={`admin-nav-link brand-nav-link ${active === "business" ? "active" : ""}`} href="/admin/settings/business" aria-current={active === "business" ? "page" : undefined}>
          <Phone size={15} /><span>Contact details</span>
        </a>
      </div>
      <form action={async () => { "use server"; await signOut({ redirectTo: "/admin/login" }); }}>
        <button className="admin-nav-logout" type="submit"><LogOut size={15} /><span>Sign out</span></button>
      </form>
    </nav>
  </div>;
}
