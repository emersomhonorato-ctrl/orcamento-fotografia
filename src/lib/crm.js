// CRM: etapas do funil, origens e etiquetas sugeridas
export const STAGES = [
  ["novo", "Novo contato", "border-sky-300 bg-sky-50"],
  ["conversa", "Em conversa", "border-indigo-300 bg-indigo-50"],
  ["orcamento", "Orçamento enviado", "border-amber-300 bg-amber-50"],
  ["negociacao", "Negociando", "border-orange-300 bg-orange-50"],
  ["fechado", "Fechou", "border-emerald-300 bg-emerald-50"],
  ["perdido", "Perdido", "border-stone-300 bg-stone-100"],
];
export const SOURCES = ["Instagram", "Indicação", "Google", "WhatsApp", "Facebook", "Já é cliente", "Evento / feira", "Site", "Outro"];
export const TAG_SUGESTOES = ["VIP", "Gestante", "Newborn", "Casamento", "15 anos", "Família", "Mês a mês", "Corporativo", "Indicou alguém", "Pediu desconto"];

export const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const semAcento = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Etapa automática (quando você ainda não moveu o cliente no quadro)
export function etapaAutomatica(registros = []) {
  if (registros.some((r) => r.recordType !== "orcamento" && r.status !== "Cancelado")) return "fechado";
  const abertos = registros.filter((r) => r.recordType === "orcamento" && ["Pendente", "Em negociação"].includes(r.status));
  if (abertos.some((r) => r.status === "Em negociação")) return "negociacao";
  if (abertos.length) return "orcamento";
  if (registros.length && registros.every((r) => ["Recusado", "Cancelado"].includes(r.status))) return "perdido";
  return "novo";
}

// Tarefas pendentes para hoje ou atrasadas
export const tarefasParaHoje = (crm) => (crm?.tasks || []).filter((t) => !t.done && t.due && t.due <= hojeISO());
