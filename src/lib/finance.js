import { getItemsTotal } from "@/utils/formatters";

// Recebimentos de um trabalho (lista de pagamentos + valor pago)

export function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Histórico; se o valor pago foi mudado pela edição, ajusta para bater
export function historyOf(record) {
  const paid = Math.round(Number(record.amountPaid || 0) * 100) / 100;
  const list = Array.isArray(record.payments) ? record.payments.filter((item) => Number(item?.amount) > 0) : [];
  const sum = Math.round(list.reduce((total, item) => total + Number(item.amount || 0), 0) * 100) / 100;
  if (list.length && Math.abs(sum - paid) < 0.01) return list;
  if (list.length && paid > sum) return [...list, { id: "ajuste", date: record.receiptDate || "", amount: Math.round((paid - sum) * 100) / 100, method: record.receiptMethod || "", note: "Ajuste feito na edição" }];
  return paid > 0 ? [{ id: "anterior", date: record.receiptDate || "", amount: paid, method: record.receiptMethod || "", note: "Valor já lançado antes" }] : [];
}

function recordTotal(record) {
  const fromItems = getItemsTotal(record.items || []);
  return Number(record.computedAmount || (fromItems > 0 ? fromItems : record.amount) || 0);
}

// Campos a gravar no trabalho a partir da lista de pagamentos
export function paymentFields(record, payments, total = recordTotal(record)) {
  const paid = Math.round(payments.reduce((sum, item) => sum + Number(item.amount || 0), 0) * 100) / 100;
  const last = payments[payments.length - 1];
  return {
    payments,
    amountPaid: total > 0 ? Math.min(paid, total) : paid,
    paymentStatus: paid <= 0 ? "Pendente" : total > 0 && paid >= total - 0.009 ? "Pago" : "Entrada paga",
    receiptDate: last?.date || "",
    receiptMethod: last?.method || record.receiptMethod || "",
  };
}

// Pagamentos do Mercado Pago (tabela payments) que viram baixa no trabalho ligado
export function applyCardPayments(events = [], cardPayments = []) {
  const paid = cardPayments.filter((item) => item && item.status === "pago" && item.event_id);
  if (!paid.length) return null;
  let changed = false;
  const next = events.map((event) => {
    const mine = paid.filter((item) => String(item.event_id) === String(event.id));
    if (!mine.length) return event;
    const history = historyOf(event);
    const known = new Set([...history.map((item) => item.id), ...(event.ignoredCardPayments || [])]);
    const fresh = mine.filter((item) => !known.has(`mp-${item.id}`));
    if (!fresh.length) return event;
    changed = true;
    const payments = [
      ...history,
      ...fresh.map((item) => ({
        id: `mp-${item.id}`,
        date: item.paid_at ? localDateKey(item.paid_at) : localDateKey(),
        amount: Number(item.paid_amount || item.amount || 0),
        method: "Mercado Pago (cartão)",
        note: [item.description, item.installments > 1 ? `${item.installments}x` : ""].filter(Boolean).join(" · "),
        auto: true,
      })),
    ];
    return { ...event, ...paymentFields(event, payments), updatedAt: new Date().toISOString() };
  });
  return changed ? next : null;
}
