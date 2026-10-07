import mongoose from "mongoose";
import JournalEntry from "../models/JournalEntry.js";
import Account from "../models/Account.js";

const Counter = mongoose.models.Counter || mongoose.model("Counter", new mongoose.Schema({ _id: String, seq: Number }));

async function nextRef(prefix) {
  const c = await Counter.findByIdAndUpdate(prefix, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return `${prefix}-${String(c.seq).padStart(6, "0")}`;
}

export async function postEntry({ date, description, type = "standard", lines, source, createdBy }) {
  const entry = new JournalEntry({
    date, description, type, lines, source, createdBy,
    reference: await nextRef(type === "adjusting" ? "AJE" : "JE"),
  });
  return entry.save();
}

export async function reverseEntry(id, userId) {
  const orig = await JournalEntry.findById(id);
  if (!orig || orig.status !== "posted") throw new Error("Only posted entries can be reversed");
  const rev = await postEntry({
    date: new Date(),
    description: `Reversal of ${orig.reference}`,
    type: orig.type,
    lines: orig.lines.map((l) => ({ account: l.account, debit: l.credit, credit: l.debit, memo: l.memo })),
    createdBy: userId,
  });
  rev.reversalOf = orig._id;
  await rev.save();
  orig.status = "reversed";
  await orig.save();
  return rev;
}

// Business events -> journal entries (debit account code, credit account code)
export const KINDS = {
  rental_invoice: { label: "Rental invoiced", dr: "1100", cr: "4000" },
  customer_payment: { label: "Customer payment received", dr: "1000", cr: "1100" },
  deposit_received: { label: "Security deposit received", dr: "1000", cr: "2100" },
  deposit_refund: { label: "Security deposit refunded", dr: "2100", cr: "1000" },
  advance_payment: { label: "Advance booking payment", dr: "1000", cr: "2200" },
  damage_charge: { label: "Damage charged to customer", dr: "1100", cr: "4100" },
  maintenance_expense: { label: "Maintenance paid", dr: "5000", cr: "1000" },
  fuel_expense: { label: "Fuel paid", dr: "5100", cr: "1000" },
  vehicle_purchase: { label: "Vehicle purchased (cash)", dr: "1500", cr: "1000" },
  loan_received: { label: "Vehicle loan received", dr: "1000", cr: "2500" },
  owner_investment: { label: "Owner investment", dr: "1000", cr: "3000" },
  owner_drawing: { label: "Owner drawing", dr: "3100", cr: "1000" },
  revenue_earned: { label: "Advance bookings earned (adjusting)", dr: "2200", cr: "4000", type: "adjusting" },
  insurance_expired: { label: "Prepaid insurance used (adjusting)", dr: "5200", cr: "1200", type: "adjusting" },
};

export async function postTransaction({ kind, amount, date, description, userId }) {
  const k = KINDS[kind];
  if (!k) throw new Error("Unknown transaction type");
  const accs = await Account.find({ code: { $in: [k.dr, k.cr] } });
  const id = (code) => accs.find((a) => a.code === code)?._id;
  if (!id(k.dr) || !id(k.cr)) throw new Error("Chart of accounts is missing. Run: npm run seed");
  return postEntry({
    date: new Date(date),
    description: description || k.label,
    type: k.type || "standard",
    lines: [
      { account: id(k.dr), debit: amount, credit: 0 },
      { account: id(k.cr), debit: 0, credit: amount },
    ],
    source: { model: "Transaction", kind },
    createdBy: userId,
  });
}
