export const PAY_PUBLIC_BASE = "https://orcamento.emersonhonoratoretratos.com.br/pagar/";

export const brl = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function installmentLabel(amount, max) {
  const n = Math.max(1, Number(max) || 1);
  if (n === 1) return `${brl(amount)} à vista`;
  return `em até ${n}x`;
}

export const PAYMENT_STATUS = {
  pendente: { label: "Aguardando", className: "bg-amber-100 text-amber-800" },
  pago: { label: "Pago", className: "bg-emerald-100 text-emerald-800" },
  cancelado: { label: "Cancelado", className: "bg-slate-100 text-slate-600" },
  vencido: { label: "Vencido", className: "bg-slate-100 text-slate-600" },
};

export function methodLabel(method) {
  if (method === "credit_card") return "cartão de crédito";
  if (method === "debit_card") return "cartão de débito";
  if (method === "bank_transfer" || method === "pix") return "Pix";
  if (method === "account_money") return "saldo Mercado Pago";
  return method || "";
}
