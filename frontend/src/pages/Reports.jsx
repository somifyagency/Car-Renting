import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ReportView from "../ReportView.jsx";
import { api, downloadPdf, today, yearStart } from "../api.js";

const CFG = {
  ledger: { label: "General ledger", range: true, account: true },
  "trial-balance": { label: "Trial balance" },
  "adjusted-trial-balance": { label: "Adjusted trial balance" },
  "income-statement": { label: "Income statement", range: true },
  "equity-statement": { label: "Owner's equity", range: true },
  "balance-sheet": { label: "Balance sheet" },
  "cash-flow": { label: "Cash flow", range: true },
  "equation-worksheet": { label: "Equation worksheet", range: true },
};

export default function Reports() {
  const { name } = useParams();
  const cfg = CFG[name] || { label: name };
  const [from, setFrom] = useState(yearStart());
  const [to, setTo] = useState(today());
  const [account, setAccount] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [doc, setDoc] = useState(null);
  const [err, setErr] = useState("");

  const qs = new URLSearchParams({ to, ...(cfg.range && { from }), ...(cfg.account && account && { account }) }).toString();
  useEffect(() => { if (cfg.account) api("/accounts").then(setAccounts); }, [name]);
  useEffect(() => {
    setErr(""); setDoc(null);
    api(`/reports/${name}?${qs}`).then(setDoc).catch((e) => setErr(e.message));
  }, [name, qs]);

  return (
    <>
      <div className="bar">
        <h1>{cfg.label}</h1>
        <div className="filters">
          {cfg.account && (
            <label>Account
              <select value={account} onChange={(e) => setAccount(e.target.value)}>
                <option value="">All accounts</option>
                {accounts.map((a) => <option key={a._id} value={a._id}>{a.code} {a.name}</option>)}
              </select>
            </label>
          )}
          {cfg.range && <label>From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>}
          <label>{cfg.range ? "To" : "As of"}<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <button className="btn" disabled={!doc} onClick={() => downloadPdf(`/reports/${name}/pdf?${qs}`, `${name}.pdf`).catch((e) => setErr(e.message))}>Download PDF</button>
        </div>
      </div>
      {err && <p className="err">{err}</p>}
      {doc && <ReportView doc={doc} />}
    </>
  );
}
