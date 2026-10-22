import { formatCurrency, formatDateBR } from "./formatters";

// Mensagens de WhatsApp da agenda (confirmação ao cliente, aviso interno e resumo do período).
// Todas avisam que são mensagens automáticas do sistema do estúdio.

export const DEFAULT_WHATSAPP_CLOSING =
  "Se estiver tudo certo, é só responder *OK* para confirmar. Se precisar ajustar alguma coisa, responda esta mensagem que eu te atendo pessoalmente.";

function clean(value) {
  return String(value ?? "").trim();
}

function has(value) {
  const text = clean(value).toLowerCase();
  return Boolean(text) && !["-", "a definir", "a combinar", "não informado"].includes(text);
}

export function getWeekdayDate(isoDate) {
  if (!isoDate) return "a combinar";
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return formatDateBR(isoDate);
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(date);
  return `${weekday}, ${formatDateBR(isoDate)}`;
}

export function getTimeRange(record = {}) {
  const start = clean(record.startTime);
  const end = clean(record.endTime);
  if (start && end) return `${start} às ${end}`;
  return start || "a combinar";
}

function firstName(name) {
  return clean(name).split(/\s+/)[0] || "tudo bem";
}

/** Converte telefone em número internacional para o wa.me (assume Brasil quando faltar o 55). */
export function toWhatsAppNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length >= 12 && digits.startsWith("55")) return digits;
  return `55${digits}`;
}

export function buildWhatsAppLink(phone, text) {
  const number = toWhatsAppNumber(phone);
  if (!number) return "";
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

function paymentLine(record) {
  const total = Number(record.computedAmount || record.amount || 0);
  const balance = Math.max(Number(record.balance ?? total - Number(record.amountPaid || 0)) || 0, 0);
  if (total <= 0) return "";
  if (balance > 0) return `💰 *Saldo a pagar:* ${formatCurrency(balance)}`;
  return "✅ *Pagamento:* quitado";
}

/** Confirmação enviada ao cliente. */
export function buildClientConfirmation(record = {}, settings = {}) {
  const studioName = clean(settings.studioName) || "Emerson Honorato Retratos";
  const closing = clean(settings.whatsappConfirmationClosing) || DEFAULT_WHATSAPP_CLOSING;
  const signature = clean(settings.emailSignature) || studioName;

  return [
    `🤖 _Mensagem automática do sistema de agendamentos — ${studioName}_`,
    "",
    `Olá, ${firstName(record.clientName)}! Passando para confirmar o seu agendamento:`,
    "",
    `📸 *Serviço:* ${clean(record.eventType || record.packageName) || "Sessão fotográfica"}`,
    `📅 *Data:* ${getWeekdayDate(record.eventDate)}`,
    `⏰ *Horário:* ${getTimeRange(record)}`,
    `📍 *Local:* ${has(record.location) ? clean(record.location) : "a combinar"}`,
    paymentLine(record) || null,
    has(record.notes) ? `📝 *Observações:* ${clean(record.notes)}` : null,
    "",
    closing,
    "",
    signature,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/** Aviso interno de um agendamento, enviado para o próprio fotógrafo. */
export function buildOwnerEventNotice(record = {}) {
  const total = Number(record.computedAmount || record.amount || 0);
  const paid = Number(record.amountPaid || 0);
  const balance = Math.max(total - paid, 0);
  const contact = [clean(record.whatsapp || record.phone), clean(record.email)].filter(Boolean).join(" • ");

  return [
    "🤖 _Mensagem automática — lembrete interno da agenda_",
    "",
    `*${clean(record.clientName) || "Cliente"}* — ${clean(record.eventType || record.packageName) || "Serviço"}`,
    `📅 ${getWeekdayDate(record.eventDate)}`,
    `⏰ ${getTimeRange(record)}`,
    `📍 ${has(record.location) ? clean(record.location) : "Local a combinar"}`,
    contact ? `📞 ${contact}` : "",
    total > 0 ? `💰 Total ${formatCurrency(total)} • Pago ${formatCurrency(paid)} • Saldo ${formatCurrency(balance)}` : "",
    has(record.notes) ? `📝 ${clean(record.notes)}` : "",
    record.whatsappConfirmationSentAt ? "✅ Confirmação já enviada ao cliente" : "⚠️ Confirmação ainda não enviada ao cliente",
  ]
    .filter(Boolean)
    .join("\n")
    .replace("_\n", "_\n\n");
}

/** Resumo de vários agendamentos (agenda do período) para o fotógrafo. */
export function buildOwnerAgendaSummary(records = [], periodLabel = "") {
  const header = `🤖 _Mensagem automática — sua agenda${periodLabel ? ` (${periodLabel})` : ""}_`;
  if (!records.length) return `${header}\n\nNenhum compromisso neste período. 🙂`;

  const byDate = new Map();
  records.forEach((record) => {
    const key = record.eventDate || "sem-data";
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(record);
  });

  const blocks = Array.from(byDate.entries()).map(([date, items]) => {
    const lines = items.map((record) => {
      const balance = Math.max(Number(record.computedAmount || record.amount || 0) - Number(record.amountPaid || 0), 0);
      return [
        `• ${getTimeRange(record)} — *${clean(record.clientName) || "Cliente"}* (${clean(record.eventType || record.packageName) || "Serviço"})`,
        `   📍 ${has(record.location) ? clean(record.location) : "Local a combinar"}${balance > 0 ? ` • saldo ${formatCurrency(balance)}` : ""}${record.whatsappConfirmationSentAt ? " • ✅ confirmado" : ""}`,
      ].join("\n");
    });
    const title = date === "sem-data" ? "*Sem data definida*" : `*${getWeekdayDate(date)}*`;
    return `${title}\n${lines.join("\n")}`;
  });

  return `${header}\n\n${records.length} compromisso${records.length === 1 ? "" : "s"}:\n\n${blocks.join("\n\n")}`;
}
