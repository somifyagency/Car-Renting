import "dotenv/config";
import mongoose from "mongoose";
import Account from "./models/Account.js";
import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

// [code, name, type, normal, subType, cashFlow, isCash]
const D = "debit", C = "credit";
const chart = [
  ["1000", "Cash and Bank", "asset", D, "current_asset", null, true],
  ["1100", "Accounts Receivable", "asset", D, "current_asset", "operating"],
  ["1200", "Prepaid Insurance", "asset", D, "current_asset", "operating"],
  ["1500", "Vehicles (at cost)", "asset", D, "fixed_asset", "investing"],
  ["1510", "Accumulated Depreciation - Vehicles", "asset", C, "contra_asset", "operating"],
  ["2000", "Accounts Payable", "liability", C, "current_liability", "operating"],
  ["2100", "Customer Deposits", "liability", C, "current_liability", "operating"],
  ["2200", "Unearned Revenue", "liability", C, "current_liability", "operating"],
  ["2300", "Accrued Liabilities", "liability", C, "current_liability", "operating"],
  ["2500", "Vehicle Loan Payable", "liability", C, "long_term_liability", "financing"],
  ["3000", "Owner's Capital", "equity", C, "capital", "financing"],
  ["3100", "Owner's Drawings", "equity", D, "drawings", "financing"],
  ["3200", "Retained Earnings", "equity", C, "retained_earnings", null],
  ["4000", "Rental Revenue", "revenue", C, "operating_revenue"],
  ["4100", "Damage and Fee Income", "revenue", C, "operating_revenue"],
  ["5000", "Maintenance Expense", "expense", D, "operating_expense"],
  ["5100", "Fuel Expense", "expense", D, "operating_expense"],
  ["5200", "Insurance Expense", "expense", D, "operating_expense"],
  ["5300", "Salaries Expense", "expense", D, "operating_expense"],
  ["5400", "Depreciation Expense", "expense", D, "depreciation"],
  ["5500", "Utilities Expense", "expense", D, "operating_expense"],
];

await mongoose.connect(process.env.MONGO_URI);
for (const [code, name, type, normalBalance, subType, cashFlow = null, isCash = false] of chart)
  await Account.updateOne({ code }, { code, name, type, normalBalance, subType, cashFlow, isCash }, { upsert: true });
console.log(`Chart of accounts ready (${chart.length} accounts)`);
await mongoose.disconnect();
