import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db";
import { AvailabilitySettings, Expense, Payment } from "@/models/Operations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const validDate = (value: string | null) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value);
const csv = (value: unknown) => {
  let text = String(value ?? "");
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};
function zonedMidnight(value: string, timezone: string) {
  const guess = new Date(`${value}T00:00:00.000Z`);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(guess);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? 0);
  const represented = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
  return new Date(guess.getTime() - (represented - guess.getTime()));
}

export async function GET(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "owner") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  if (!validDate(start) || !validDate(end) || start! > end!) return NextResponse.json({ error: "Choose a valid report range." }, { status: 400 });
  const dateStart = new Date(`${start}T00:00:00.000Z`);
  const dateEnd = new Date(`${end}T00:00:00.000Z`);
  dateEnd.setUTCDate(dateEnd.getUTCDate() + 1);
  if ((dateEnd.getTime() - dateStart.getTime()) / 86_400_000 > 366) return NextResponse.json({ error: "The export range cannot exceed one year." }, { status: 400 });
  await connectToDatabase();
  const settings = await AvailabilitySettings.findOne({ key: "default" }).select("timezone").lean() as unknown as { timezone?: string } | null;
  const timezone = settings?.timezone ?? "Asia/Colombo";
  const paymentStart = zonedMidnight(start!, timezone);
  const endKey = new Date(`${end}T00:00:00.000Z`);
  endKey.setUTCDate(endKey.getUTCDate() + 1);
  const paymentEnd = zonedMidnight(endKey.toISOString().slice(0, 10), timezone);
  const [payments, expenses] = await Promise.all([
    Payment.aggregate([{ $match: { paidAt: { $gte: paymentStart, $lt: paymentEnd } } }, { $lookup: { from: "bookings", localField: "booking", foreignField: "_id", as: "booking" } }, { $unwind: { path: "$booking", preserveNullAndEmptyArrays: true } }, { $sort: { paidAt: 1 } }]),
    Expense.find({ date: { $gte: dateStart, $lt: dateEnd } }).sort({ date: 1 }).lean(),
  ]);
  const lines = [["type", "date", "reference_or_description", "customer_or_category", "method_or_note", "amount_lkr"].map(csv).join(",")];
  for (const payment of payments as Array<{ paidAt: Date; booking?: { reference?: string; customer?: { name?: string } }; method: string; note?: string; amount: number }>) lines.push(["payment", payment.paidAt.toISOString(), payment.booking?.reference ?? "", payment.booking?.customer?.name ?? "", [payment.method, payment.note].filter(Boolean).join(" · "), (payment.amount / 100).toFixed(2)].map(csv).join(","));
  for (const expense of expenses as unknown as Array<{ date: Date; description: string; category: string; note: string; amount: number }>) lines.push(["expense", expense.date.toISOString().slice(0, 10), expense.description, expense.category, expense.note, (expense.amount / 100).toFixed(2)].map(csv).join(","));
  const filename = `harbor-auto-spa-report-${start}-to-${end}.csv`;
  return new NextResponse(`\uFEFF${lines.join("\r\n")}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store" } });
}
