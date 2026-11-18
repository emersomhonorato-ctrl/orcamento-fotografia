import { BellRing, CreditCard, FileText, MessageCircle } from "lucide-react";
import { openExternal } from "@/lib/openExternal";
import { formatDateBR } from "@/utils/formatters";
import { buildWhatsAppLink } from "@/utils/whatsappMessages";

// Painel "Para fazer hoje": orçamentos que estão vencendo e restantes a cobrar antes do ensaio.

const brl = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "";
const phoneOf = (item) => String(item?.whatsapp || item?.phone || "").replace(/\D/g, "");

function whenLabel(daysLeft) {
  if (daysLeft < -1) return `venceu há ${-daysLeft} dias`;
  if (daysLeft === -1) return "venceu ontem";
  if (daysLeft === 0) return "vence hoje";
  if (daysLeft === 1) return "vence amanhã";
  return `vence em ${daysLeft} dias`;
}

function sessionLabel(daysLeft) {
  if (daysLeft === 0) return "é hoje";
  if (daysLeft === 1) return "é amanhã";
  return `em ${daysLeft} dias`;
}

export function budgetReminderMessage(record, info) {
  const first = firstName(record.clientName);
  const what = [record.eventType || "seu ensaio", record.eventDate ? `do dia ${formatDateBR(record.eventDate)}` : ""].filter(Boolean).join(" ");
  const expires = info.expiresISO ? formatDateBR(info.expiresISO) : "";
  const lines = [`Oi${first ? `, ${first}` : ""}! Tudo bem? 😊`];
  if (info.daysLeft < 0) {
    lines.push(`Passando para saber se você ainda pensa em fazer ${what}. A proposta venceu${expires ? ` em ${expires}` : ""}, mas se você confirmar nesta semana eu mantenho as mesmas condições.`);
  } else {
    lines.push(`Passando para lembrar que a proposta de ${what} ${info.daysLeft === 0 ? "vence hoje" : info.daysLeft === 1 ? "vence amanhã" : `vale até ${expires}`}.`);
    lines.push("As datas estão sendo reservadas e eu queria garantir a sua. Para confirmar é só pagar o sinal, que eu já bloqueio a data na agenda.");
  }
  lines.push("Ficou alguma dúvida? Me chama aqui que eu te ajudo! 📸");
  return lines.join("\n\n");
}

export function balanceReminderMessage(record) {
  const first = firstName(record.clientName);
  const when = record.daysLeft === 0 ? "hoje" : record.daysLeft === 1 ? "amanhã" : `dia ${formatDateBR(record.eventDate)}`;
  return [
    `Oi${first ? `, ${first}` : ""}! Tudo certo para ${record.eventType ? `o ${record.eventType}` : "o nosso ensaio"} ${when}? Estou ansioso! 😊`,
    `Só para deixar tudo organizado: falta o restante de *${brl(record.balance)}*. Pode ser no Pix ou no cartão. Se preferir, te mando o link de pagamento.`,
    "Qualquer coisa, é só me chamar. Até lá! 📸",
  ].join("\n\n");
}

export default function FollowUpsPanel({ budgets = [], events = [], onOpen, onPaymentLink }) {
  const hasAny = budgets.length || events.length;
  if (!hasAny) return null;

  const row = (key, children) => (
    <li key={key} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm">{children}</li>
  );
  const button = (label, Icon, onClick, tone = "amber", title = "") => (
    <button
      type="button"
      title={title || label}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${
        tone === "emerald" ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100" : "bg-amber-50 text-amber-800 hover:bg-amber-100"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );

  return (
    <section className="rounded-2xl border border-stone-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-5 py-3">
        <BellRing className="h-4 w-4 text-amber-600" />
        <h2 className="text-sm font-semibold text-stone-900">Para fazer hoje</h2>
        <span className="text-xs text-stone-500">
          {[budgets.length ? `${budgets.length} proposta${budgets.length > 1 ? "s" : ""} vencendo` : "", events.length ? `${events.length} restante${events.length > 1 ? "s" : ""} antes do ensaio` : ""]
            .filter(Boolean)
            .join(" • ")}
        </span>
      </div>
      <ul className="divide-y divide-stone-100">
        {budgets.map(({ record, info }) =>
          row(
            `b-${record.id}`,
            <>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${info.daysLeft < 0 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
                Proposta {whenLabel(info.daysLeft)}
              </span>
              <button type="button" className="min-w-[10rem] flex-1 truncate text-left font-medium text-stone-900 hover:underline" onClick={() => onOpen?.(record)}>
                {record.clientName || "Sem nome"} <span className="hidden font-normal text-stone-500 sm:inline">• {record.eventType || "Orçamento"}</span>
              </button>
              <span className="font-semibold tabular-nums text-stone-700">{brl(record.computedAmount || record.amount)}</span>
              {phoneOf(record)
                ? button("Lembrar", MessageCircle, () => openExternal(buildWhatsAppLink(phoneOf(record), budgetReminderMessage(record, info))), "amber", "Mandar lembrete da proposta no WhatsApp")
                : button("Abrir", FileText, () => onOpen?.(record))}
            </>,
          ),
        )}
        {events.map((record) =>
          row(
            `e-${record.id}`,
            <>
              <span className="shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800">Ensaio {sessionLabel(record.daysLeft)}</span>
              <button type="button" className="min-w-[10rem] flex-1 truncate text-left font-medium text-stone-900 hover:underline" onClick={() => onOpen?.(record)}>
                {record.clientName || "Sem nome"} <span className="hidden font-normal text-stone-500 sm:inline">• falta {brl(record.balance)}</span>
              </button>
              <span className="font-semibold tabular-nums text-amber-800 sm:hidden">{brl(record.balance)}</span>
              {onPaymentLink ? button("Link de pagamento", CreditCard, () => onPaymentLink(record), "emerald", "Gerar link de pagamento do restante") : null}
              {phoneOf(record) ? button("Lembrar", MessageCircle, () => openExternal(buildWhatsAppLink(phoneOf(record), balanceReminderMessage(record))), "amber", "Mandar lembrete do restante no WhatsApp") : null}
            </>,
          ),
        )}
      </ul>
    </section>
  );
}
