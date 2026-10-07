import { Router } from "express";
import Vehicle from "../models/Vehicle.js";
import Account from "../models/Account.js";
import { auth, role, wrap, ACC } from "../middleware.js";
import { postEntry, postTransaction } from "../services/posting.js";

const r = Router();

r.get("/vehicles", auth, wrap(async (req, res) => res.json(await Vehicle.find().sort({ plate: 1 }))));

r.post("/vehicles", auth, role(...ACC), wrap(async (req, res) => {
  const { recordPurchase, ...body } = req.body;
  const v = await Vehicle.create(body);
  if (recordPurchase)
    await postTransaction({
      kind: "vehicle_purchase", amount: v.purchaseCost, date: v.purchaseDate,
      description: `Purchase of ${v.make} ${v.model} (${v.plate})`, userId: req.user.id,
    });
  res.status(201).json(v);
}));

// Straight-line depreciation for all vehicles through a month ("YYYY-MM"), one adjusting entry.
r.post("/vehicles/depreciation", auth, role(...ACC), wrap(async (req, res) => {
  const { month } = req.body;
  if (!/^\d{4}-\d{2}$/.test(month || "")) throw new Error("Choose a month");
  const [y, m] = month.split("-").map(Number);
  const idx = (yy, mm) => yy * 12 + mm;
  const end = new Date(Date.UTC(y, m, 0));
  const vehicles = await Vehicle.find({ status: { $ne: "sold" }, purchaseDate: { $lte: end } });
  let totalAmt = 0;
  const plates = [];
  for (const v of vehicles) {
    const depreciable = v.purchaseCost - v.salvageValue;
    const start = v.depreciatedThrough
      ? idx(...v.depreciatedThrough.split("-").map(Number)) + 1
      : idx(v.purchaseDate.getUTCFullYear(), v.purchaseDate.getUTCMonth() + 1);
    const months = idx(y, m) - start + 1;
    if (months <= 0) continue;
    const amt = Math.min(Math.floor(depreciable / v.usefulLifeMonths) * months, depreciable - v.accumulatedDepreciation);
    if (amt <= 0) continue;
    v.accumulatedDepreciation += amt;
    v.depreciatedThrough = month;
    await v.save();
    totalAmt += amt;
    plates.push(v.plate);
  }
  if (!totalAmt) throw new Error("Nothing to depreciate for that month");
  const accs = await Account.find({ code: { $in: ["5400", "1510"] } });
  const id = (c) => accs.find((a) => a.code === c)?._id;
  const entry = await postEntry({
    date: end, type: "adjusting", description: `Vehicle depreciation through ${month}`,
    lines: [
      { account: id("5400"), debit: totalAmt, credit: 0, memo: plates.join(", ") },
      { account: id("1510"), debit: 0, credit: totalAmt },
    ],
    source: { model: "Depreciation", month }, createdBy: req.user.id,
  });
  res.status(201).json(entry);
}));

r.put("/vehicles/:id", auth, role(...ACC), wrap(async (req, res) => {
  const v = await Vehicle.findById(req.params.id);
  if (!v) throw new Error("Vehicle not found");
  const { plate, make, model, status, usefulLifeMonths, salvageValue, purchaseCost, purchaseDate } = req.body;
  Object.assign(v, { plate, make, model, status, usefulLifeMonths, salvageValue });
  if (!v.accumulatedDepreciation) Object.assign(v, { purchaseCost, purchaseDate }); // cost is locked once depreciation is posted
  res.json(await v.save());
}));

r.delete("/vehicles/:id", auth, role(...ACC), wrap(async (req, res) => {
  const v = await Vehicle.findById(req.params.id);
  if (!v) throw new Error("Vehicle not found");
  if (v.accumulatedDepreciation > 0) throw new Error("This vehicle has depreciation posted. Mark it as sold instead.");
  await v.deleteOne();
  res.json({ ok: true });
}));

export default r;
