import { CalendarDays, CarFront, Clock3, LayoutDashboard, LogOut, Settings2, Users, ReceiptText, ChartNoAxesCombined } from "lucide-react";
import { signOut } from "@/auth";

export function AdminNavigation({ active }: { active: "dashboard" | "bookings" | "branding" | "business" | "settings" | "services" | "availability" | "expenses" | "customers" | "reports" }) {
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
        <a className={`admin-nav-link ${active === "settings" || active === "branding" || active === "business" ? "active" : ""}`} href="/admin/settings" aria-current={active === "settings" || active === "branding" || active === "business" ? "page" : undefined}>
          <Settings2 size={16} /><span>Settings</span>
        </a>
      </div>
      <form action={async () => { "use server"; await signOut({ redirectTo: "/admin/login" }); }}>
        <button className="admin-nav-logout" type="submit"><LogOut size={15} /><span>Sign out</span></button>
      </form>
    </nav>
  </div>;
}
