import { useEffect, useState } from "react";
import Modal from "../Modal.jsx";
import Confirm from "../Confirm.jsx";
import { api, downloadPdf, fmt, toCents, today, yearStart } from "../api.js";

const blank = () => ({ account: "", debit: "", credit: "", memo: "" });
const dollars = (c) => (c ? (c / 100).toFixed(2) : "");

export default function Journal({ type }) {
  const adjusting = type === "adjusting";
  const noun = adjusting ? "adjusting entry" : "journal entry";
  const [entries, setEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [from, setFrom] = useState(yearStart());
  const [to, setTo] = useState(today());
  const [form, setForm] = useState(null);
  const [ask, setAsk] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = () => api(`/journal?type=${type}&from=${from}&to=${to}`).then(setEntries).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [type, from, to]);
  useEffect(() => { api("/accounts").then((a) => setAccounts(a.filter((x) => x.isActive !== false))); }, []);

  const setLine = (i, patch) => {
    const lines = form.lines.map((l, j) => (j === i ? { ...l, ...patch } : l));
    if (patch.debit) lines[i].credit = "";
    if (patch.credit) lines[i].debit = "";
    setForm({ ...form, lines });
  };
  const D = form ? form.lines.reduce((s, l) => s + toCents(l.debit), 0) : 0;
  const C = form ? form.lines.reduce((s, l) => s + toCents(l.credit), 0) : 0;
  const ok = form && D === C && D > 0 && form.description.trim() && form.lines.filter((l) => l.account).length >= 2;

  const openNew = () => { setErr(""); setForm({ date: today(), description: "", lines: [blank(), blank()] }); };
  const openEdit = (e) => {
    setErr("");
    setForm({
      id: e._id, date: e.date.slice(0, 10), description: e.description,
      lines: e.lines.map((l) => ({ account: l.account?._id || "", debit: dollars(l.debit), credit: dollars(l.credit), memo: l.memo || "" })),
    });
  };
  const save = async () => {
    try {
      await api(form.id ? `/journal/${form.id}` : "/journal", {
        method: form.id ? "PUT" : "POST",
        body: {
          date: form.date, description: form.description, type,
          lines: form.lines.filter((l) => l.account).map((l) => ({ account: l.account, debit: toCents(l.debit), credit: toCents(l.credit), memo: l.memo })),
        },
      });
      setMsg(form.id ? "Entry updated." : "Entry posted.");
      setForm(null); setErr(""); load();
    } catch (e) { setErr(e.message); }
  };
  const confirm = async () => {
    const { kind, e } = ask;
    try {
      await api(`/journal/${e._id}${kind === "delete" ? "" : "/reverse"}`, { method: kind === "delete" ? "DELETE" : "POST" });
      setMsg(kind === "delete" ? `${e.reference} deleted.` : `${e.reference} reversed.`);
      load();
    } catch (x) { setErr(x.message); }
    setAsk(null);
  };
  const locked = (e) => e.status !== "posted" || e.reversalOf || e.source?.model === "Depreciation";

  return (
    <>
      <div className="bar">
        <div><h1>{adjusting ? "Adjusting entries" : "General journal"}</h1><p className="sub">{entries.length} entries between {from} and {to}</p></div>
        <div className="filters">
          <label>From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <button className="btn ghost" onClick={() => downloadPdf(`/reports/journal/pdf?type=${type}&from=${from}&to=${to}`, `${type}-journal.pdf`).catch((e) => setErr(e.message))}>Download PDF</button>
          <button className="btn" onClick={openNew}>New {noun}</button>
        </div>
      </div>
      {msg && <p className="banner good" onClick={() => setMsg("")}>{msg}</p>}
      {err && !form && <p className="banner bad" onClick={() => setErr("")}>{err}</p>}
      <div className="card scroll">
        <table>
          <thead><tr><th>Ref</th><th>Date</th><th>Description</th><th>Accounts</th><th className="num">Amount</th><th>Status</th><th /></tr></thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e._id}>
                <td className="ref">{e.reference}</td>
                <td>{e.date.slice(0, 10)}</td>
                <td>{e.description}</td>
                <td className="muted">{e.lines.map((l) => l.account?.name).join(", ")}</td>
                <td className="num">{fmt(e.lines.reduce((s, l) => s + l.debit, 0))}</td>
                <td><span className={`tag ${e.status}`}>{e.reversalOf ? "reversal" : e.status}</span></td>
                <td className="actions">
                  {!locked(e) && <button className="link" onClick={() => openEdit(e)}>Edit</button>}
                  {e.status === "posted" && !e.reversalOf && <button className="link" onClick={() => setAsk({ kind: "reverse", e })}>Reverse</button>}
                  {!locked(e) && <button className="link danger" onClick={() => setAsk({ kind: "delete", e })}>Delete</button>}
                </td>
              </tr>
            ))}
            {!entries.length && <tr><td colSpan="7" className="empty">Nothing posted in this period yet. Use “New {noun}” to add the first one.</td></tr>}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal
          title={`${form.id ? "Edit" : "New"} ${noun}`}
          onClose={() => setForm(null)}
          footer={<>
            <span className={`balance ${D === C && D > 0 ? "good" : "bad"}`}>Debits {fmt(D)} · Credits {fmt(C)}{D !== C && ` · Off by ${fmt(Math.abs(D - C))}`}</span>
            <button className="btn ghost" onClick={() => setForm(null)}>Cancel</button>
            <button className="btn" disabled={!ok} onClick={save}>{form.id ? "Save changes" : "Post entry"}</button>
          </>}
        >
          <div className="row">
            <label>Date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            <label className="grow">Description<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={adjusting ? "e.g. Accrued utilities for September" : "e.g. Rental invoice #1042"} /></label>
          </div>
          <table className="lines-edit">
            <thead><tr><th>Account</th><th>Debit</th><th>Credit</th><th>Memo</th><th /></tr></thead>
            <tbody>
              {form.lines.map((l, i) => (
                <tr key={i}>
                  <td>
                    <select value={l.account} onChange={(e) => setLine(i, { account: e.target.value })}>
                      <option value="">Choose account</option>
                      {accounts.map((a) => <option key={a._id} value={a._id}>{a.code} {a.name}</option>)}
                    </select>
                  </td>
                  <td><input type="number" min="0" step="0.01" value={l.debit} onChange={(e) => setLine(i, { debit: e.target.value })} /></td>
                  <td><input type="number" min="0" step="0.01" value={l.credit} onChange={(e) => setLine(i, { credit: e.target.value })} /></td>
                  <td><input value={l.memo} onChange={(e) => setLine(i, { memo: e.target.value })} /></td>
                  <td>{form.lines.length > 2 && <button className="link danger" onClick={() => setForm({ ...form, lines: form.lines.filter((_, j) => j !== i) })}>Remove</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="link" onClick={() => setForm({ ...form, lines: [...form.lines, blank()] })}>Add line</button>
          {err && <p className="err">{err}</p>}
        </Modal>
      )}
      {ask && (
        <Confirm
          title={ask.kind === "delete" ? `Delete ${ask.e.reference}?` : `Reverse ${ask.e.reference}?`}
          text={ask.kind === "delete" ? "This removes the entry and changes every report that includes it. This can't be undone." : "A new entry will be posted that cancels this one out. The original stays in the books."}
          action={ask.kind === "delete" ? "Delete entry" : "Reverse entry"} danger={ask.kind === "delete"} onYes={confirm} onClose={() => setAsk(null)}
        />
      )}
    </>
  );
}
