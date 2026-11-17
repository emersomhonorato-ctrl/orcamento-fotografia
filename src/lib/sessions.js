// Sessões ligadas a um contrato: pré-wedding (casamento), book (15 anos) e sessões mensais (acompanhamento)
const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export function getSessionPlan(record) {
  if (!record || record.parentEventId || record.recordType === "orcamento" || record.status === "Cancelado") return null;
  const type = normalize(`${record.eventType} ${record.packageName || ""}`);
  if (/acompanhamento|mensal|mesversario/.test(type)) {
    return { kind: "mensal", label: "Sessão mensal", action: "Agendar sessão do mês", multiple: true, askTheme: true };
  }
  if (/15 anos|quinze anos|debutante/.test(type)) {
    return { kind: "book-15", label: "Book de 15 anos", action: "Agendar book de 15 anos", multiple: false, askTheme: false };
  }
  if (/casamento|wedding|noivos/.test(type)) {
    return { kind: "pre-wedding", label: "Ensaio pré-wedding", action: "Agendar pré-wedding", multiple: false, askTheme: false };
  }
  return null;
}

export const SESSION_KIND_LABEL = {
  mensal: "Sessão mensal",
  "book-15": "Book de 15 anos",
  "pre-wedding": "Ensaio pré-wedding",
};

export const MONTHLY_THEME_IDEAS = [
  "Primeiro banho",
  "Dia das Mães",
  "Festa junina",
  "Primavera",
  "Halloween",
  "Natal",
  "Ano Novo",
  "Carnaval",
  "Páscoa",
  "Smash the cake",
];

const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

// Mês a que a sessão mensal se refere ("2026-10"); se não foi escolhido, é o mês da data
export function sessionMonthKey(item) {
  const chosen = String(item?.sessionMonth || "");
  if (/^\d{4}-\d{2}$/.test(chosen)) return chosen;
  return String(item?.eventDate || "").slice(0, 7);
}

export function monthKeyLabel(key) {
  const [y, m] = String(key || "").split("-").map(Number);
  if (!y || !m) return "";
  return `${MONTH_NAMES[m - 1]} de ${y}`;
}

// Meses para escolher: 3 antes e 2 depois do mês de referência (ou da data)
export function sessionMonthOptions(dateKey) {
  const base = /^\d{4}-\d{2}/.test(String(dateKey || "")) ? new Date(`${String(dateKey).slice(0, 7)}-15T12:00:00`) : new Date();
  const out = [];
  for (let i = -3; i <= 2; i += 1) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}
