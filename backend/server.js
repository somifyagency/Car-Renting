import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import auth from "./routes/auth.js";
import accounting from "./routes/accounting.js";
import fleet from "./routes/fleet.js";
import reports from "./routes/reports.js";
import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/auth", auth);
app.use("/api", accounting);
app.use("/api", fleet);
app.use("/api/reports", reports);

await mongoose.connect(process.env.MONGO_URI);
app.listen(process.env.PORT || 5000, () => console.log("API ready on port", process.env.PORT || 5000));
