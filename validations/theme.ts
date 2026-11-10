import { z } from "zod";

const color = z.string().regex(/^#[\da-fA-F]{6}$/);
export const themeInputSchema = z.object({
  businessName: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(160).default(""),
  logoUrl: z.string().url().or(z.literal("")).default(""),
  faviconUrl: z.string().url().or(z.literal("")).default(""),
  heroImageUrl: z.string().url().or(z.literal("")).default(""),
  preset: z.enum(["ocean", "green", "sunset", "dark", "gold", "custom"]),
  colors: z.object({ primary: color, secondary: color, accent: color, background: color, foreground: color, button: color }),
  font: z.enum(["sans", "serif", "mono"]),
  buttonStyle: z.enum(["rounded", "square"]),
});
