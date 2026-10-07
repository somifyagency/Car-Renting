import { Router } from "express";
import { auth, role, wrap, ACC } from "../middleware.js";
import { buildReport } from "../services/reportBuilder.js";
import { sendPdf } from "../services/pdf.js";

const r = Router();
r.use(auth, role(...ACC));

r.get("/:name", wrap(async (req, res) => res.json(await buildReport(req.params.name, req.query))));

r.get("/:name/pdf", wrap(async (req, res) => {
  const doc = await buildReport(req.params.name, req.query);
  sendPdf(res, doc, `${req.params.name}-${new Date().toISOString().slice(0, 10)}`);
}));

export default r;
