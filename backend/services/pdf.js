// PDF renderer styled like classic accounting worksheets:
// navy banner, light-blue header row, dotted row lines, boxed tables.
import PDFDocument from "pdfkit";

export const money = (c) =>
  (c / 100).toLocaleString("en-US", { style: "currency", currency: process.env.CURRENCY || "USD" });
const num = (c) => (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtN = (c, paren) => (paren && c < 0 ? `(${num(-c)})` : num(c));

const NAVY = "#12335B", SKY = "#C9E8FF", BAND = "#D6ECFB", DOT = "#8b98a8", INK = "#10243E";
const X = 40, TOP = 40;
let W = 515, LIMIT = 770, PAGE_H = 842; // set per document (landscape changes them)
const pad2 = (n) => String(n).padStart(2, "0");

/* ---------- banners ---------- */

function banner(S) {
  const { pdf, doc } = S;
  const split = doc.banner === "split";
  const h = split ? 80 : 110;
  pdf.rect(X, TOP, W, h).fill(NAVY);
  pdf.fillColor("#fff").font("Helvetica-Bold").fontSize(doc.company.length > 34 ? 15 : 20)
    .text(doc.company.toUpperCase(), X, TOP + 16, { width: W, align: "center", lineBreak: false });
  if (split) {
    pdf.font("Helvetica").fontSize(10).text(doc.subtitle || "", X, TOP + 42, { width: W, align: "center", lineBreak: false });
    pdf.font("Helvetica-Bold").fontSize(12).text(doc.title, X + 16, TOP + h - 26, { lineBreak: false });
    pdf.font("Helvetica").fontSize(10).text("Page No. 01", X, TOP + h - 24, { width: W - 16, align: "right", lineBreak: false });
  } else {
    pdf.font("Helvetica-Bold").fontSize(15).text(doc.title, X, TOP + 45, { width: W, align: "center", lineBreak: false });
    pdf.fontSize(11.5).text(doc.subtitle || "", X, TOP + 67, { width: W, align: "center", lineBreak: false });
    pdf.font("Helvetica-Oblique").fontSize(10).text(`(Amounts in ${process.env.CURRENCY || "USD"})`, X, TOP + 87, { width: W, align: "center", lineBreak: false });
  }
  return TOP + h + 16;
}

function newPage(S) {
  const { pdf, doc } = S;
  pdf.addPage();
  S.n += 1;
  pdf.rect(X, TOP, W, 26).fill(NAVY);
  pdf.fillColor("#fff").font("Helvetica-Bold").fontSize(10)
    .text(`${doc.company.toUpperCase()}  |  ${doc.title}`, X + 12, TOP + 8, { width: W - 120, lineBreak: false, ellipsis: true });
  pdf.font("Helvetica").text(`Page No. ${pad2(S.n)}`, X, TOP + 8, { width: W - 12, align: "right", lineBreak: false });
  return TOP + 26 + 14;
}

/* ---------- table ---------- */

function verticals(pdf, pos, top, bottom, skips) {
  pdf.lineWidth(0.6).strokeColor(NAVY);
  for (let i = 1; i < pos.length; i++) {
    let start = top;
    const cuts = skips.filter((s) => (s.cols ? s.cols.has(i) : i < s.upTo)).sort((a, b) => a.a - b.a);
    for (const s of cuts) {
      if (s.a > start) pdf.moveTo(pos[i].x, start).lineTo(pos[i].x, s.a).stroke();
      start = s.b;
    }
    if (bottom > start) pdf.moveTo(pos[i].x, start).lineTo(pos[i].x, bottom).stroke();
  }
}

function table(S, b, y) {
  const { pdf } = S;
  const cols = b.columns;
  const tw = cols.reduce((s, c) => s + (c.w || 1), 0);
  let cx = X;
  const pos = cols.map((c) => {
    const w = ((c.w || 1) / tw) * W;
    const p = { x: cx, w };
    cx += w;
    return p;
  });
  const GH = b.groups ? 22 : 0, HEAD = b.headHeight || 30, ROW = 20;
  const many = cols.length > 12;
  let gi = 0;
  const groups = (b.groups || []).map((g) => { const o = { ...g, from: gi }; gi += g.span; return o; });
  let top = y, skips = [];

  const head = () => {
    top = y; skips = [];
    if (GH) {
      pdf.rect(X, y, W, GH).fill("#A9D4F5");
      const interior = new Set();
      for (const g of groups) {
        const x0 = pos[g.from].x, last = pos[g.from + g.span - 1];
        pdf.font("Helvetica-Bold").fontSize(9).fillColor(INK).text(g.label, x0 + 4, y + 7, { width: last.x + last.w - x0 - 8, align: "center", lineBreak: false });
        for (let k = g.from + 1; k < g.from + g.span; k++) interior.add(k);
      }
      skips.push({ a: y, b: y + GH, cols: interior });
      y += GH;
    }
    pdf.rect(X, y, W, HEAD).fill(SKY);
    cols.forEach((c, i) => {
      const t = c.label.toUpperCase();
      pdf.font("Helvetica-Bold").fontSize(many ? 7 : 8).fillColor(INK);
      const h = pdf.heightOfString(t, { width: pos[i].w - 8 });
      pdf.text(t, pos[i].x + 4, y + Math.max(2, (HEAD - h) / 2), { width: pos[i].w - 8, align: "center" });
    });
    y += HEAD;
  };
  const close = () => {
    verticals(pdf, pos, top, y, skips);
    pdf.lineWidth(1.2).strokeColor(NAVY).rect(X, top, W, y - top).stroke();
    pdf.lineWidth(1).moveTo(X, top + GH + HEAD).lineTo(X + W, top + GH + HEAD).stroke();
    if (GH) pdf.moveTo(X, top + GH).lineTo(X + W, top + GH).stroke();
  };
  const room = (h) => {
    if (y + h > LIMIT) { close(); y = newPage(S); head(); }
  };
  const fs = many ? 7.5 : 9;

  head();
  for (const r of b.rows) {
    room(ROW);
    if (r.band) {
      pdf.rect(X + 0.6, y, W - 1.2, ROW).fill(BAND);
      pdf.font("Helvetica").fontSize(8.5).fillColor(INK)
        .text(r.band, pos[1].x + 6, y + 6, { width: W - (pos[1].x - X) - 12, lineBreak: false, ellipsis: true });
      skips.push({ a: y, b: y + ROW, upTo: cols.length });
      y += ROW;
      continue;
    }
    cols.forEach((c, i) => {
      const v = r[c.key];
      if (v == null || v === "") return;
      const ind = r.indent && c.indent ? 14 : 0;
      pdf.font(r.bold ? "Helvetica-Bold" : "Helvetica").fontSize(fs).fillColor(INK)
        .text(c.money ? fmtN(v, c.paren) : String(v), pos[i].x + 4 + ind, y + 6, {
          width: pos[i].w - 8 - ind, align: c.align || (c.money ? "right" : "left"), lineBreak: false, ellipsis: true,
        });
    });
    pdf.lineWidth(0.5).strokeColor(DOT).dash(1, { space: 2 }).moveTo(X, y + ROW).lineTo(X + W, y + ROW).stroke().undash();
    y += ROW;
  }

  if (b.footer) {
    room(ROW + 2);
    const f = b.footer, span = f.span || 0;
    pdf.lineWidth(1).strokeColor(NAVY).moveTo(X, y).lineTo(X + W, y).stroke();
    if (span) {
      skips.push({ a: y, b: y + ROW + 2, upTo: span });
      pdf.font("Helvetica-Bold").fontSize(10).fillColor(INK)
        .text(f.label, X + 4, y + 6, { width: pos[span - 1].x + pos[span - 1].w - X - 8, align: "center", lineBreak: false });
    }
    cols.forEach((c, i) => {
      if (i < span || f[c.key] == null) return;
      pdf.font("Helvetica-Bold").fontSize(many ? 8 : 9.5).fillColor(INK)
        .text(c.money ? fmtN(f[c.key], c.paren) : String(f[c.key]), pos[i].x + 4, y + 6, { width: pos[i].w - 8, align: c.align || (c.money ? "right" : "left"), lineBreak: false });
    });
    y += ROW + 2;
  }
  close();
  return y + 16;
}

/* ---------- statements (label + amount rows) ---------- */

function lines(S, b, y) {
  const { pdf } = S;
  const AMT = 140, ROW = 19;
  let top = y;
  const close = () => {
    pdf.lineWidth(1.2).strokeColor(NAVY).rect(X, top, W, y - top).stroke();
    pdf.lineWidth(0.6).moveTo(X + W - AMT, top).lineTo(X + W - AMT, y).stroke();
  };
  for (const r of b.rows) {
    if (y + ROW > LIMIT) { close(); y = newPage(S); top = y; }
    if (!r.label && r.amount == null) {
      y += 8;
      continue;
    }
    const ind = (r.indent || 0) * 16;
    if (r.heading) {
      pdf.rect(X + 0.6, y, W - 1.2, ROW + 3).fill(SKY);
      pdf.font("Helvetica-Bold").fontSize(9.5).fillColor(INK).text(r.label.toUpperCase(), X + 10, y + 7, { width: W - 20, lineBreak: false });
      y += ROW + 3;
      continue;
    }
    pdf.font(r.bold ? "Helvetica-Bold" : "Helvetica").fontSize(9.5).fillColor(INK)
      .text(r.label, X + 10 + ind, y + 5, { width: W - AMT - 20 - ind, lineBreak: false, ellipsis: true });
    if (r.amount != null)
      pdf.text(fmtN(r.amount, true), X + W - AMT + 6, y + 5, { width: AMT - 16, align: "right", lineBreak: false });
    if (r.rule) pdf.lineWidth(1).strokeColor(NAVY).moveTo(X, y).lineTo(X + W, y).stroke();
    pdf.lineWidth(0.5).strokeColor(DOT).dash(1, { space: 2 }).moveTo(X, y + ROW).lineTo(X + W, y + ROW).stroke().undash();
    y += ROW;
  }
  close();
  return y + 16;
}

/* ---------- entry point ---------- */

export function sendPdf(res, doc, filename) {
  const land = !!doc.landscape;
  W = land ? 762 : 515; LIMIT = land ? 525 : 770; PAGE_H = land ? 595 : 842;
  const pdf = new PDFDocument({ size: "A4", layout: land ? "landscape" : "portrait", margin: 0, bufferPages: true });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);
  pdf.pipe(res);

  const S = { pdf, doc, n: 1 };
  let y = banner(S);

  for (const b of doc.blocks) {
    if (b.type === "table") y = table(S, b, y);
    else if (b.type === "lines") y = lines(S, b, y);
    else if (b.type === "bar") {
      if (y > LIMIT - 130) y = newPage(S);
      pdf.rect(X, y, W, 32).fill(NAVY);
      pdf.fillColor("#fff").font("Helvetica").fontSize(12).text(b.left, X + 14, y + 10, { lineBreak: false });
      pdf.fontSize(10.5).text(b.right || "", X, y + 11, { width: W - 14, align: "right", lineBreak: false });
      y += 44;
    } else if (b.type === "heading") {
      pdf.font("Helvetica-Bold").fontSize(11).fillColor(INK).text(b.text, X, y, { lineBreak: false });
      y += 20;
    } else if (b.type === "note") {
      if (y > LIMIT) y = newPage(S);
      pdf.font("Helvetica-Oblique").fontSize(9).fillColor(b.ok === false ? "#b00020" : b.ok ? "#1c7a4b" : "#555")
        .text(b.text, X, y, { width: W, lineBreak: false });
      y += 22;
    }
  }

  const range = pdf.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    pdf.switchToPage(i);
    pdf.font("Helvetica").fontSize(8).fillColor("#7a8794")
      .text(`Generated ${new Date().toISOString().slice(0, 10)}`, X, PAGE_H - 32, { lineBreak: false });
    pdf.text(`Page ${i + 1} of ${range.count}`, X, PAGE_H - 32, { width: W, align: "right", lineBreak: false });
  }
  pdf.end();
}
