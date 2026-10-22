// Utilidades da agenda online de ensaios (ex.: Natal 2026)

export const BOOKING_CAMPAIGN_ID = "natal-2026";

export function pad2(value) {
  return String(value).padStart(2, "0");
}

/** "2026-11-07" no fuso de quem está vendo */
export function localDateKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** "14:30" no fuso de quem está vendo */
export function localTime(value) {
  const date = new Date(value);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function addMinutesToTime(time, minutes) {
  const [h, m] = String(time).split(":").map(Number);
  const total = h * 60 + m + Number(minutes || 0);
  return `${pad2(Math.floor(total / 60) % 24)}:${pad2(total % 60)}`;
}

export function weekdayLabel(dateKey, style = "long") {
  const date = new Date(`${dateKey}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", { weekday: style }).format(date);
}

export function dayMonthLabel(dateKey) {
  const date = new Date(`${dateKey}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date).replace(".", "");
}

export function capitalize(text) {
  const value = String(text || "");
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function fullDateLabel(dateKey) {
  const [y, m, d] = dateKey.split("-");
  return `${capitalize(weekdayLabel(dateKey))}, ${d}/${m}/${y}`;
}

export function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

/** Agrupa horários por dia: { "2026-11-07": [slot, ...] } em ordem */
export function groupSlotsByDay(slots = []) {
  const map = new Map();
  [...slots]
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
    .forEach((slot) => {
      const key = localDateKey(slot.starts_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(slot);
    });
  return map;
}

/**
 * Gera os horários (em ISO com fuso local) entre duas datas, nos dias da semana escolhidos.
 * weekdays: [0..6] (0 = domingo). Pausa opcional (ex.: almoço).
 */
export function buildSlotTimes({ startDate, endDate, weekdays, startTime, endTime, slotMinutes, breakStart, breakEnd }) {
  const result = [];
  const toMinutes = (t) => {
    const [h, m] = String(t || "").split(":").map(Number);
    return Number.isFinite(h) ? h * 60 + (m || 0) : null;
  };
  const dayStart = toMinutes(startTime);
  const dayEnd = toMinutes(endTime);
  const pauseStart = toMinutes(breakStart);
  const pauseEnd = toMinutes(breakEnd);
  const step = Number(slotMinutes || 30);
  if (dayStart === null || dayEnd === null || dayEnd <= dayStart || step <= 0) return result;

  const cursor = new Date(`${startDate}T12:00:00`);
  const last = new Date(`${endDate}T12:00:00`);
  while (cursor <= last) {
    if (weekdays.includes(cursor.getDay())) {
      for (let minute = dayStart; minute + step <= dayEnd; minute += step) {
        const inPause = pauseStart !== null && pauseEnd !== null && minute < pauseEnd && minute + step > pauseStart;
        if (inPause) continue;
        const slot = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), Math.floor(minute / 60), minute % 60, 0);
        result.push(slot.toISOString());
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

// O Supabase entrega no máximo 1000 linhas por consulta; busca em páginas.
export async function fetchAllRows(build, pageSize = 1000) {
  let all = [];
  for (let from = 0; from < 50000; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) return { data: null, error };
    all = all.concat(data || []);
    if (!data || data.length < pageSize) break;
  }
  return { data: all, error: null };
}

// Emoji do tema conforme o nome do ensaio (Natal, Dia das Mães, Páscoa...)
export function themeEmoji(title = "") {
  const t = String(title).toLowerCase();
  if (t.includes("natal")) return "🎄";
  if (t.includes("mãe") || t.includes("mae")) return "💐";
  if (t.includes("páscoa") || t.includes("pascoa")) return "🐰";
  if (t.includes("pai")) return "👔";
  if (t.includes("namorad")) return "❤️";
  if (t.includes("criança") || t.includes("crianca")) return "🎈";
  return "📸";
}
