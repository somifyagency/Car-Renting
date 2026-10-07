import { useEffect, useState } from "react";
import Modal from "../Modal.jsx";
import { api, fmt, toCents, today } from "../api.js";

export default function Transactions() {
  const [kinds, setKinds] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    Promise.all([api("/transactions/kinds"), api("/accounts")]).then(([k, a]) => { setKinds(k); setAccounts(a); }).catch((e) => setErr(e.message));
  }, []);
  const name = (code) => accounts.find((a) => a.code === code)?.name || code;
  const kind = form && kinds.find((k) => k.kind === form.kind);

  const save = async () => {
    try {
      const r = await api("/transactions", { method: "POST", body: { kind: form.kind, date: form.date, description: form.description, amount: toCents(form.amount) } });
      setMsg(`Posted ${r.reference}: ${r.description} for ${fmt(toCents(form.amount))}`);
      setForm(null);
      setErr("");
    } catch (e) { setErr(e.message); }
  };

  return (
    <>
      <div className="bar">
        <h1>Quick transactions</h1>
        <button className="btn" onClick={() => { setErr(""); setForm({ kind: kinds[0]?.kind, date: today(), amount: "", description: "" }); }}>New transaction</button>
      </div>
      {msg && <p className="note good">{msg}</p>}
      {err && !form && <p className="err">{err}</p>}
      <p className="sub">Pick what happened and the system posts the journal entry for you.</p>
      <div className="card scroll">
        <table>
          <thead><tr><th>Event</th><th>Debit</th><th>Credit</th></tr></thead>
          <tbody>{kinds.map((k) => <tr key={k.kind}><td>{k.label}</td><td>{name(k.dr)}</td><td>{name(k.cr)}</td></tr>)}</tbody>
        </table>
      </div>
      {form && (
        <Modal title="New transaction" onClose={() => setForm(null)}
          footer={<><button className="btn ghost" onClick={() => setForm(null)}>Cancel</button><button className="btn" disabled={!(toCents(form.amount) > 0)} onClick={save}>Post transaction</button></>}>
          <label>What happened
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {kinds.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
            </select>
          </label>
          <div className="row">
            <label>Date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            <label>Amount<input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
          </div>
          <label>Note (optional)<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Booking #1042, Toyota Corolla" /></label>
          {kind && <p className="note">Debit {name(kind.dr)}, credit {name(kind.cr)}.</p>}
          {err && <p className="err">{err}</p>}
        </Modal>
      )}
    </>
  );
}
