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
