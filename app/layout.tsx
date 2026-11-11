import type { Metadata } from "next";
import { cache } from "react";
import { connectToDatabase } from "@/lib/db";
import { defaultTheme, themeStyle, type ThemeColors } from "@/lib/theme";
import { ThemeSettings } from "@/models/ThemeSettings";
import { LanguageProvider } from "@/components/LanguageProvider";
import "./globals.css";

type Theme = {
  businessName: string;
  tagline: string;
  logoUrl: string;
  colors: ThemeColors;
  font: "sans" | "serif" | "mono";
  buttonStyle: "rounded" | "square";
};

const getSiteTheme = cache(async () => {
  let theme: Theme = defaultTheme;
  if (process.env.MONGODB_URI) {
    try {
      await connectToDatabase();
      const saved = await ThemeSettings.findOne({ key: "default" }).lean();
      if (saved) theme = { ...defaultTheme, ...JSON.parse(JSON.stringify(saved)) };
    } catch { /* Fall back to the default public identity while the database is unavailable. */ }
  }
  return theme;
});

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getSiteTheme();
  const base = process.env.NEXT_PUBLIC_APP_URL;
  let metadataBase: URL | undefined;
  try { if (base) metadataBase = new URL(base); } catch { /* Ignore an invalid optional public URL. */ }
  const title = `${theme.businessName} | Car care, made easy`;
  const description = theme.tagline || "Thoughtful car wash and detailing, right in your neighborhood.";
  return { metadataBase, title: { default: title, template: `%s | ${theme.businessName}` }, description, applicationName: theme.businessName, openGraph: { type: "website", siteName: theme.businessName, title, description, images: theme.logoUrl ? [{ url: theme.logoUrl }] : undefined }, twitter: { card: "summary", title, description, images: theme.logoUrl ? [theme.logoUrl] : undefined }, robots: { index: true, follow: true }, category: "automotive" };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = await getSiteTheme();
  const fontFamily = theme.font === "serif" ? "Georgia, serif" : theme.font === "mono" ? "ui-monospace, monospace" : "Arial, sans-serif";
  return <html lang="en"><body style={{ ...themeStyle(theme.colors), fontFamily }} data-button-style={theme.buttonStyle} data-font={theme.font}><LanguageProvider>{children}</LanguageProvider></body></html>;
}
