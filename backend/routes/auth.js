import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { auth, role, wrap } from "../middleware.js";

const r = Router();
const sign = (u) => ({
  token: jwt.sign({ id: u._id, role: u.role, name: u.name }, process.env.JWT_SECRET, { expiresIn: "12h" }),
  user: { id: u._id, name: u.name, role: u.role },
});

// Only works once: the first account becomes the admin.
r.post("/register", wrap(async (req, res) => {
  if (await User.countDocuments()) throw new Error("An admin already exists. Ask them to add you.");
  const { name, email, password } = req.body;
  const u = await User.create({ name, email, password: await bcrypt.hash(password, 10), role: "admin" });
  res.status(201).json(sign(u));
}));

r.post("/login", wrap(async (req, res) => {
  const u = await User.findOne({ email: (req.body.email || "").toLowerCase() });
  if (!u || !(await bcrypt.compare(req.body.password || "", u.password))) throw new Error("Wrong email or password");
  res.json(sign(u));
}));

// Admin adds accountants and front-desk agents.
r.post("/users", auth, role("admin"), wrap(async (req, res) => {
  const { name, email, password, role: rl } = req.body;
  const u = await User.create({ name, email, password: await bcrypt.hash(password, 10), role: rl });
  res.status(201).json({ id: u._id, name: u.name, role: u.role });
}));

export default r;
