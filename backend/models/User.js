import mongoose from "mongoose";

export default mongoose.model(
  "User",
  new mongoose.Schema(
    {
      name: String,
      email: { type: String, required: true, unique: true, lowercase: true },
      password: { type: String, required: true },
      role: { type: String, enum: ["admin", "accountant", "agent"], default: "agent" },
    },
    { timestamps: true }
  )
);
