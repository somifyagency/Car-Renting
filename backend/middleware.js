import jwt from "jsonwebtoken";

export const ACC = ["admin", "accountant"]; //

export const auth = (req, res, next) => {
  try {
    req.user = jwt.verify((req.headers.authorization || "").replace("Bearer ", ""), process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Please sign in again" });
  }
};

export const role = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: "You don't have access to this" });

export const wrap = (fn) => (req, res) => fn(req, res).catch((e) => res.status(400).json({ error: e.message }));
