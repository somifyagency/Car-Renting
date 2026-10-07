// services/financialStatements.js
// All amounts are integers in minor units (cents).
//
// Statements are computed from posted journal lines of type "standard" and
// "adjusting" (i.e. the ADJUSTED trial balance). "closing" entries are
// deliberately excluded: net income is always computed live from revenue and
// expense accounts, so statements stay correct whether or not the period has
// been closed. "reversed" originals are included so that their reversing
// entries net them out to zero.
//
// Required Account fields (add to the Account schema):
//   type:           asset | liability | equity | revenue | expense
//   normalBalance:  debit | credit
//   subType:        current_asset | fixed_asset | contra_asset |
//                   current_liability | long_term_liability |
//                   capital | drawings | retained_earnings |
//                   operating_revenue | other_revenue |
//                   operating_expense | depreciation | other_expense
//   isCash:         Boolean  (cash and bank accounts)
//   cashFlow:       operating | investing | financing | null
//                   (for non-cash balance sheet accounts)

import JournalEntry from "../models/JournalEntry.js";
import Account from "../models/Account.js";

const STATEMENT_TYPES = ["standard", "adjusting"];
const STATUSES = ["posted", "reversed"];

/* ---------- helpers ---------- */

async function sumsBetween({ from, to }) {
  const date = {};
  if (from) date.$gte = from;
  if (to) date.$lte = to;

  const rows = await JournalEntry.aggregate([
    {
      $match: {
        status: { $in: STATUSES },
        type: { $in: STATEMENT_TYPES },
        ...(from || to ? { date } : {}),
      },
    },
    { $unwind: "$lines" },
    {
      $group: {
        _id: "$lines.account",
        debit: { $sum: "$lines.debit" },
        credit: { $sum: "$lines.credit" },
      },
    },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
}

// Balance in the account's natural direction (positive = normal side)
function signed(acc, sums) {
  const r = sums.get(String(acc._id));
  if (!r) return 0;
  return acc.normalBalance === "debit" ? r.debit - r.credit : r.credit - r.debit;
}

const dayBefore = (d) => new Date(new Date(d).getTime() - 1);
const total = (rows) => rows.reduce((s, r) => s + r.amount, 0);

function rowsFor(accounts, sums, filter) {
  return accounts
    .filter(filter)
    .map((a) => ({
      accountId: a._id,
      code: a.code,
      name: a.name,
      subType: a.subType,
      amount: signed(a, sums),
    }))
    .filter((r) => r.amount !== 0)
    .sort((a, b) => a.code.localeCompare(b.code));
}

async function loadAccounts() {
  return Account.find({}).lean();
}

/* ---------- 1. Income Statement (period movement) ---------- */

export async function incomeStatement({ from, to }) {
  const accounts = await loadAccounts();
  const sums = await sumsBetween({ from, to });

  const operatingRevenue = rowsFor(accounts, sums, (a) => a.subType === "operating_revenue");
  const otherRevenue = rowsFor(accounts, sums, (a) => a.subType === "other_revenue");
  const operatingExpenses = rowsFor(accounts, sums, (a) => a.subType === "operating_expense");
  const depreciation = rowsFor(accounts, sums, (a) => a.subType === "depreciation");
  const otherExpenses = rowsFor(accounts, sums, (a) => a.subType === "other_expense");

  const totalRevenue = total(operatingRevenue) + total(otherRevenue);
  const totalExpenses = total(operatingExpenses) + total(depreciation) + total(otherExpenses);

  return {
    from,
    to,
    operatingRevenue,
    otherRevenue,
    operatingExpenses,
    depreciation,
    otherExpenses,
    totalRevenue,
    totalExpenses,
    netIncome: totalRevenue - totalExpenses,
  };
}

// Cumulative net income from the beginning of time up to a date.
async function cumulativeNetIncome(accounts, to) {
  if (!to) return 0;
  const sums = await sumsBetween({ to });
  const rev = accounts.filter((a) => a.type === "revenue").reduce((s, a) => s + signed(a, sums), 0);
  const exp = accounts.filter((a) => a.type === "expense").reduce((s, a) => s + signed(a, sums), 0);
  return rev - exp;
}

/* ---------- equity at a point in time (shared helper) ---------- */

async function equityAt(accounts, asOf) {
  const sums = await sumsBetween({ to: asOf });
  const capital = total(rowsFor(accounts, sums, (a) => a.subType === "capital"));
  const drawings = total(rowsFor(accounts, sums, (a) => a.subType === "drawings")); // debit-normal, positive
  const reAccount = total(rowsFor(accounts, sums, (a) => a.subType === "retained_earnings"));
  const unclosedIncome = await cumulativeNetIncome(accounts, asOf);

  const retained = reAccount + unclosedIncome;
  return { capital, drawings, retained, total: capital + retained - drawings };
}

/* ---------- 2. Statement of Owner's Equity ---------- */

export async function equityStatement({ from, to }) {
  const accounts = await loadAccounts();
  const opening = await equityAt(accounts, dayBefore(from));
  const closing = await equityAt(accounts, to);
  const is = await incomeStatement({ from, to });

  const contributions = closing.capital - opening.capital;
  const drawings = closing.drawings - opening.drawings;

  const computedClosing = opening.total + contributions + is.netIncome - drawings;

  return {
    from,
    to,
    openingEquity: opening.total,
    contributions,
    netIncome: is.netIncome,
    drawings: -drawings,
    closingEquity: computedClosing,
    balanced: computedClosing === closing.total, // integrity check
  };
}

/* ---------- 3. Balance Sheet (as of a date) ---------- */

export async function balanceSheet({ asOf }) {
  const accounts = await loadAccounts();
  const sums = await sumsBetween({ to: asOf });

  const currentAssets = rowsFor(accounts, sums, (a) => a.subType === "current_asset");
  const fixedAssets = rowsFor(accounts, sums, (a) => a.subType === "fixed_asset");
  // Contra assets (accumulated depreciation) are credit-normal: show as negatives
  const contraAssets = rowsFor(accounts, sums, (a) => a.subType === "contra_asset").map((r) => ({
    ...r,
    amount: -r.amount,
  }));

  const currentLiabilities = rowsFor(accounts, sums, (a) => a.subType === "current_liability");
  const longTermLiabilities = rowsFor(accounts, sums, (a) => a.subType === "long_term_liability");

  const eq = await equityAt(accounts, asOf);

  const totalAssets = total(currentAssets) + total(fixedAssets) + total(contraAssets);
  const totalLiabilities = total(currentLiabilities) + total(longTermLiabilities);

  return {
    asOf,
    assets: {
      currentAssets,
      fixedAssets,
      contraAssets,
      netFixedAssets: total(fixedAssets) + total(contraAssets),
      total: totalAssets,
    },
    liabilities: { currentLiabilities, longTermLiabilities, total: totalLiabilities },
    equity: {
      capital: eq.capital,
      drawings: -eq.drawings,
      retainedEarnings: eq.retained, // includes current-period net income
      total: eq.total,
    },
    totalLiabilitiesAndEquity: totalLiabilities + eq.total,
    balanced: totalAssets === totalLiabilities + eq.total, // A = L + E
  };
}

/* ---------- 4. Cash Flow Statement (indirect method) ---------- */
// Cash effect of a balance sheet account's change:
//   debit-normal (assets, drawings):   -(increase)
//   credit-normal (liabilities, contra assets, capital): +(increase)
// This automatically adds back depreciation via accumulated depreciation.

export async function cashFlowStatement({ from, to }) {
  const accounts = await loadAccounts();
  const openSums = await sumsBetween({ to: dayBefore(from) });
  const closeSums = await sumsBetween({ to });
  const is = await incomeStatement({ from, to });

  const operating = [];
  const investing = [];
  const financing = [];

  for (const a of accounts) {
    if (a.isCash) continue;
    if (!["asset", "liability", "equity"].includes(a.type)) continue;
    if (a.subType === "retained_earnings") continue; // net income handled separately
    if (!a.cashFlow) continue;

    const change = signed(a, closeSums) - signed(a, openSums);
    if (change === 0) continue;

    const cashEffect = a.normalBalance === "debit" ? -change : change;
    const line = { code: a.code, name: a.name, amount: cashEffect };

    if (a.cashFlow === "operating") operating.push(line);
    else if (a.cashFlow === "investing") investing.push(line);
    else if (a.cashFlow === "financing") financing.push(line);
  }

  const cashAccounts = accounts.filter((a) => a.isCash);
  const openingCash = cashAccounts.reduce((s, a) => s + signed(a, openSums), 0);
  const closingCash = cashAccounts.reduce((s, a) => s + signed(a, closeSums), 0);

  const operatingTotal = is.netIncome + total(operating);
  const investingTotal = total(investing);
  const financingTotal = total(financing);
  const netChange = operatingTotal + investingTotal + financingTotal;

  return {
    from,
    to,
    operating: { netIncome: is.netIncome, adjustments: operating, total: operatingTotal },
    investing: { items: investing, total: investingTotal },
    financing: { items: financing, total: financingTotal },
    netChangeInCash: netChange,
    openingCash,
    closingCash,
    reconciled: openingCash + netChange === closingCash, // integrity check
  };
}

/* ---------- all four at once ---------- */

export async function financialStatements({ from, to }) {
  const [income, equity, balance, cashFlow] = await Promise.all([
    incomeStatement({ from, to }),
    equityStatement({ from, to }),
    balanceSheet({ asOf: to }),
    cashFlowStatement({ from, to }),
  ]);
  return { income, equity, balance, cashFlow };
}
