// Relatório de pagamento da AM Formaturas: cálculos e geração da planilha .xlsx
// no mesmo formato da planilha que o Emerson preenchia à mão.

export const MONTHS = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];


function n(value) {
  const v = Number(value);
  return Number.isFinite(v) ? v : 0;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

export function rates(report) {
  return {
    fuelPrice: n(report?.fuel_price) || 6.3,
    kmPerLiter: n(report?.km_per_liter) || 10,
    wearPerKm: report?.wear_per_km === null || report?.wear_per_km === undefined ? 0.25 : n(report.wear_per_km),
  };
}

export function itemCosts(item, report) {
  const { fuelPrice, kmPerLiter, wearPerKm } = rates(report);
  const km = n(item.km);
  const fuel = (km / kmPerLiter) * fuelPrice;
  const wear = km * wearPerKm;
  const total = n(item.amount) + fuel + wear + n(item.food) + n(item.toll);
  return { fuel: round2(fuel), wear: round2(wear), total: round2(total) };
}

export function reportTotals(items, report) {
  return items.reduce(
    (acc, item) => {
      const c = itemCosts(item, report);
      acc.count += 1;
      acc.amount += n(item.amount);
      acc.travel += c.fuel + c.wear + n(item.toll);
      acc.food += n(item.food);
      acc.km += n(item.km);
      acc.total += c.total;
      return acc;
    },
    { count: 0, amount: 0, travel: 0, food: 0, km: 0, total: 0 },
  );
}

export function sortItems(items) {
  return [...items].sort((a, b) => String(a.work_date || "9999").localeCompare(String(b.work_date || "9999")) || String(a.created_at || "").localeCompare(String(b.created_at || "")));
}

// "OUTUBRO 2026" -> "NOVEMBRO 2026"; se não reconhecer, usa o mês de hoje.
export function nextTitle(title, today = new Date()) {
  const match = String(title || "").toUpperCase().match(/([A-ZÇ]+)\s+(\d{4})/);
  const index = match ? MONTHS.indexOf(match[1]) : -1;
  if (index < 0) return `${MONTHS[today.getMonth()]} ${today.getFullYear()}`;
  const year = Number(match[2]) + (index === 11 ? 1 : 0);
  return `${MONTHS[(index + 1) % 12]} ${year}`;
}

export function reportFileName(report) {
  return `${String(report.number).padStart(3, "0")} - ${String(report.title || "").trim()}.xlsx`;
}

// Cada linha "Rótulo -> valor" (ou "Rótulo: valor") vira uma linha no fim da planilha.
export function paymentLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.*?)\s*(?:-\s*>|->|→|:)\s*(.*)$/);
      if (match && match[1]) return { label: `${match[1].trim()} ->`, value: match[2].trim() };
      return { label: "", value: line };
    });
}

