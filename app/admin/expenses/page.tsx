import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminNavigation } from "@/components/AdminNavigation";
import { createExpense, deleteExpense } from "@/app/actions/operations";
import { connectToDatabase } from "@/lib/db";
import { AvailabilitySettings, Expense } from "@/models/Operations";
import { localDateKey } from "@/lib/slots";

export const dynamic = "force-dynamic";
const categories = ["water", "chemicals", "electricity", "maintenance", "other"];
const money = (value: number) => new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 2 }).format(value / 100);

export default async function ExpensesPage() {
  const session = await auth();
  if (session?.user?.role !== "owner") redirect("/admin/login");
  let expenses: Array<{ id: string; description: string; category: string; amount: number; date: string; note: string }> = [];
  let timezone = "Asia/Colombo";
  if (process.env.MONGODB_URI) {
    await connectToDatabase();
    const [rows, settings] = await Promise.all([Expense.find().sort({ date: -1, createdAt: -1 }).limit(100).lean(), AvailabilitySettings.findOne({ key: "default" }).select("timezone").lean()]);
    timezone = (settings as { timezone?: string } | null)?.timezone ?? timezone;
    expenses = (rows as unknown as Array<{ _id: unknown; description: string; category: string; amount: number; date: Date; note: string }>).map((row) => ({ id: String(row._id), description: row.description, category: row.category, amount: row.amount, date: row.date.toISOString().slice(0, 10), note: row.note }));
  }
  const today = localDateKey(new Date(), timezone);
  return <main className="admin-shell"><AdminNavigation active="expenses" /><div className="admin-top operations-heading"><div><span className="eyebrow">OWNER PORTAL · BUSINESS COSTS</span><h1>Expenses.</h1><p>Log operating costs so your reports show what the business keeps.</p></div></div>{!process.env.MONGODB_URI ? <section className="bookings-empty"><h2>Connect your database</h2><p>Set MONGODB_URI to record expenses.</p></section> : <><form className="expense-form settings-card" action={createExpense}><h2>Add an expense</h2><div className="expense-form-grid"><label>Description<input name="description" required minLength={2} maxLength={120} placeholder="Water bill" /></label><label>Category<select name="category" defaultValue="other">{categories.map((category) => <option key={category} value={category}>{category[0]!.toUpperCase() + category.slice(1)}</option>)}</select></label><label>Amount (LKR)<input name="amount" type="number" min="0.01" step="0.01" required /></label><label>Date<input name="date" type="date" defaultValue={today} required /></label><label className="expense-note-field">Note<input name="note" maxLength={300} placeholder="Optional details" /></label></div><button className="button" type="submit">Save expense</button></form><section className="expense-history settings-card"><div className="operations-section-heading"><div><span className="eyebrow">RECENT RECORDS</span><h2>Expense history</h2></div><a href="/admin/reports">View profit reports</a></div>{expenses.length ? <div className="operations-table-wrap"><table className="operations-table"><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th>Action</th></tr></thead><tbody>{expenses.map((expense) => <tr key={expense.id}><td>{expense.date}</td><td><strong>{expense.description}</strong>{expense.note && <small>{expense.note}</small>}</td><td>{expense.category}</td><td>{money(expense.amount)}</td><td><form action={deleteExpense}><input type="hidden" name="id" value={expense.id} /><button className="quiet-button danger-button" type="submit">Delete</button></form></td></tr>)}</tbody></table></div> : <p className="operations-empty">No expenses recorded yet.</p>}</section></>}</main>;
}
