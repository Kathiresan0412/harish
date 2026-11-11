import { whatsappDigits } from "@/lib/public-safety";

type ReminderBooking = { reference: string; customer: { name: string; phone: string }; date: string; startTime: string };

export function reminderIntegrationStatus() {
  return { configured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_API_VERSION && process.env.WHATSAPP_REMINDER_TEMPLATE) };
}

export async function sendBookingReminder(booking: ReminderBooking) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.WHATSAPP_API_VERSION;
  const template = process.env.WHATSAPP_REMINDER_TEMPLATE;
  const recipient = whatsappDigits(booking.customer.phone);
  if (!token || !phoneNumberId || !apiVersion || !template || !recipient) throw new Error("WhatsApp reminder integration is not configured");
  const response = await fetch(`https://graph.facebook.com/${encodeURIComponent(apiVersion)}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: recipient, type: "template", template: { name: template, language: { code: process.env.WHATSAPP_REMINDER_LANGUAGE ?? "en" }, components: [{ type: "body", parameters: [{ type: "text", text: booking.customer.name }, { type: "text", text: booking.date }, { type: "text", text: booking.startTime }, { type: "text", text: booking.reference }] }] } }),
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`WhatsApp API returned HTTP ${response.status}`);
  return await response.json() as { messages?: Array<{ id?: string }> };
}
