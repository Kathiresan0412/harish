import { whatsappDigits } from "@/lib/public-safety";

export type WhatsAppBooking = {
  reference: string;
  customer: { name: string; phone: string };
  vehicleTypeName: string;
  vehicleNumber: string;
  items: Array<{ name: string }>;
  date: Date | string;
  startTime: string;
  totalPrice: number;
};

function lkr(amount: number) {
  return new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 2 }).format(amount / 100);
}

export function bookingWhatsAppLink(booking: WhatsAppBooking, kind: "confirmed" | "cancelled" | "reminder", timezone: string) {
  const phone = whatsappDigits(booking.customer.phone);
  if (!phone) return null;
  const day = booking.date instanceof Date ? booking.date.toISOString().slice(0, 10) : String(booking.date).slice(0, 10);
  const lines: Record<typeof kind, string[]> = {
    confirmed: [`Hi ${booking.customer.name}, your car wash booking ${booking.reference} is confirmed.`, `Date: ${day} at ${booking.startTime} (${timezone})`, `Vehicle: ${booking.vehicleTypeName}${booking.vehicleNumber ? ` · ${booking.vehicleNumber}` : ""}`, `Services: ${booking.items.map((item) => item.name).join(", ")}`, `Estimated total: ${lkr(booking.totalPrice)}`, "Reply here if you need help."],
    cancelled: [`Hi ${booking.customer.name}, your car wash booking ${booking.reference} has been cancelled.`, `It was scheduled for ${day} at ${booking.startTime}.`, "Reply here if you would like to choose another time."],
    reminder: [`Hi ${booking.customer.name}, a friendly reminder about your car wash booking ${booking.reference}.`, `Date: ${day} at ${booking.startTime} (${timezone})`, `Vehicle: ${booking.vehicleTypeName}${booking.vehicleNumber ? ` · ${booking.vehicleNumber}` : ""}`, "We look forward to seeing you."],
  };
  return `https://wa.me/${phone}?text=${encodeURIComponent(lines[kind].join("\n"))}`;
}
