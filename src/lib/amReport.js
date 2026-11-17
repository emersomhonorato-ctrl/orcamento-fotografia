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

const TEMPLATE_ROWS = 26; // linhas 3 a 28 do modelo
const FIRST_ROW = 3;

// Preenche uma cópia do modelo (a planilha original do Emerson, sem os dados bancários),
// para o arquivo sair com a mesma formatação.
export async function buildReportWorkbook(ExcelJS, report, items, paymentInfo, templateBuffer) {
  const { fuelPrice, kmPerLiter, wearPerKm } = rates(report);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBuffer);
  wb.calcProperties = { ...(wb.calcProperties || {}), fullCalcOnLoad: true };
  const ws = wb.worksheets[0];
  const month = String(report.title || "").trim().toUpperCase();
  ws.name = (month.split(/\s+/)[0] || "RELATORIO").slice(0, 31);

  const sorted = sortItems(items);
  const extra = Math.max(0, sorted.length - TEMPLATE_ROWS);
  if (extra) ws.duplicateRow(FIRST_ROW + TEMPLATE_ROWS - 1, extra, true);
  const lastRow = FIRST_ROW + TEMPLATE_ROWS - 1 + extra;
  const totalRow = lastRow + 1;
  const offset = extra;

  ws.getCell("A1").value = `RELATÓRIO DE PAGAMENTO -  MÊS DE ${month}`;

  for (let r = FIRST_ROW; r <= lastRow; r += 1) {
    const item = sorted[r - FIRST_ROW];
    const c = item ? itemCosts(item, report) : { fuel: 0, wear: 0, total: 0 };
    const row = ws.getRow(r);
    row.getCell(1).value = item ? dateValue(item.work_date) : null;
    row.getCell(2).value = item ? item.contract || "" : null;
    row.getCell(3).value = item ? item.place || "" : null;
    row.getCell(4).value = item ? item.event_type || "" : null;
    row.getCell(5).value = item ? n(item.amount) : 0;
    row.getCell(6).value = item ? n(item.km) : 0;
    row.getCell(7).value = item ? n(item.toll) : 0;
    row.getCell(8).value = { formula: `F${r}/${kmPerLiter}*${fuelPrice}`, result: c.fuel };
    row.getCell(9).value = { formula: `F${r}*${wearPerKm}`, result: c.wear };
    row.getCell(10).value = item ? n(item.food) : 0;
    row.getCell(11).value = { formula: `SUM(E${r}+H${r}+I${r}+J${r})+G${r}`, result: c.total };
  }

  const grandTotal = round2(sorted.reduce((sum, item) => sum + itemCosts(item, report).total, 0));
  ws.getCell(totalRow, 11).value = { formula: `SUM(K2:K${lastRow})`, result: grandTotal };

  const lines = paymentLines(paymentInfo);
  if (lines.length) {
    const first = 32 + offset;
    for (let i = 0; i < 7; i += 1) {
      const line = lines[i];
      ws.getCell(first + i, 4).value = line ? line.label : null;
      ws.getCell(first + i, 5).value = line ? line.value : null;
    }
  }
  return wb;
}
