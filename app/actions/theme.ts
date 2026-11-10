"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db";
import { ThemeSettings } from "@/models/ThemeSettings";
import { themeInputSchema } from "@/validations/theme";

export async function saveTheme(input: unknown) {
  const session = await auth();
  if (session?.user?.role !== "owner") throw new Error("Unauthorized");
  const values = themeInputSchema.parse(input);
  await connectToDatabase();
  await ThemeSettings.findOneAndUpdate({ key: "default" }, values, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
  revalidatePath("/");
  revalidatePath("/admin/settings/branding");
  return { success: true };
}
