import { redirect } from "next/navigation";
import { ArrowDownToLine, ChartNoAxesCombined } from "lucide-react";
import { auth } from "@/auth";
import { AdminNavigation } from "@/components/AdminNavigation";
import { connectToDatabase } from "@/lib/db";
import { localDateKey } from "@/lib/slots";
import { AvailabilitySettings, Expense, Payment } from "@/models/Operations";

export const dynamic = "force-dynamic";
const monthValid = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const money = (value: number) => new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 2 }).format(value / 100);
const dateAtUtc = (year: number, month: number) => new Date(Date.UTC(year, month, 1));

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "owner") redirect("/admin/login");
  const params = await searchParams;
  let timezone = "Asia/Colombo";
  let month = params.month && monthValid(params.month) ? params.month : "";
  let rows: Array<{ month: string; income: number; expenses: number }> = [];
  let expensesByCategory: Array<{ category: string; amount: number }> = [];
  if (process.env.MONGODB_URI) {
    await connectToDatabase();
    const settings = await AvailabilitySettings.findOne({ key: "default" }).select("timezone").lean() as unknown as { timezone?: string } | null;
    timezone = settings?.timezone ?? timezone;
    if (!month) month = localDateKey(new Date(), timezone).slice(0, 7);
    const [year, monthNumber] = month.split("-").map(Number);
    const windowStart = dateAtUtc(year!, monthNumber! - 12);
    const windowEnd = dateAtUtc(year!, monthNumber!);
    windowStart.setUTCDate(windowStart.getUTCDate() - 2);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + 2);
    const [incomeGroups, expenseGroups, categoryGroups] = await Promise.all([
      Payment.aggregate([{ $match: { paidAt: { $gte: windowStart, $lt: windowEnd } } }, { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$paidAt", timezone } }, amount: { $sum: "$amount" } } }, { $sort: { _id: -1 } }]),
      Expense.aggregate([{ $match: { date: { $gte: windowStart, $lt: windowEnd } } }, { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$date", timezone: "UTC" } }, amount: { $sum: "$amount" } } }, { $sort: { _id: -1 } }]),
      Expense.aggregate([{ $match: { $expr: { $eq: [{ $dateToString: { format: "%Y-%m", date: "$date", timezone: "UTC" } }, month] } } }, { $group: { _id: "$category", amount: { $sum: "$amount" } } }, { $sort: { amount: -1 } }]),
    ]);
    const incomeMap = new Map(incomeGroups.map((row: { _id: string; amount: number }) => [row._id, Number(row.amount)]));
    const expenseMap = new Map(expenseGroups.map((row: { _id: string; amount: number }) => [row._id, Number(row.amount)]));
    rows = Array.from({ length: 12 }, (_, index) => {
      const date = dateAtUtc(year!, monthNumber! - 12 + index);
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      return { month: key, income: incomeMap.get(key) ?? 0, expenses: expenseMap.get(key) ?? 0 };
    });
    expensesByCategory = categoryGroups.map((row: { _id: string; amount: number }) => ({ category: row._id, amount: Number(row.amount) }));
  }
  const selected = rows.find((row) => row.month === month) ?? { month, income: 0, expenses: 0 };
  const profit = selected.income - selected.expenses;
  const exportHref = `/api/admin/reports/export?start=${month}-01&end=${month}-${String(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate()).padStart(2, "0")}`;
  return <main className="admin-shell"><AdminNavigation active="reports" /><div className="admin-top operations-heading"><div><span className="eyebrow">OWNER PORTAL · FINANCIAL SUMMARY</span><h1>Reports.</h1><p>Compare payments received with logged expenses to track operating profit.</p></div><a className="button" href={exportHref}><ArrowDownToLine size={15} /> Export CSV</a></div>{!process.env.MONGODB_URI ? <section className="bookings-empty"><h2>Connect your database</h2></section> : <><form className="report-month-form" action="/admin/reports"><label>Report month<input type="month" name="month" defaultValue={month} /></label><button className="quiet-button" type="submit">View report</button></form><section className="report-stat-grid"><article><span>PAYMENTS RECEIVED</span><strong>{money(selected.income)}</strong><small>Recorded against bookings</small></article><article><span>OPERATING EXPENSES</span><strong>{money(selected.expenses)}</strong><small>Expenses entered for this month</small></article><article className={profit < 0 ? "negative-profit" : "positive-profit"}><span>NET OPERATING PROFIT</span><strong>{money(profit)}</strong><small>Income minus recorded expenses</small></article></section><section className="settings-card report-history"><div className="operations-section-heading"><div><span className="eyebrow">LAST 12 MONTHS</span><h2>Monthly performance</h2></div><span className="report-definition"><ChartNoAxesCombined size={14} /> Cash received less logged expenses</span></div><div className="operations-table-wrap"><table className="operations-table"><thead><tr><th>Month</th><th>Payments received</th><th>Expenses</th><th>Net profit</th></tr></thead><tbody>{rows.slice().reverse().map((row) => <tr key={row.month}><td><a href={`/admin/reports?month=${row.month}`}>{row.month}</a></td><td>{money(row.income)}</td><td>{money(row.expenses)}</td><td className={row.income - row.expenses < 0 ? "negative-profit" : "positive-profit"}>{money(row.income - row.expenses)}</td></tr>)}</tbody></table></div></section><section className="settings-card report-category"><div className="operations-section-heading"><div><span className="eyebrow">SELECTED MONTH</span><h2>Expenses by category</h2></div><a href="/admin/expenses">Manage expenses</a></div>{expensesByCategory.length ? expensesByCategory.map((row) => <div className="report-category-row" key={row.category}><span>{row.category}</span><strong>{money(row.amount)}</strong></div>) : <p className="operations-empty">No expenses recorded for {month}.</p>}</section><p className="report-note">This is a cash basis summary: it counts payments recorded during the month, less expenses dated in that month. It does not include unpaid booking value, tax, refunds, or owner drawings.</p></>}</main>;
}
