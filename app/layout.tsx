import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db";
import { defaultTheme, themeStyle } from "@/lib/theme";
import { ThemeSettings } from "@/models/ThemeSettings";
import "./globals.css";

export const metadata: Metadata = { title: "Harbor Auto Spa | Car care, made easy", description: "Thoughtful car wash and detailing, right at home." };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let theme = defaultTheme;
  if (process.env.MONGODB_URI) {
    try {
      await connectToDatabase();
      const saved = await ThemeSettings.findOne({ key: "default" }).lean();
      if (saved) theme = { ...defaultTheme, ...JSON.parse(JSON.stringify(saved)) };
    } catch { /* Keep the public shell available while the database is unavailable. */ }
  }
  const fontFamily = theme.font === "serif" ? "Georgia, serif" : theme.font === "mono" ? "ui-monospace, monospace" : "Arial, sans-serif";
  return <html lang="en"><body style={{ ...themeStyle(theme.colors), fontFamily }} data-button-style={theme.buttonStyle} data-font={theme.font}>{children}</body></html>;
}
