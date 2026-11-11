"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db";
import { AuditLog, Customer, Expense } from "@/models/Operations";

async function requireOwner() {
  const session = await auth();
  if (session?.user?.role !== "owner") throw new Error("Unauthorized");
  await connectToDatabase();
  return session;
}

const refresh = () => { revalidatePath("/admin"); revalidatePath("/admin/expenses"); revalidatePath("/admin/reports"); revalidatePath("/admin/customers"); };

export async function createExpense(formData: FormData) {
  const session = await requireOwner();
  const values = z.object({ description: z.string().trim().min(2).max(120), category: z.enum(["water", "chemicals", "electricity", "maintenance", "other"]), amount: z.coerce.number().positive().max(100_000_000), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), note: z.string().trim().max(300) }).parse(Object.fromEntries(formData));
  const date = new Date(`${values.date}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== values.date) throw new Error("Choose a valid expense date");
  const [expense] = await Expense.create([{ ...values, amount: Math.round(values.amount * 100), date }]);
  await AuditLog.create({ actor: session.user?.id, action: "expense_created", entity: "Expense", entityId: String(expense!._id) });
  refresh();
}

export async function deleteExpense(formData: FormData) {
  const session = await requireOwner();
  const id = z.string().regex(/^[a-f\d]{24}$/i).parse(formData.get("id"));
  const deleted = await Expense.findByIdAndDelete(id);
  if (!deleted) throw new Error("Expense not found");
  await AuditLog.create({ actor: session.user?.id, action: "expense_deleted", entity: "Expense", entityId: id });
  refresh();
}

export async function saveCustomerNotes(formData: FormData) {
  const session = await requireOwner();
  const values = z.object({ name: z.string().trim().min(2).max(80), phone: z.string().trim().min(8).max(24), notes: z.string().trim().max(1000) }).parse({ name: formData.get("name"), phone: formData.get("phone"), notes: formData.get("notes") });
  const customer = await Customer.findOneAndUpdate({ phone: values.phone }, { $set: { name: values.name, notes: values.notes } }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
  await AuditLog.create({ actor: session.user?.id, action: "customer_notes_updated", entity: "Customer", entityId: String(customer!._id) });
  refresh();
}
