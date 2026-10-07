import { fmt } from "./api.js";

function Block({ b }) {
  if (b.type === "heading") return <h3>{b.text}</h3>;
  if (b.type === "note") return <p className={`note ${b.ok === false ? "bad" : b.ok ? "good" : ""}`}>{b.text}</p>;
  if (b.type === "lines")
    return (
      <div className="stmt">
        {b.rows.map((r, i) => (
          <div key={i} className={`ln ${r.heading ? "head" : ""} ${r.bold ? "bold" : ""} ${r.rule ? "rule" : ""}`} style={{ paddingLeft: (r.indent || 0) * 20 }}>
            <span>{r.label}</span>
            <span className="num">{r.amount != null ? fmt(r.amount) : ""}</span>
          </div>
        ))}
      </div>
    );
  if (b.type === "bar") return <div className="bar-head"><span>{b.left}</span><span>{b.right}</span></div>;
  const cell = (c, row) => {
    const v = row[c.key];
    if (c.money) return <td key={c.key} className="num">{c.paren && v < 0 ? `(${fmt(-v)})` : fmt(v)}</td>;
    return <td key={c.key} className={c.align === "center" ? "ctr" : ""} style={row.indent && c.indent ? { paddingLeft: 30 } : undefined}>{v}</td>;
  };
  const f = b.footer;
  return (
    <div className="scroll rpt">
      <table>
        <thead>{b.groups && <tr className="grp">{b.groups.map((g, i) => <th key={i} colSpan={g.span}>{g.label}</th>)}</tr>}<tr>{b.columns.map((c) => <th key={c.key} className={c.money ? "num" : c.align === "center" ? "ctr" : ""}>{c.label}</th>)}</tr></thead>
        <tbody>
          {b.rows.map((r, i) =>
            r.band ? <tr key={i} className="band"><td colSpan={b.columns.length}>{r.band}</td></tr>
              : <tr key={i} className={r.bold ? "bold" : ""}>{b.columns.map((c) => cell(c, r))}</tr>)}
        </tbody>
        {f && <tfoot><tr>{f.span ? <td colSpan={f.span} className="ctr">{f.label}</td> : null}{b.columns.slice(f.span || 0).map((c) => cell(c, f))}</tr></tfoot>}
      </table>
    </div>
  );
}

export default function ReportView({ doc }) {
  return (
    <article className="sheet">
      <p className="co">{doc.company}</p>
      <h1>{doc.title}</h1>
      <p className="sub">{doc.subtitle}</p>
      {doc.blocks.map((b, i) => <Block key={i} b={b} />)}
    </article>
  );
}
