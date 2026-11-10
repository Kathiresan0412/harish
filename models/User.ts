import { model, models, Schema } from "mongoose";

const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["owner"], default: "owner", immutable: true },
  active: { type: Boolean, default: true },
}, { timestamps: true });

export const User = models.User || model("User", userSchema);
