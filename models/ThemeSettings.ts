import { model, models, Schema } from "mongoose";

const themeSettingsSchema = new Schema({
  key: { type: String, default: "default", unique: true },
  businessName: { type: String, default: "Harbor Auto Spa", trim: true },
  tagline: { type: String, default: "A fresh finish, right at home." },
  logoUrl: { type: String, default: "" },
  faviconUrl: { type: String, default: "" },
  heroImageUrl: { type: String, default: "" },
  preset: { type: String, enum: ["ocean", "green", "sunset", "dark", "gold", "custom"], default: "ocean" },
  colors: {
    primary: { type: String, default: "#087E8B" },
    secondary: { type: String, default: "#0B3954" },
    accent: { type: String, default: "#FF5A5F" },
    background: { type: String, default: "#F6F8F7" },
    foreground: { type: String, default: "#132A32" },
    button: { type: String, default: "#087E8B" },
  },
  font: { type: String, enum: ["sans", "serif", "mono"], default: "sans" },
  buttonStyle: { type: String, enum: ["rounded", "square"], default: "rounded" },
}, { timestamps: true });

export const ThemeSettings = models.ThemeSettings || model("ThemeSettings", themeSettingsSchema);
