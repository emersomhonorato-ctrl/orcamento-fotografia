// Fotógrafos do estúdio e quem vai em cada agendamento
export const PHOTOGRAPHERS = [
  { id: "emerson", name: "Emerson Honorato", short: "Emerson" },
  { id: "isabel", name: "Isabel Honorato", short: "Isabel" },
];

export const PHOTOGRAPHER_OPTIONS = [
  { value: "emerson", label: "Emerson" },
  { value: "isabel", label: "Isabel" },
  { value: "ambos", label: "Os dois" },
];

export function photographerLabel(value, { long = false } = {}) {
  if (value === "ambos") return long ? "Emerson e Isabel Honorato" : "Emerson e Isabel";
  const person = PHOTOGRAPHERS.find((item) => item.id === value);
  if (!person) return "";
  return long ? person.name : person.short;
}

// true se o agendamento é de quem está no filtro ("emerson" inclui "ambos")
export function matchesPhotographer(value, filter) {
  if (!filter || filter === "todos") return true;
  if (filter === "sem") return !value;
  return value === filter || value === "ambos";
}

function activeOn(events, date, excludeId) {
  return (events || []).filter(
    (event) => event && event.id !== excludeId && event.eventDate === date && event.status !== "Cancelado" && (event.recordType || "evento") === "evento",
  );
}

// Quem já está ocupado no dia: { emerson: [eventos], isabel: [eventos] }
export function busyOnDate(events, date, excludeId) {
  const result = { emerson: [], isabel: [] };
  if (!date) return result;
  activeOn(events, date, excludeId).forEach((event) => {
    if (event.photographer === "emerson" || event.photographer === "ambos") result.emerson.push(event);
    if (event.photographer === "isabel" || event.photographer === "ambos") result.isabel.push(event);
  });
  return result;
}

export function isDayFull(events, date, excludeId) {
  const busy = busyOnDate(events, date, excludeId);
  return busy.emerson.length > 0 && busy.isabel.length > 0;
}

export function fullDays(events) {
  const dates = new Set((events || []).map((event) => event?.eventDate).filter(Boolean));
  return new Set([...dates].filter((date) => isDayFull(events, date)));
}
