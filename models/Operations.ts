import { model, models, Schema } from "mongoose";

const customerSchema = new Schema({ name: { type: String, required: true }, phone: { type: String, required: true, unique: true }, vehicles: { type: [String], default: [] }, visitCount: { type: Number, default: 0 }, totalSpent: { type: Number, default: 0 }, notes: { type: String, default: "" } }, { timestamps: true });
const availabilitySchema = new Schema({ key: { type: String, default: "default", unique: true }, timezone: { type: String, default: "Asia/Colombo" }, weeklyHours: { type: [{ day: { type: Number, required: true, min: 0, max: 6 }, open: { type: Boolean, default: true }, start: { type: String, default: "08:00" }, end: { type: String, default: "17:00" } }], default: [] }, slotIntervalMinutes: { type: Number, default: 30 }, bufferMinutes: { type: Number, default: 0 }, capacity: { type: Number, default: 1 }, minimumNoticeMinutes: { type: Number, default: 120 }, maximumAdvanceDays: { type: Number, default: 30 }, pendingHoldMinutes: { type: Number, default: 120 }, autoReleasePending: { type: Boolean, default: true } }, { timestamps: true });
const blockedSlotSchema = new Schema({ date: { type: Date, required: true, index: true }, startTime: { type: String, default: "" }, endTime: { type: String, default: "" }, reason: { type: String, default: "" }, allDay: { type: Boolean, default: false } }, { timestamps: true });
const paymentSchema = new Schema({ booking: { type: Schema.Types.ObjectId, ref: "Booking", required: true, index: true }, amount: { type: Number, required: true, min: 0 }, method: { type: String, enum: ["cash", "bank", "card"], required: true }, paidAt: { type: Date, default: Date.now }, note: { type: String, default: "" } }, { timestamps: true });
const expenseSchema = new Schema({ description: { type: String, required: true }, category: { type: String, enum: ["water", "chemicals", "electricity", "maintenance", "other"], default: "other" }, amount: { type: Number, required: true, min: 0 }, date: { type: Date, required: true, index: true }, note: { type: String, default: "" } }, { timestamps: true });
const auditLogSchema = new Schema({ actor: { type: Schema.Types.ObjectId, ref: "User" }, action: { type: String, required: true }, entity: { type: String, required: true }, entityId: { type: String, default: "" }, details: { type: Schema.Types.Mixed, default: {} } }, { timestamps: true });

export const Customer = models.Customer || model("Customer", customerSchema);
export const AvailabilitySettings = models.AvailabilitySettings || model("AvailabilitySettings", availabilitySchema);
export const BlockedSlot = models.BlockedSlot || model("BlockedSlot", blockedSlotSchema);
export const Payment = models.Payment || model("Payment", paymentSchema);
export const Expense = models.Expense || model("Expense", expenseSchema);
export const AuditLog = models.AuditLog || model("AuditLog", auditLogSchema);
