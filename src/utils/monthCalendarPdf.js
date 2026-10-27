import jsPDF from "jspdf";
import { addPdfImageFit } from "./pdfDocuments";

const W = 297;
const H = 210;
const M = 10;
const NAVY = [27, 22, 16];
const INK = [28, 25, 23];
const MUTED = [120, 113, 108];
const LINE = [231, 229, 228];
const SOFT = [250, 250, 249];
const PALETTE = [
  [[253, 242, 248], [157, 23, 77]],
  [[239, 246, 255], [30, 64, 175]],
  [[240, 253, 244], [21, 128, 61]],
  [[255, 247, 237], [194, 65, 12]],
  [[245, 243, 255], [91, 33, 182]],
  [[236, 254, 255], [14, 116, 144]],
  [[254, 252, 232], [161, 98, 7]],
];
const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function colorForType(type = "") {
  let hash = 0;
  for (const char of String(type)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

const pad = (n) => String(n).padStart(2, "0");
const brl = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateBR = (iso) => (iso ? iso.split("-").reverse().join("/") : "");

export function monthTitle(year, month) {
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, month, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function eventsOfMonth(events, year, month) {
  const prefix = `${year}-${pad(month + 1)}-`;
  return (events || [])
    .filter((event) => event && event.status !== "Cancelado" && String(event.eventDate || "").startsWith(prefix))
    .sort((a, b) => `${a.eventDate} ${a.startTime || "99:99"}`.localeCompare(`${b.eventDate} ${b.startTime || "99:99"}`));
}

function fit(doc, text, maxWidth) {
  let value = String(text || "");
  if (doc.getTextWidth(value) <= maxWidth) return value;
  while (value.length > 1 && doc.getTextWidth(`${value}…`) > maxWidth) value = value.slice(0, -1);
  return `${value.trimEnd()}…`;
}

function header(doc, settings, title, subtitle) {
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 16, "F");
  let x = M;
  if (settings.logoDataUrl) {
    const placed = addPdfImageFit(doc, settings.logoDataUrl, M, 2.5, 11, 11, "cal-logo");
    if (placed) x = M + placed.w + 4;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(settings.studioName || "Emerson Honorato Retratos", x, 9.8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(title, W - M, 8.6, { align: "right" });
  if (subtitle) {
    doc.setFontSize(7.5);
    doc.setTextColor(200, 192, 182);
    doc.text(subtitle, W - M, 13, { align: "right" });
  }
}

function footer(doc, page, total) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  const stamp = new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  doc.text(`Gerado em ${stamp}`, M, H - 5);
  doc.text(`Página ${page} de ${total}`, W - M, H - 5, { align: "right" });
}

export function buildMonthCalendarPdf({ events, year, month, settings = {}, includeValues = false, includePhones = false }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const list = eventsOfMonth(events, year, month);
  const title = monthTitle(year, month);
  const subtitle = `${list.length} compromisso${list.length === 1 ? "" : "s"}`;

  // ---------- Página 1: calendário ----------
  header(doc, settings, `Agenda — ${title}`, subtitle);
  const firstWeekday = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const rows = Math.ceil((firstWeekday + days) / 7);
  const top = 22;
  const headH = 6;
  const gridW = W - M * 2;
  const colW = gridW / 7;
  const rowH = (H - 12 - top - headH) / rows;
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  WEEKDAYS.forEach((name, index) => doc.text(name, M + index * colW + colW / 2, top + 4, { align: "center" }));

  const byDay = new Map();
  list.forEach((event) => {
    const key = event.eventDate;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(event);
  });

  for (let cell = 0; cell < rows * 7; cell += 1) {
    const day = cell - firstWeekday + 1;
    const col = cell % 7;
    const row = Math.floor(cell / 7);
    const x = M + col * colW;
    const y = top + headH + row * rowH;
    const inMonth = day >= 1 && day <= days;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    if (!inMonth) {
      doc.setFillColor(...SOFT);
      doc.rect(x, y, colW, rowH, "FD");
      continue;
    }
    doc.setFillColor(255, 255, 255);
    doc.rect(x, y, colW, rowH, "FD");
    const iso = `${year}-${pad(month + 1)}-${pad(day)}`;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    if (iso === todayIso) {
      doc.setFillColor(...NAVY);
      doc.circle(x + 4.6, y + 4, 3, "F");
      doc.setTextColor(255, 255, 255);
      doc.text(String(day), x + 4.6, y + 5.1, { align: "center" });
    } else {
      doc.setTextColor(...INK);
      doc.text(String(day), x + 2.2, y + 5.1);
    }

    const items = byDay.get(iso) || [];
    const chipH = 6.6;
    const room = Math.max(0, Math.floor((rowH - 8.5) / (chipH + 0.8)));
    const shown = items.length > room ? Math.max(0, room - 1) : items.length;
    items.slice(0, shown).forEach((event, index) => {
      const cy = y + 7.6 + index * (chipH + 0.8);
      const [bg, fg] = colorForType(event.eventType);
      doc.setFillColor(...bg);
      doc.roundedRect(x + 1, cy, colW - 2, chipH, 1, 1, "F");
      doc.setFillColor(...fg);
      doc.rect(x + 1, cy, 0.8, chipH, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.4);
      doc.setTextColor(...fg);
      const time = event.startTime ? `${event.startTime} ` : "";
      doc.text(fit(doc, `${time}${event.clientName || "Cliente"}`, colW - 5), x + 2.6, cy + 2.7);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.8);
      doc.setTextColor(...INK);
      const detail = [event.eventType, event.sessionTheme].filter(Boolean).join(" — ");
      doc.text(fit(doc, detail, colW - 5), x + 2.6, cy + 5.4);
    });
    if (items.length > shown) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.2);
      doc.setTextColor(...MUTED);
      doc.text(`+${items.length - shown} (ver lista)`, x + 2.2, y + rowH - 1.6);
    }
  }

  // ---------- Página 2+: lista detalhada ----------
  const columns = [
    { key: "date", label: "Data", w: 24 },
    { key: "time", label: "Horário", w: 22 },
    { key: "client", label: "Cliente", w: 52 },
    { key: "type", label: "Trabalho", w: 58 },
    { key: "place", label: "Local", w: 0 },
  ];
  if (includePhones) columns.push({ key: "phone", label: "WhatsApp", w: 32 });
  if (includeValues) columns.push({ key: "value", label: "Valor", w: 26 }, { key: "paid", label: "Pago", w: 26 });
  const fixed = columns.reduce((sum, c) => sum + c.w, 0);
  columns.find((c) => c.key === "place").w = Math.max(30, gridW - fixed);

  const startList = () => {
    doc.addPage("a4", "landscape");
    header(doc, settings, `Agenda — ${title}`, "Lista dos compromissos");
    let cx = M;
    doc.setFillColor(...SOFT);
    doc.rect(M, 22, gridW, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    columns.forEach((c) => {
      doc.text(c.label, cx + 2, 26.8);
      cx += c.w;
    });
    return 29;
  };

  let y = startList();
  if (!list.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text("Nenhum compromisso neste mês.", M + 2, y + 10);
  }
  const rowHeight = 7.2;
  list.forEach((event, index) => {
    if (y + rowHeight > H - 12) y = startList();
    if (index % 2 === 1) {
      doc.setFillColor(252, 252, 251);
      doc.rect(M, y, gridW, rowHeight, "F");
    }
    const [, fg] = colorForType(event.eventType);
    doc.setFillColor(...fg);
    doc.rect(M, y + 1.4, 0.8, rowHeight - 2.8, "F");
    const weekday = WEEKDAYS[new Date(`${event.eventDate}T12:00:00`).getDay()].slice(0, 3).toLowerCase();
    const values = {
      date: `${dateBR(event.eventDate)} ${weekday}`,
      time: [event.startTime, event.endTime].filter(Boolean).join(" – ") || "A combinar",
      client: event.clientName || "",
      type: [event.eventType, event.sessionTheme].filter(Boolean).join(" — "),
      place: event.location || "A combinar",
      phone: event.whatsapp || event.phone || "",
      value: brl(event.computedAmount ?? event.amount),
      paid: brl(event.amountPaid),
    };
    let cx = M;
    columns.forEach((c) => {
      doc.setFont("helvetica", c.key === "client" ? "bold" : "normal");
      doc.setFontSize(8);
      doc.setTextColor(...INK);
      doc.text(fit(doc, values[c.key], c.w - 4), cx + 2, y + 4.8);
      cx += c.w;
    });
    doc.setDrawColor(...LINE);
    doc.line(M, y + rowHeight, M + gridW, y + rowHeight);
    y += rowHeight;
  });

  if (includeValues && list.length) {
    const total = list.reduce((sum, e) => sum + Number(e.computedAmount ?? e.amount ?? 0), 0);
    const paid = list.reduce((sum, e) => sum + Number(e.amountPaid || 0), 0);
    if (y + 10 > H - 12) y = startList();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text(`Total do mês: ${brl(total)}   •   Recebido: ${brl(paid)}   •   A receber: ${brl(total - paid)}`, W - M, y + 7, { align: "right" });
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    footer(doc, page, pages);
  }
  const fileName = `agenda-${year}-${pad(month + 1)}.pdf`;
  return { doc, fileName };
}
