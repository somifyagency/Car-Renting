import { Router } from "express";
import Account from "../models/Account.js";
import JournalEntry from "../models/JournalEntry.js";
import { auth, role, wrap, ACC } from "../middleware.js";
import { postEntry, reverseEntry, postTransaction, KINDS } from "../services/posting.js";

const r = Router();

async function editable(id) {
  const e = await JournalEntry.findById(id);
  if (!e) throw new Error("Entry not found");
  if (e.status !== "posted" || e.reversalOf) throw new Error("Reversed entries and their reversals are locked.");
  if (e.source?.model === "Depreciation") throw new Error("Depreciation entries are managed from Fleet and depreciation.");
  return e;
}

r.get("/accounts", auth, wrap(async (req, res) => res.json(await Account.find().sort({ code: 1 }))));
r.post("/accounts", auth, role(...ACC), wrap(async (req, res) => res.status(201).json(await Account.create(req.body))));

r.get("/journal", auth, role(...ACC), wrap(async (req, res) => {
  const { type, from, to } = req.query;
  const q = {};
  if (type) q.type = type;
  if (from || to) q.date = { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(`${to}T23:59:59.999Z`) }) };
  res.json(await JournalEntry.find(q).sort({ date: -1, reference: -1 }).limit(300).populate("lines.account", "code name"));
}));

r.post("/journal", auth, role(...ACC), wrap(async (req, res) => {
  const { date, description, type, lines } = req.body;
  if (!["standard", "adjusting"].includes(type)) throw new Error("Entry type must be standard or adjusting");
  res.status(201).json(await postEntry({ date: new Date(date), description, type, lines, createdBy: req.user.id }));
}));

r.post("/journal/:id/reverse", auth, role(...ACC), wrap(async (req, res) => res.json(await reverseEntry(req.params.id, req.user.id))));

r.get("/transactions/kinds", auth, (req, res) =>
  res.json(Object.entries(KINDS).map(([kind, k]) => ({ kind, ...k })))
);

r.post("/transactions", auth, wrap(async (req, res) => {
  const { kind, amount, date, description } = req.body;
  if (KINDS[kind]?.type === "adjusting" && !ACC.includes(req.user.role)) throw new Error("Only accountants can post adjustments");
  res.status(201).json(await postTransaction({ kind, amount, date, description, userId: req.user.id }));
}));

r.put("/accounts/:id", auth, role(...ACC), wrap(async (req, res) => {
  const { name, subType, cashFlow, isCash, isActive } = req.body;
  const upd = Object.fromEntries(Object.entries({ name, subType, cashFlow: cashFlow || null, isCash, isActive }).filter(([, v]) => v !== undefined));
  res.json(await Account.findByIdAndUpdate(req.params.id, upd, { new: true, runValidators: true }));
}));

r.delete("/accounts/:id", auth, role(...ACC), wrap(async (req, res) => {
  if (await JournalEntry.exists({ "lines.account": req.params.id }))
    throw new Error("This account has journal entries. Edit it and mark it inactive instead.");
  await Account.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}));

r.put("/journal/:id", auth, role(...ACC), wrap(async (req, res) => {
  const e = await editable(req.params.id);
  const { date, description, lines } = req.body;
  e.date = new Date(date);
  e.description = description;
  e.lines = lines;
  res.json(await e.save());
}));

r.delete("/journal/:id", auth, role(...ACC), wrap(async (req, res) => {
  await (await editable(req.params.id)).deleteOne();
  res.json({ ok: true });
}));

export default r;