function dateValue(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

const NAVY = "FF1F3864";
const BLUE = "FF2F5496";
const LIGHT = "FFD9E1F2";
const ZEBRA = "FFF5F7FB";
const GRID = "FFBFBFBF";
const MONEY = '"R$" #,##0.00;-"R$" #,##0.00;"–"';
const KM_FMT = '#,##0;-#,##0;"–"';

function brDate(d) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function numBR(value) {
  return String(value).replace(".", ",");
}

// Planilha de pagamento com o mesmo conteúdo da planilha original da AM, numa página A4 deitada.
export async function buildReportWorkbook(ExcelJS, report, items, paymentInfo = "", today = new Date()) {
  const { fuelPrice, kmPerLiter, wearPerKm } = rates(report);
  const month = String(report.title || "").trim().toUpperCase();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Emerson Honorato Retratos";
  wb.calcProperties = { fullCalcOnLoad: true };
  const ws = wb.addWorksheet((month.split(/\s+/)[0] || "RELATORIO").slice(0, 31), {
    views: [{ state: "frozen", ySplit: 4, showGridLines: false }],
    pageSetup: {
      paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
      printTitlesRow: "4:4",
    },
    headerFooter: { oddFooter: `&L&8Relatório ${String(report.number).padStart(3, "0")} - ${month}&R&8Página &P de &N` },
  });
  ws.columns = [12, 12, 22, 34, 13, 8, 11, 13, 12, 13, 14].map((width) => ({ width }));

  const font = (opts = {}) => ({ name: "Calibri", size: 11, color: { argb: "FF1F1F1F" }, ...opts });
  const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
  const line = { style: "thin", color: { argb: GRID } };
  const grid = { top: line, left: line, bottom: line, right: line };
  const center = { horizontal: "center", vertical: "middle" };
  const left = { horizontal: "left", vertical: "middle", indent: 1 };
  const right = { horizontal: "right", vertical: "middle", indent: 1 };

  // Título
  ws.mergeCells("A1:K1");
  const title = ws.getCell("A1");
  title.value = `RELATÓRIO DE PAGAMENTO — ${month}`;
  title.font = font({ size: 16, bold: true, color: { argb: "FFFFFFFF" } });
  title.fill = fill(NAVY);
  title.alignment = center;
  ws.getRow(1).height = 32;

  ws.mergeCells("A2:F2");
  const who = ws.getCell("A2");
  who.value = "Fotógrafo: Emerson Honorato";
  who.font = font({ size: 12, bold: true, color: { argb: NAVY } });
  who.alignment = { horizontal: "left", vertical: "middle" };
  ws.mergeCells("G2:K2");
  const meta = ws.getCell("G2");
  meta.value = `Relatório nº ${String(report.number).padStart(3, "0")} · emitido em ${brDate(today)}`;
  meta.font = font({ size: 10, italic: true, color: { argb: "FF595959" } });
  meta.alignment = right;
  ws.getRow(2).height = 22;
  ws.getRow(3).height = 6;

  // Cabeçalho
  const headers = ["Data", "Contrato", "Local", "Tipo de evento", "Valor", "KM", "Pedágio", "Combustível", "Desgaste", "Alimentação", "Total"];
  const head = ws.getRow(4);
  headers.forEach((text, i) => {
    const cell = head.getCell(i + 1);
    cell.value = text;
    cell.font = font({ bold: true, color: { argb: "FFFFFFFF" } });
    cell.fill = fill(BLUE);
    cell.alignment = { ...center, wrapText: true };
    cell.border = grid;
  });
  head.height = 22;

  // Trabalhos
  const sorted = sortItems(items);
  const first = 5;
  sorted.forEach((item, index) => {
    const r = first + index;
    const c = itemCosts(item, report);
    const row = ws.getRow(r);
    const values = [dateValue(item.work_date), item.contract || "", item.place || "", item.event_type || "", n(item.amount), n(item.km), n(item.toll),
      { formula: `F${r}/${kmPerLiter}*${fuelPrice}`, result: c.fuel }, { formula: `F${r}*${wearPerKm}`, result: c.wear }, n(item.food),
      { formula: `E${r}+G${r}+H${r}+I${r}+J${r}`, result: c.total }];
    values.forEach((value, i) => {
      const cell = row.getCell(i + 1);
      cell.value = value;
      cell.font = font({ bold: i === 10 });
      cell.border = grid;
      if (index % 2 === 1) cell.fill = fill(ZEBRA);
      if (i === 0) { cell.numFmt = "dd/mm/yyyy"; cell.alignment = center; }
      else if (i === 1 || i === 5) { cell.alignment = center; if (i === 5) cell.numFmt = KM_FMT; }
      else if (i === 2 || i === 3) cell.alignment = { ...left, wrapText: true };
      else { cell.numFmt = MONEY; cell.alignment = right; }
    });
    row.height = 18;
  });

  // Total geral
  const last = Math.max(first, first + sorted.length - 1);
  const totalRow = first + sorted.length;
  const totals = reportTotals(sorted, report);
  const sumOf = (col, result) => ({ formula: `SUM(${col}${first}:${col}${last})`, result: round2(result) });
  ws.mergeCells(totalRow, 1, totalRow, 4);
  const tl = ws.getCell(totalRow, 1);
  tl.value = `TOTAL GERAL (${sorted.length} ${sorted.length === 1 ? "trabalho" : "trabalhos"})`;
  const sums = {
    5: sumOf("E", totals.amount), 6: sumOf("F", totals.km), 7: sumOf("G", sorted.reduce((s, i) => s + n(i.toll), 0)),
    8: sumOf("H", sorted.reduce((s, i) => s + itemCosts(i, report).fuel, 0)), 9: sumOf("I", sorted.reduce((s, i) => s + itemCosts(i, report).wear, 0)),
    10: sumOf("J", totals.food), 11: sumOf("K", totals.total),
  };
  for (let col = 1; col <= 11; col += 1) {
    const cell = ws.getCell(totalRow, col);
    if (sums[col]) cell.value = sums[col];
    cell.font = font({ bold: true, size: col === 11 ? 13 : 11, color: { argb: col === 11 ? "FFC00000" : NAVY } });
    cell.fill = fill(LIGHT);
    cell.border = { top: { style: "medium", color: { argb: NAVY } }, bottom: { style: "medium", color: { argb: NAVY } }, left: line, right: line };
    cell.alignment = col === 1 ? left : col === 6 ? center : right;
    cell.numFmt = col === 6 ? KM_FMT : MONEY;
  }
  ws.getRow(totalRow).height = 24;

  // Como foi calculado
  const noteRow = totalRow + 1;
  ws.mergeCells(noteRow, 1, noteRow, 11);
  const note = ws.getCell(noteRow, 1);
  note.value = `Combustível = KM ÷ ${numBR(kmPerLiter)} × R$ ${numBR(fuelPrice.toFixed(2))}   ·   Desgaste = KM × R$ ${numBR(wearPerKm.toFixed(2))}`;
  note.font = font({ size: 9, italic: true, color: { argb: "FF7F7F7F" } });
  note.alignment = { horizontal: "right", vertical: "middle" };

  // Dados para pagamento
  const lines = paymentLines(paymentInfo);
  if (lines.length) {
    const start = noteRow + 2;
    ws.mergeCells(start, 1, start, 6);
    const ph = ws.getCell(start, 1);
    ph.value = "DADOS PARA PAGAMENTO";
    ph.font = font({ bold: true, color: { argb: "FFFFFFFF" } });
    ph.fill = fill(BLUE);
    ph.alignment = left;
    ph.border = grid;
    lines.forEach((entry, i) => {
      const r = start + 1 + i;
      ws.mergeCells(r, 1, r, 2);
      ws.mergeCells(r, 3, r, 6);
      const label = ws.getCell(r, 1);
      label.value = entry.label.replace(/\s*-\s*>\s*$/, "") || "";
      label.font = font({ bold: true, color: { argb: NAVY } });
      label.fill = fill(LIGHT);
      label.alignment = left;
      label.border = grid;
      const value = ws.getCell(r, 3);
      value.value = entry.value;
      value.font = font();
      value.alignment = left;
      value.border = grid;
      ws.getRow(r).height = 18;
    });
  }
  return wb;
}
