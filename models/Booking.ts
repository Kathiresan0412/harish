import { model, models, Schema } from "mongoose";

const itemSchema = new Schema({ itemId: { type: Schema.Types.ObjectId }, name: { type: String, required: true }, kind: { type: String, enum: ["service", "addon"], required: true }, price: { type: Number, required: true, min: 0 }, durationMinutes: { type: Number, required: true, min: 0 } }, { _id: false });
const bookingSchema = new Schema({
  reference: { type: String, required: true, unique: true, index: true }, customer: { name: { type: String, required: true }, phone: { type: String, required: true, index: true } },
  vehicleType: { type: Schema.Types.ObjectId, ref: "VehicleType", required: true }, vehicleTypeName: { type: String, required: true }, vehicleNumber: { type: String, default: "" }, items: { type: [itemSchema], required: true },
  totalPrice: { type: Number, required: true, min: 0 }, totalDuration: { type: Number, required: true, min: 1 }, date: { type: Date, required: true, index: true }, startTime: { type: String, required: true }, endTime: { type: String, required: true },
  status: { type: String, enum: ["Pending", "Confirmed", "In Progress", "Completed", "Cancelled", "No-show"], default: "Pending", index: true }, paymentStatus: { type: String, enum: ["Unpaid", "Partial", "Paid", "Refunded"], default: "Unpaid" }, notes: { type: String, default: "" }, source: { type: String, enum: ["online", "manual"], default: "online" }, pendingExpiresAt: { type: Date, default: null },
}, { timestamps: true });
bookingSchema.index({ date: 1, startTime: 1 });
bookingSchema.index({ status: 1, date: 1 });
export const Booking = models.Booking || model("Booking", bookingSchema);
