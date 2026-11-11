import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const now = new Date();
  return ["", "/services"].map((path) => ({ url: `${base}${path}`, lastModified: now, changeFrequency: path ? "weekly" : "monthly", priority: path ? 0.8 : 1 }));
}
