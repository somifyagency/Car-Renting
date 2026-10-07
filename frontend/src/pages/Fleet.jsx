import { useEffect, useState } from "react";
import Modal from "../Modal.jsx";
import Confirm from "../Confirm.jsx";
import { api, fmt, toCents, today } from "../api.js";

const dollars = (c) => (c ? (c / 100).toFixed(2) : "");

export default function Fleet() {
  const [list, setList] = useState([]);
  const [modal, setModal] = useState(null); // "vehicle" | "dep"
  const [f, setF] = useState({});
  const [ask, setAsk] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const load = () => api("/vehicles").then(setList);
  useEffect(() => { load(); }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const open = (m, init) => { setErr(""); setF(init); setModal(m); };
  const edit = f._id;

  const saveVehicle = async () => {
    try {
      const body = { plate: f.plate, make: f.make, model: f.model, purchaseDate: f.purchaseDate, purchaseCost: toCents(f.cost), salvageValue: toCents(f.salvage), usefulLifeMonths: Number(f.life || 60), status: f.status || "available", recordPurchase: !!f.record };
      await api(edit ? `/vehicles/${edit}` : "/vehicles", { method: edit ? "PUT" : "POST", body });
      setMsg(edit ? "Vehicle updated." : "Vehicle added.");
      setModal(null); load();
    } catch (e) { setErr(e.message); }
  };
  const depreciate = async () => {
    try {
      const r = await api("/vehicles/depreciation", { method: "POST", body: { month: f.month } });
      setMsg(`Posted ${r.reference}: ${r.description}`);
      setModal(null); load();
    } catch (e) { setErr(e.message); }
  };
  const remove = async () => {
    try { await api(`/vehicles/${ask._id}`, { method: "DELETE" }); setMsg(`${ask.plate} deleted.`); load(); setErr(""); }
    catch (e) { setErr(e.message); }
    setAsk(null);
  };
  const openEdit = (v) => open("vehicle", {
    _id: v._id, plate: v.plate, make: v.make, model: v.model, purchaseDate: v.purchaseDate.slice(0, 10), cost: dollars(v.purchaseCost),
    salvage: dollars(v.salvageValue), life: v.usefulLifeMonths, status: v.status, locked: v.accumulatedDepreciation > 0,
  });

  return (
    <>
      <div className="bar">
        <div><h1>Fleet and depreciation</h1><p className="sub">{list.length} vehicles. Depreciation is straight-line and posts as an adjusting entry.</p></div>
        <div className="filters">
          <button className="btn ghost" onClick={() => open("dep", { month: today().slice(0, 7) })}>Run monthly depreciation</button>
          <button className="btn" onClick={() => open("vehicle", { purchaseDate: today(), life: 60, record: true, status: "available" })}>Add vehicle</button>
        </div>
      </div>
      {msg && <p className="banner good" onClick={() => setMsg("")}>{msg}</p>}
      {err && !modal && <p className="banner bad" onClick={() => setErr("")}>{err}</p>}
      <div className="card scroll">
        <table>
          <thead><tr><th>Plate</th><th>Vehicle</th><th>Status</th><th>Purchased</th><th className="num">Cost</th><th className="num">Accumulated</th><th className="num">Book value</th><th>Depreciated through</th><th /></tr></thead>
          <tbody>
            {list.map((v) => (
              <tr key={v._id}>
                <td className="ref">{v.plate}</td><td>{v.make} {v.model}</td><td><span className="tag">{v.status}</span></td><td>{v.purchaseDate.slice(0, 10)}</td>
                <td className="num">{fmt(v.purchaseCost)}</td><td className="num">{fmt(v.accumulatedDepreciation)}</td><td className="num">{fmt(v.purchaseCost - v.accumulatedDepreciation)}</td>
                <td>{v.depreciatedThrough || "Not yet"}</td>
                <td className="actions"><button className="link" onClick={() => openEdit(v)}>Edit</button><button className="link danger" onClick={() => setAsk(v)}>Delete</button></td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan="9" className="empty">No vehicles yet. Add your first vehicle to start tracking depreciation.</td></tr>}
          </tbody>
        </table>
      </div>

      {modal === "vehicle" && (
        <Modal title={edit ? `Edit ${f.plate}` : "Add vehicle"} onClose={() => setModal(null)}
          footer={<><button className="btn ghost" onClick={() => setModal(null)}>Cancel</button><button className="btn" disabled={!f.plate || !(toCents(f.cost) > 0)} onClick={saveVehicle}>{edit ? "Save changes" : "Add vehicle"}</button></>}>
          <div className="row"><label>Plate<input value={f.plate || ""} onChange={set("plate")} /></label><label>Make<input value={f.make || ""} onChange={set("make")} /></label><label>Model<input value={f.model || ""} onChange={set("model")} /></label></div>
          <div className="row">
            <label>Purchase date<input type="date" disabled={f.locked} value={f.purchaseDate} onChange={set("purchaseDate")} /></label>
            <label>Cost<input type="number" min="0" step="0.01" disabled={f.locked} value={f.cost || ""} onChange={set("cost")} /></label>
            <label>Salvage value<input type="number" min="0" step="0.01" value={f.salvage || ""} onChange={set("salvage")} /></label>
            <label>Life (months)<input type="number" min="1" value={f.life} onChange={set("life")} /></label>
          </div>
          {edit && <label>Status<select value={f.status} onChange={set("status")}>{["available", "rented", "maintenance", "sold"].map((s) => <option key={s}>{s}</option>)}</select></label>}
          {f.locked && <p className="note">Cost and purchase date are locked because depreciation has been posted.</p>}
          {!edit && <label className="check"><input type="checkbox" checked={!!f.record} onChange={set("record")} /> Record the purchase in the journal (debit Vehicles, credit Cash)</label>}
          {err && <p className="err">{err}</p>}
        </Modal>
      )}
      {modal === "dep" && (
        <Modal title="Run monthly depreciation" onClose={() => setModal(null)}
          footer={<><button className="btn ghost" onClick={() => setModal(null)}>Cancel</button><button className="btn" onClick={depreciate}>Post adjusting entry</button></>}>
          <p className="sub">Posts one adjusting entry for every vehicle that is behind, through the month you choose. Missed months are caught up.</p>
          <label>Depreciate through<input type="month" value={f.month} onChange={set("month")} /></label>
          {err && <p className="err">{err}</p>}
        </Modal>
      )}
      {ask && <Confirm title={`Delete ${ask.plate}?`} text="Vehicles with depreciation posted can't be deleted. Mark them as sold instead." action="Delete vehicle" onYes={remove} onClose={() => setAsk(null)} />}
    </>
  );
}
