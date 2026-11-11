"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db";
import { normalizePhone } from "@/lib/public-safety";
import { BusinessSettings } from "@/models/BusinessSettings";

export async function saveContactSettings(formData: FormData): Promise<void> {
  const session = await auth();
  if (session?.user?.role !== "owner") throw new Error("Unauthorized");
  const values = z.object({ phone: z.string().trim().max(24), whatsappNumber: z.string().trim().max(24) }).parse({ phone: formData.get("phone"), whatsappNumber: formData.get("whatsappNumber") });
  const phone = values.phone ? normalizePhone(values.phone) : "";
  const whatsappNumber = values.whatsappNumber ? normalizePhone(values.whatsappNumber) : "";
  if (values.phone && !phone) throw new Error("Enter the phone number with country code, or a Sri Lankan mobile number.");
  if (values.whatsappNumber && !whatsappNumber) throw new Error("Enter a valid WhatsApp number with country code, or a Sri Lankan mobile number.");
  await connectToDatabase();
  await BusinessSettings.findOneAndUpdate({ key: "default" }, { key: "default", phone, whatsappNumber }, { upsert: true, runValidators: true, setDefaultsOnInsert: true });
  revalidatePath("/");
  revalidatePath("/book");
  revalidatePath("/admin/settings/business");
}
