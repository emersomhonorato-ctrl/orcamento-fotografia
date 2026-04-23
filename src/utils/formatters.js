export function formatCurrency(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(number);
}

export function formatDateBR(dateStr) {
  if (!dateStr) return "-";
  const [year, month, day] = dateStr.split("-");
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
}

export function formatDateTimeLabel(dateStr, timeStr) {
  if (!dateStr) return "Sem data";
  return `${formatDateBR(dateStr)}${timeStr ? ` às ${timeStr}` : ""}`;
}

export function getTodayLocalISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function combineDateTime(dateStr, timeStr = "00:00") {
  if (!dateStr) return null;
  return new Date(`${dateStr}T${timeStr || "00:00"}:00`);
}

export function diffInDays(targetDateStr) {
  if (!targetDateStr) return null;
  const today = new Date(`${getTodayLocalISO()}T00:00:00`);
  const target = new Date(`${targetDateStr}T00:00:00`);
  const ms = target.getTime() - today.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function isConflict(eventoA, eventoB) {
  if (!eventoA.eventDate || !eventoB.eventDate) return false;
  if (eventoA.id === eventoB.id) return false;
  if (eventoA.eventDate !== eventoB.eventDate) return false;
  if (!eventoA.startTime || !eventoA.endTime || !eventoB.startTime || !eventoB.endTime) return false;

  const aStart = combineDateTime(eventoA.eventDate, eventoA.startTime);
  const aEnd = combineDateTime(eventoA.eventDate, eventoA.endTime);
  const bStart = combineDateTime(eventoB.eventDate, eventoB.startTime);
  const bEnd = combineDateTime(eventoB.eventDate, eventoB.endTime);

  return aStart < bEnd && bStart < aEnd;
}

export function normalizeItems(items = []) {
  if (!Array.isArray(items)) return [];

  return items.map((item) => ({
    id: item.id || crypto.randomUUID(),
    type: item.type || "Serviço",
    name: item.name || "",
    description: item.description || "",
    quantity: Number(item.quantity || 1),
    unitPrice: Number(item.unitPrice || 0),
  }));
}

export function getItemsTotal(items = []) {
  return normalizeItems(items).reduce((acc, item) => {
    return acc + item.quantity * item.unitPrice;
  }, 0);
}

export function getLogoFormatFromDataUrl(dataUrl = "") {
  if (dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg")) {
    return "JPEG";
  }
  return "PNG";
}

export function buildEmailTemplate(evento, settings) {
  return `Olá, ${evento.clientName}!

Estamos passando para confirmar seu agendamento:

Tipo de serviço: ${evento.eventType}
Data: ${formatDateBR(evento.eventDate)}
Horário: ${evento.startTime || "A combinar"}
Local: ${evento.location || "A combinar"}

Qualquer dúvida, estamos à disposição.

${settings.emailSignature}`;
}

export function buildCommunicationMessage(record, settings = {}, kind = "confirmacao") {
  const studioName = settings.studioName || "Emerson Honorato Retratos";
  const serviceName = record.eventType || record.packageName || "seu atendimento";
  const eventDate = record.eventDate ? formatDateBR(record.eventDate) : "a combinar";
  const eventTime = record.startTime || "a combinar";
  const location = record.location || "a combinar";
  const amount = formatCurrency(record.computedAmount || record.amount || 0);
  const amountPaid = formatCurrency(record.amountPaid || 0);
  const balance = formatCurrency(Math.max(Number(record.computedAmount || record.amount || 0) - Number(record.amountPaid || 0), 0));
  const validityDays = Number(record.budgetValidityDays || settings.budgetValidityDays || 7);
  const paymentTerms = record.contractPaymentMethod || settings.paymentTerms || "Forma de pagamento a combinar.";
  const deliveryTerms = record.contractDeliveryTerms || "Entrega a combinar.";
  const greeting = `Olá, ${record.clientName || "cliente"}!`;
  const signature = settings.emailSignature || studioName;

  if (kind === "proposta") {
    return `${greeting}

Preparei sua proposta para ${serviceName}.

Data prevista: ${eventDate}
Local: ${location}
Investimento: ${amount}
Validade da proposta: ${validityDays} dias

Se quiser, posso seguir com a reserva da data e emissão do contrato.

${signature}`;
  }

  if (kind === "contrato") {
    return `${greeting}

Seu contrato para ${serviceName} já está pronto.

Data: ${eventDate}
Local: ${location}
Investimento: ${amount}

Assim que me confirmar, seguimos com os próximos passos.

${signature}`;
  }

  if (kind === "cobranca") {
    return `${greeting}

Passando para alinhar o pagamento referente a ${serviceName}.

Valor total: ${amount}
Valor já recebido: ${amountPaid}
Saldo atual: ${balance}

Condição combinada:
${paymentTerms}

Fico à disposição para te enviar os dados de pagamento.

${signature}`;
  }

  if (kind === "entrega") {
    return `${greeting}

Seu material de ${serviceName} está em fase final de entrega.

Data do atendimento: ${eventDate}
Forma de entrega: ${deliveryTerms}

Se precisar de qualquer ajuste final, me avise por aqui.

${signature}`;
  }

  if (kind === "lembrete_hoje") {
    return `${greeting}

Passando para confirmar que seu ${serviceName} é hoje.

Horário: ${eventTime}
Local: ${location}

Se precisar me sinalizar qualquer detalhe, fico à disposição.

${signature}`;
  }

  if (kind === "lembrete") {
    return `${greeting}

Passando para lembrar do seu ${serviceName}.

Data: ${eventDate}
Horário: ${eventTime}
Local: ${location}

Qualquer ajuste ou dúvida, me chama por aqui.

${signature}`;
  }

  return `${greeting}

Estou entrando em contato sobre ${serviceName}.

Data: ${eventDate}
Horário: ${eventTime}
Local: ${location}
Investimento: ${amount}

${signature}`;
}

export function buildCommunicationSubject(record, settings = {}, kind = "confirmacao") {
  const studioName = settings.studioName || "Emerson Honorato Retratos";
  const serviceName = record.eventType || record.packageName || "seu atendimento";

  if (kind === "proposta") return `Proposta comercial - ${serviceName} | ${studioName}`;
  if (kind === "contrato") return `Contrato pronto - ${serviceName} | ${studioName}`;
  if (kind === "cobranca") return `Pagamento pendente - ${serviceName} | ${studioName}`;
  if (kind === "entrega") return `Entrega do material - ${serviceName} | ${studioName}`;
  if (kind === "lembrete_hoje") return `Lembrete de hoje - ${serviceName} | ${studioName}`;
  if (kind === "lembrete") return `Lembrete do agendamento - ${serviceName} | ${studioName}`;

  return `Atualização do atendimento - ${serviceName} | ${studioName}`;
}
