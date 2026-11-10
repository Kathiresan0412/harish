import { model, models, Schema } from "mongoose";

const priceSchema = new Schema({ vehicleType: { type: Schema.Types.ObjectId, ref: "VehicleType", required: true }, amount: { type: Number, required: true, min: 0 } }, { _id: false });
const serviceSchema = new Schema({ name: { type: String, required: true, trim: true }, slug: { type: String, required: true, unique: true }, description: { type: String, default: "" }, photoUrl: { type: String, default: "" }, durationMinutes: { type: Number, required: true, min: 1 }, prices: { type: [priceSchema], default: [] }, category: { type: Schema.Types.ObjectId, ref: "ServiceCategory" }, active: { type: Boolean, default: true }, sortOrder: { type: Number, default: 0 }, deletedAt: { type: Date, default: null } }, { timestamps: true });
const categorySchema = new Schema({ name: { type: String, required: true, trim: true }, slug: { type: String, required: true, unique: true }, sortOrder: { type: Number, default: 0 }, active: { type: Boolean, default: true } }, { timestamps: true });
const vehicleTypeSchema = new Schema({ name: { type: String, required: true, unique: true }, slug: { type: String, required: true, unique: true }, active: { type: Boolean, default: true }, sortOrder: { type: Number, default: 0 } }, { timestamps: true });
const addonSchema = new Schema({ name: { type: String, required: true, trim: true }, description: { type: String, default: "" }, durationMinutes: { type: Number, default: 0, min: 0 }, prices: { type: [priceSchema], default: [] }, active: { type: Boolean, default: true }, sortOrder: { type: Number, default: 0 }, deletedAt: { type: Date, default: null } }, { timestamps: true });

export const VehicleType = models.VehicleType || model("VehicleType", vehicleTypeSchema);
export const ServiceCategory = models.ServiceCategory || model("ServiceCategory", categorySchema);
export const Service = models.Service || model("Service", serviceSchema);
export const Addon = models.Addon || model("Addon", addonSchema);
