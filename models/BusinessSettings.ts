import { model, models, Schema } from "mongoose";

const businessSettingsSchema = new Schema({
  key: { type: String, default: "default", unique: true },
  phone: { type: String, default: "" },
  whatsappNumber: { type: String, default: "" },
  address: { type: String, default: "" },
  mapUrl: { type: String, default: "" },
  currency: { type: String, default: "LKR" },
  timezone: { type: String, default: "Asia/Colombo" },
}, { timestamps: true });

export const BusinessSettings = models.BusinessSettings || model("BusinessSettings", businessSettingsSchema);
