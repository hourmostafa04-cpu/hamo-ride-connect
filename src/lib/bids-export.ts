import type { Bid, Load } from "./hamoula-store";

export type ExportRow = {
  status: string;
  price: number;
  date: string;
  time: string;
  truck: string;
  cargo: string;
  route: string;
  shipper: string;
};

const statusLabel: Record<Bid["status"], string> = {
  pending: "قيد المراجعة",
  accepted: "مقبول",
  declined: "مرفوض",
};

export function buildRows(bids: Bid[], loads: Load[]): ExportRow[] {
  return bids.map((b) => {
    const l = loads.find((x) => x.id === b.loadId) ?? null;
    const d = new Date(b.createdAt);
    return {
      status: statusLabel[b.status],
      price: b.price,
      date: d.toLocaleDateString("fr-MA"),
      time: d.toLocaleTimeString("fr-MA", { hour: "2-digit", minute: "2-digit" }),
      truck: b.truck || "—",
      cargo: l?.cargo || "—",
      route: l ? `${l.pickup || "—"} ➔ ${l.destination || "—"}` : "—",
      shipper: l?.shipper || "—",
    };
  });
}

const HEADERS = [
  "الحالة",
  "الثمن (درهم)",
  "التاريخ",
  "الساعة",
  "نوع الشاحنة",
  "نوع الحمولة",
  "خط السير",
  "مول السلعة",
];

function cells(r: ExportRow) {
  return [r.status, String(r.price), r.date, r.time, r.truck, r.cargo, r.route, r.shipper];
}

export function downloadCsv(rows: ExportRow[], filename = "hamoula-bids.csv") {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [HEADERS, ...rows.map(cells)].map((r) => r.map(esc).join(",")).join("\r\n");
  // BOM keeps Arabic readable in Excel.
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Opens a print-ready RTL sheet; the browser dialog saves it as PDF. */
export function printPdf(rows: ExportRow[], driverName: string) {
  const escHtml = (v: string) =>
    v.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
  const body = rows
    .map((r) => `<tr>${cells(r).map((c) => `<td>${escHtml(c)}</td>`).join("")}</tr>`)
    .join("");
  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<title>سجل العروض — حمولة</title>
<style>
body{font-family:"Cairo",system-ui,sans-serif;padding:24px;color:#14281d}
h1{font-size:20px;margin:0 0 4px}
p{margin:0 0 16px;color:#5b6b60;font-size:12px}
table{width:100%;border-collapse:collapse;font-size:12px}
th,td{border:1px solid #cfe0d4;padding:8px;text-align:right}
th{background:#e8f5ec}
</style></head><body>
<h1>سجل العروض — حمولة</h1>
<p>${escHtml(driverName)} · ${escHtml(new Date().toLocaleString("fr-MA"))} · ${rows.length} عرض</p>
<table><thead><tr>${HEADERS.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
  return true;
}
