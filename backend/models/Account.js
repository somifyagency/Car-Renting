import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    type: { type: String, enum: ["asset", "liability", "equity", "revenue", "expense"], required: true },
    normalBalance: { type: String, enum: ["debit", "credit"], required: true },
    subType: String,
    isCash: { type: Boolean, default: false },
    cashFlow: { type: String, enum: ["operating", "investing", "financing"], default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Account", schema);
