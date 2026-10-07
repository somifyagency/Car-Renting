import { useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Journal from "./pages/Journal.jsx";
import Transactions from "./pages/Transactions.jsx";
import Accounts from "./pages/Accounts.jsx";
import Fleet from "./pages/Fleet.jsx";
import Reports from "./pages/Reports.jsx";

// Navigation follows the accounting cycle, so the order is meaningful.
const NAV = [
  ["1. Record", [["/transactions", "Quick transactions"], ["/journal", "General journal"], ["/reports/equation-worksheet", "Equation worksheet"]]],
  ["2. Post and check", [["/reports/ledger", "General ledger"], ["/reports/trial-balance", "Trial balance"]]],
  ["3. Adjust", [["/adjusting", "Adjusting entries"], ["/fleet", "Fleet and depreciation"], ["/reports/adjusted-trial-balance", "Adjusted trial balance"]]],
  ["4. Report", [["/reports/income-statement", "Income statement"], ["/reports/equity-statement", "Owner's equity"], ["/reports/balance-sheet", "Balance sheet"], ["/reports/cash-flow", "Cash flow"]]],
  ["Setup", [["/accounts", "Chart of accounts"]]],
];

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("user") || "null"));
  if (!user) return <Login onLogin={setUser} />;
  const staff = user.role !== "agent";
  const logout = () => { localStorage.clear(); setUser(null); };

  return (
    <div className="app">
      <nav className="side">
        <div className="brand">Fleet Books</div>
        {NAV.filter(([g]) => staff || g === "1. Record").map(([group, links]) => (
          <div className="group" key={group}>
            <h4>{group}</h4>
            {links.filter(([to]) => staff || to === "/transactions").map(([to, label]) => (
              <NavLink key={to} to={to}>{label}</NavLink>
            ))}
          </div>
        ))}
        <div className="who">
          <span>{user.name} ({user.role})</span>
          <button className="link" onClick={logout}>Sign out</button>
        </div>
      </nav>
      <main>
        <Routes>
          <Route path="/transactions" element={<Transactions />} />
          {staff && <>
            <Route path="/journal" element={<Journal type="standard" />} />
            <Route path="/adjusting" element={<Journal type="adjusting" />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/fleet" element={<Fleet />} />
            <Route path="/reports/:name" element={<Reports />} />
          </>}
          <Route path="*" element={<Navigate to="/transactions" replace />} />
        </Routes>
      </main>
    </div>
  );
}
