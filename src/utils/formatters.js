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