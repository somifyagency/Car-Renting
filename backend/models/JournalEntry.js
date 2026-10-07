import mongoose from "mongoose";

const line = new mongoose.Schema(
  {
    account: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    debit: { type: Number, default: 0, min: 0 }, // integer cents
    credit: { type: Number, default: 0, min: 0 }, // integer cents
    memo: String,
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    reference: { type: String, unique: true },
    description: { type: String, required: true },
    type: { type: String, enum: ["standard", "adjusting", "closing"], default: "standard" },
    status: { type: String, enum: ["posted", "reversed"], default: "posted" },
    source: mongoose.Schema.Types.Mixed,
    reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry" },
    lines: [line],
    createdBy: mongoose.Schema.Types.ObjectId,
  },
  { timestamps: true }
);

schema.pre("validate", function (next) {
  const L = this.lines;
  if (!L || L.length < 2) return next(new Error("An entry needs at least two lines"));
  let d = 0, c = 0;
  for (const l of L) {
    if (!Number.isInteger(l.debit) || !Number.isInteger(l.credit)) return next(new Error("Amounts must be whole cents"));
    if (l.debit > 0 === l.credit > 0) return next(new Error("Each line needs either a debit or a credit"));
    d += l.debit;
    c += l.credit;
  }
  if (d !== c) return next(new Error(`Entry is out of balance: debits ${d / 100} and credits ${c / 100}`));
  next();
});

export default mongoose.model("JournalEntry", schema);
