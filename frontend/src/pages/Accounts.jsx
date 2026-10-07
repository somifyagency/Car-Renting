import { useEffect, useState } from "react";
import Modal from "../Modal.jsx";
import Confirm from "../Confirm.jsx";
import { api } from "../api.js";

const SUBTYPES = {
  asset: ["current_asset", "fixed_asset", "contra_asset"],
  liability: ["current_liability", "long_term_liability"],
  equity: ["capital", "drawings", "retained_earnings"],
  revenue: ["operating_revenue", "other_revenue"],
  expense: ["operating_expense", "depreciation", "other_expense"],
};
const NORMAL = { asset: "debit", expense: "debit", liability: "credit", equity: "credit", revenue: "credit" };
const blank = { code: "", name: "", type: "asset", subType: "current_asset", cashFlow: "", isCash: false, isActive: true };

export default function Accounts() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(null);
  const [ask, setAsk] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const load = () => api("/accounts").then(setList);
  useEffect(() => { load(); }, []);
  const edit = form?._id;

  const save = async () => {
    try {
      const normalBalance = form.subType === "drawings" ? "debit" : form.subType === "contra_asset" ? "credit" : NORMAL[form.type];
      await api(edit ? `/accounts/${edit}` : "/accounts", { method: edit ? "PUT" : "POST", body: { ...form, normalBalance, cashFlow: form.cashFlow || null } });
      setMsg(edit ? "Account updated." : "Account added.");
      setForm(null); setErr(""); load();
    } catch (e) { setErr(e.message); }
  };
  const remove = async () => {
    try { await api(`/accounts/${ask._id}`, { method: "DELETE" }); setMsg(`${ask.name} deleted.`); load(); setErr(""); }
    catch (e) { setErr(e.message); }
    setAsk(null);
  };

  return (
    <>
      <div className="bar">
        <div><h1>Chart of accounts</h1><p className="sub">{list.length} accounts. Statement group and cash flow tags decide where each account appears in the reports.</p></div>
        <button className="btn" onClick={() => { setErr(""); setForm(blank); }}>New account</button>
      </div>
      {msg && <p className="banner good" onClick={() => setMsg("")}>{msg}</p>}
      {err && !form && <p className="banner bad" onClick={() => setErr("")}>{err}</p>}
      <div className="card scroll">
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Normal balance</th><th>Statement group</th><th>Cash flow</th><th /></tr></thead>
          <tbody>
            {list.map((a) => (
              <tr key={a._id} className={a.isActive === false ? "dim" : ""}>
                <td className="ref">{a.code}</td>
                <td>{a.name} {a.isCash && <span className="tag">cash</span>} {a.isActive === false && <span className="tag reversed">inactive</span>}</td>
                <td>{a.type}</td><td>{a.normalBalance}</td><td>{a.subType}</td><td>{a.cashFlow || ""}</td>
                <td className="actions">
                  <button className="link" onClick={() => { setErr(""); setForm({ ...a, cashFlow: a.cashFlow || "" }); }}>Edit</button>
                  <button className="link danger" onClick={() => setAsk(a)}>Delete</button>
                </td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan="7" className="empty">No accounts yet. Run <code>npm run seed</code> in the backend to load the car rental chart of accounts.</td></tr>}
          </tbody>
        </table>
      </div>
      {form && (
        <Modal title={edit ? `Edit ${form.code}` : "New account"} onClose={() => setForm(null)}
          footer={<><button className="btn ghost" onClick={() => setForm(null)}>Cancel</button><button className="btn" disabled={!form.code || !form.name} onClick={save}>{edit ? "Save changes" : "Add account"}</button></>}>
          <div className="row">
            <label>Code<input value={form.code} disabled={!!edit} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
            <label className="grow">Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          </div>
          <div className="row">
            <label>Type
              <select value={form.type} disabled={!!edit} onChange={(e) => setForm({ ...form, type: e.target.value, subType: SUBTYPES[e.target.value][0] })}>
                {Object.keys(SUBTYPES).map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label>Statement group
              <select value={form.subType} onChange={(e) => setForm({ ...form, subType: e.target.value })}>
                {SUBTYPES[form.type].map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label>Cash flow section
              <select value={form.cashFlow} onChange={(e) => setForm({ ...form, cashFlow: e.target.value })}>
                <option value="">None</option><option>operating</option><option>investing</option><option>financing</option>
              </select>
            </label>
          </div>
          <label className="check"><input type="checkbox" checked={form.isCash} onChange={(e) => setForm({ ...form, isCash: e.target.checked })} /> This is a cash or bank account</label>
          {edit && <label className="check"><input type="checkbox" checked={form.isActive !== false} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active (inactive accounts are hidden from the entry form)</label>}
          {err && <p className="err">{err}</p>}
        </Modal>
      )}
      {ask && <Confirm title={`Delete ${ask.code} ${ask.name}?`} text="Accounts with journal entries can't be deleted. Mark them inactive instead." action="Delete account" onYes={remove} onClose={() => setAsk(null)} />}
    </>
  );
}
