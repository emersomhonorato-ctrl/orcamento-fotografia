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
