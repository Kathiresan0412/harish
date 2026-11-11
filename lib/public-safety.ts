import { createHash } from "node:crypto";
import { RateLimit } from "@/models/Operations";

export function normalizePhone(input: string) {
  let value = input.trim().replace(/[\s().-]/g, "");
  if (/^0\d{9}$/.test(value)) value = `+94${value.slice(1)}`;
  else if (value.startsWith("00")) value = `+${value.slice(2)}`;
  if (!/^\+[1-9]\d{7,14}$/.test(value)) return null;
  return value;
}

export function whatsappDigits(input: string) {
  const normalized = normalizePhone(input);
  return normalized?.replace(/\D/g, "") ?? null;
}

export function bookingReferenceMessage(value: string) {
  return value.trim().toUpperCase();
}

export async function allowPublicRequest(request: Request, scope: string, limit: number, windowMs = 15 * 60_000) {
  const forwarded = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipHash = createHash("sha256").update(forwarded).digest("hex").slice(0, 40);
  const now = Date.now();
  const windowId = Math.floor(now / windowMs);
  const expiresAt = new Date((windowId + 1) * windowMs + 60_000);
  const key = `${scope}:${ipHash}:${windowId}`;
  try {
    const record = await RateLimit.findOneAndUpdate({ key }, { $inc: { count: 1 }, $setOnInsert: { expiresAt } }, { upsert: true, new: true, setDefaultsOnInsert: true }).select("count").lean() as unknown as { count?: number } | null;
    return (record?.count ?? limit + 1) <= limit;
  } catch (error) {
    if ((error as { code?: number })?.code !== 11000) throw error;
    const record = await RateLimit.findOneAndUpdate({ key }, { $inc: { count: 1 } }, { new: true }).select("count").lean() as unknown as { count?: number } | null;
    return (record?.count ?? limit + 1) <= limit;
  }
}
