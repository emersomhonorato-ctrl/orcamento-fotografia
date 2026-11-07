import { useMemo, useState } from "react";
import { Cake, MessageCircle, Wallet } from "lucide-react";
import { openExternal } from "@/lib/openExternal";
import { buildWhatsAppLink } from "@/utils/whatsappMessages";

const brl = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function localKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shortDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return "sem data";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

const phoneOf = (item) => String(item?.whatsapp || item?.phone || "").replace(/\D/g, "");
const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "";

// Próximos aniversários (hoje + 6 dias) a partir da data de nascimento do cadastro
export function upcomingBirthdays(clients = [], days = 7, from = new Date()) {
  const start = new Date(from);
  start.setHours(12, 0, 0, 0);
  const list = [];
  for (const client of clients) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(client?.birthDate || ""));
    if (!match || !client?.name) continue;
    const [, year, month, day] = match.map(Number);
    for (let offset = 0; offset < days; offset += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + offset);
      // quem nasceu em 29/02 comemora em 28/02 nos anos que não são bissextos
      const leapFix = month === 2 && day === 29 && date.getMonth() === 1 && date.getDate() === 28 && new Date(date.getFullYear(), 1, 29).getMonth() !== 1;
      if ((date.getMonth() + 1 === month && date.getDate() === day) || leapFix) {
        list.push({ client, offset, date: localKey(date), age: date.getFullYear() - year });
        break;
      }
    }
  }
  return list.sort((a, b) => a.offset - b.offset || a.client.name.localeCompare(b.client.name, "pt-BR"));
}

function birthdayMessage(client) {
  const first = firstName(client.name);
  return `Feliz aniversário${first ? `, ${first}` : ""}! 🎉\n\nQue o seu novo ano seja cheio de momentos bonitos — e de muitos motivos para sorrir.\n\nUm abraço,\nEmerson Honorato Retratos`;
}

// Dashboard: quem está devendo (com botão de cobrar) e aniversariantes da semana
export default function DuesAndBirthdays({ events = [], clients = [], onCharge, onOpen }) {
  const [showAll, setShowAll] = useState(false);
  const today = localKey(new Date());

  const dues = useMemo(
    () =>
      events
        .filter((record) => record.status !== "Cancelado" && Number(record.balance || 0) >= 1)
        .map((record) => ({ record, late: Boolean(record.eventDate) && record.eventDate < today }))
        .sort((a, b) => Number(b.late) - Number(a.late) || String(a.record.eventDate || "9999").localeCompare(String(b.record.eventDate || "9999"))),
    [events, today],
  );
  const total = dues.reduce((sum, item) => sum + Number(item.record.balance || 0), 0);
  const lateCount = dues.filter((item) => item.late).length;
  const birthdays = useMemo(() => upcomingBirthdays(clients), [clients]);
  const shown = showAll ? dues : dues.slice(0, 6);

  return (
    <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="rounded-2xl border border-stone-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-5 py-3">
          <Wallet className="h-4 w-4 text-amber-600" />
          <h2 className="text-sm font-semibold text-stone-900">Cobranças</h2>
          <span className="text-xs text-stone-500">
            {dues.length ? `${dues.length} com saldo • ${brl(total)}${lateCount ? ` • ${lateCount} já fizeram o trabalho` : ""}` : "ninguém devendo"}
          </span>
        </div>
        {dues.length === 0 ? (
          <p className="px-5 py-6 text-sm text-stone-500">Tudo recebido. 🎉</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {shown.map(({ record, late }) => (
              <li key={record.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm">
                <span className={`w-[52px] shrink-0 text-xs font-semibold tabular-nums ${late ? "text-red-700" : "text-stone-500"}`}>{shortDate(record.eventDate)}</span>
                <button type="button" className="min-w-[10rem] flex-1 truncate text-left font-medium text-stone-900 hover:underline" onClick={() => onOpen?.(record)}>
                  {record.clientName || "Sem nome"} <span className="hidden font-normal text-stone-500 sm:inline">• {record.eventType || "Trabalho"}</span>
                </button>
                {late ? <span className="hidden rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 sm:inline">já realizado</span> : null}
                <span className="font-semibold tabular-nums text-amber-800">{brl(record.balance)}</span>
                {phoneOf(record) ? (
                  <button type="button" title="Mandar cobrança pelo WhatsApp" className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100" onClick={() => onCharge?.(record)}>
                    <MessageCircle className="h-3.5 w-3.5" />Cobrar
                  </button>
                ) : (
                  <span className="text-[11px] text-stone-400">sem telefone</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {dues.length > 6 ? (
          <button type="button" className="w-full border-t border-stone-100 px-5 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50" onClick={() => setShowAll((value) => !value)}>
            {showAll ? "Mostrar menos" : `Ver todas (${dues.length})`}
          </button>
        ) : null}
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-5 py-3">
          <Cake className="h-4 w-4 text-rose-500" />
          <h2 className="text-sm font-semibold text-stone-900">Aniversários da semana</h2>
          <span className="text-xs text-stone-500">{birthdays.length ? `${birthdays.length} cliente${birthdays.length > 1 ? "s" : ""}` : "nenhum"}</span>
        </div>
        {birthdays.length === 0 ? (
          <p className="px-5 py-6 text-sm text-stone-500">Nenhum cliente faz aniversário nos próximos 7 dias. A data de nascimento vem do cadastro do cliente.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {birthdays.map(({ client, offset, date, age }) => (
              <li key={client.id || client.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm">
                <span className={`w-[52px] shrink-0 text-xs font-semibold ${offset === 0 ? "text-rose-600" : "text-stone-500"}`}>{offset === 0 ? "Hoje" : offset === 1 ? "Amanhã" : shortDate(date)}</span>
                <span className="min-w-[10rem] flex-1 truncate font-medium text-stone-900">
                  {client.name}{age > 0 && age < 120 ? <span className="font-normal text-stone-500"> • {age} anos</span> : null}
                </span>
                {phoneOf(client) ? (
                  <button type="button" title="Mandar parabéns pelo WhatsApp" className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100" onClick={() => openExternal(buildWhatsAppLink(phoneOf(client), birthdayMessage(client)))}>
                    <MessageCircle className="h-3.5 w-3.5" />Parabéns
                  </button>
                ) : (
                  <span className="text-[11px] text-stone-400">sem telefone</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
