const token = () => localStorage.getItem("token");

export async function api(path, { method = "GET", body } = {}) {
  const r = await fetch("/api" + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token() && { Authorization: `Bearer ${token()}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && token()) { localStorage.clear(); location.reload(); }
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}

export async function downloadPdf(path, filename) {
  const r = await fetch("/api" + path, { headers: { Authorization: `Bearer ${token()}` } });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Couldn't create the PDF");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(await r.blob());
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export const toCents = (v) => Math.round(parseFloat(v || 0) * 100);
export const fmt = (c) => (c == null ? "" : (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" }));
export const today = () => new Date().toISOString().slice(0, 10);
export const yearStart = () => `${new Date().getFullYear()}-01-01`;
