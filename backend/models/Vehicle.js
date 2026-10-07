import mongoose from "mongoose";

export default mongoose.model(
  "Vehicle",
  new mongoose.Schema(
    {
      plate: { type: String, required: true, unique: true },
      make: String,
      model: String,
      purchaseCost: { type: Number, required: true }, // cents
      purchaseDate: { type: Date, required: true },
      usefulLifeMonths: { type: Number, default: 60 },
      salvageValue: { type: Number, default: 0 }, // cents
      status: { type: String, enum: ["available", "rented", "maintenance", "sold"], default: "available" },
      accumulatedDepreciation: { type: Number, default: 0 }, // cents
      depreciatedThrough: String, // "YYYY-MM"
    },
    { timestamps: true }
  )
);
