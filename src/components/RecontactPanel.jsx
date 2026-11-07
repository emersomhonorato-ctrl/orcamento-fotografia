import { useMemo, useState } from "react";
import { Check, HeartHandshake, MessageCircle } from "lucide-react";
import { openExternal } from "@/lib/openExternal";
import { buildWhatsAppLink } from "@/utils/whatsappMessages";
import { upcomingBirthdays } from "@/components/DuesAndBirthdays";

const MONTH_OPTIONS = [6, 12, 18, 24];
const PREF_KEY = "eh-recontato-meses";
const QUIET_DAYS = 60; // depois de chamar, some da lista por 60 dias

function localKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
const digits = (value) => String(value || "").replace(/\D/g, "").slice(-9);
const lower = (value) => String(value || "").trim().toLowerCase();
const phoneOf = (item) => String(item?.whatsapp || item?.phone || "").replace(/\D/g, "");
const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "";

function monthsBetween(fromIso, to = new Date()) {
  const from = new Date(`${fromIso}T12:00:00`);
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) - (to.getDate() < from.getDate() ? 1 : 0);
}

function sinceLabel(months) {
  if (months < 12) return `há ${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return `há ${years} ano${years > 1 ? "s" : ""}${rest ? ` e ${rest} ${rest === 1 ? "mês" : "meses"}` : ""}`;
}

function monthYear(iso) {
  const [y, m] = String(iso).split("-");
  return `${m}/${y}`;
}

function readPref() {
  try {
    const value = Number(window.localStorage.getItem(PREF_KEY));
    return MONTH_OPTIONS.includes(value) ? value : 12;
  } catch {
    return 12;
  }
}

function recontactMessage(client, last) {
  const first = firstName(client.name);
  return `Oi${first ? `, ${first}` : ""}! Tudo bem? Aqui é o Emerson, da Emerson Honorato Retratos 📸\n\nLembrei do seu ${String(last?.eventType || "ensaio").toLowerCase()} e fiquei com vontade de saber como vocês estão!\n\nA agenda está aberta para novos ensaios. Se quiser registrar uma fase nova, é só me chamar que eu te passo as datas.`;
}

function birthdayInviteMessage(client) {
  const first = firstName(client.name);
  return `Oi${first ? `, ${first}` : ""}! Tudo bem? Aqui é o Emerson, da Emerson Honorato Retratos 📸\n\nVi que o seu aniversário está chegando 🎉 Que tal um ensaio para marcar essa nova idade?\n\nSe tiver vontade, me chama que eu te passo as datas disponíveis.`;
}

// Dashboard: clientes para chamar de novo (tempo sem trabalho ou aniversário chegando)
export default function RecontactPanel({ clients = [], events = [], contactLog = {}, onContacted }) {
  const [months, setMonths] = useState(readPref);
  const [view, setView] = useState("tempo");
  const today = localKey(new Date());

  const { stale, birthdays, refused, quiet } = useMemo(() => {
    const active = events.filter((record) => record && record.status !== "Cancelado" && record.eventDate);
    const limitDate = new Date(`${today}T12:00:00`);
    limitDate.setDate(limitDate.getDate() - QUIET_DAYS);
    const quietLimit = localKey(limitDate);
    let refusedCount = 0;
    let quietCount = 0;
    const history = new Map();
    const eligible = [];
    for (const client of clients) {
      if (!client?.name) continue;
      if (client.marketingOptIn === false) {
        refusedCount += 1;
        continue;
      }
      const phones = new Set([digits(client.phone), digits(client.whatsapp)].filter((value) => value.length >= 8));
      const email = lower(client.email);
      const name = lower(client.name);
      const jobs = active.filter((record) =>
        (client.id && record.clientId === client.id) ||
        (email && lower(record.email) === email) ||
        (phones.size && (phones.has(digits(record.phone)) || phones.has(digits(record.whatsapp)))) ||
        (name && lower(record.clientName) === name),
      );
      const past = jobs.filter((record) => record.eventDate < today).sort((a, b) => a.eventDate.localeCompare(b.eventDate));
      const hasFuture = jobs.some((record) => record.eventDate >= today);
      if (!past.length || hasFuture) continue;
      const lastContact = contactLog[client.id] || "";
      if (lastContact && lastContact >= quietLimit) {
        quietCount += 1;
        continue;
      }
      const last = past[past.length - 1];
      history.set(client.id, { last, count: past.length });
      eligible.push(client);
    }
    const staleList = eligible
      .map((client) => ({ client, ...history.get(client.id), since: monthsBetween(history.get(client.id).last.eventDate) }))
      .filter((item) => item.since >= months)
      .sort((a, b) => a.since - b.since);
    const birthdayList = upcomingBirthdays(eligible, 30).map((item) => ({ ...item, ...history.get(item.client.id) }));
    return { stale: staleList, birthdays: birthdayList, refused: refusedCount, quiet: quietCount };
  }, [clients, events, contactLog, months, today]);

  function choose(value) {
    setMonths(value);
    try {
      window.localStorage.setItem(PREF_KEY, String(value));
    } catch {
      // sem armazenamento: só não lembra a escolha
    }
  }

  function contact(client, message) {
    openExternal(buildWhatsAppLink(phoneOf(client), message));
    onContacted?.(client);
  }

  const list = view === "tempo" ? stale : birthdays;

  return (
    <section className="rounded-2xl border border-stone-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-5 py-3">
        <HeartHandshake className="h-4 w-4 text-violet-600" />
        <h2 className="text-sm font-semibold text-stone-900">Clientes para chamar de novo</h2>
        <div className="ml-auto flex rounded-lg bg-stone-100 p-0.5 text-xs font-semibold">
          {[["tempo", `Sem trabalho (${stale.length})`], ["aniversario", `Aniversário no mês (${birthdays.length})`]].map(([key, label]) => (
            <button key={key} type="button" className={`rounded-md px-2.5 py-1 ${view === key ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"}`} onClick={() => setView(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === "tempo" ? (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-stone-100 px-5 py-2 text-xs text-stone-500">
          Último trabalho há mais de
          {MONTH_OPTIONS.map((value) => (
            <button key={value} type="button" className={`rounded-full px-2.5 py-0.5 font-semibold ${months === value ? "bg-violet-100 text-violet-800" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`} onClick={() => choose(value)}>
              {value} meses
            </button>
          ))}
        </div>
      ) : null}

      {list.length === 0 ? (
        <p className="px-5 py-6 text-sm text-stone-500">
          {view === "tempo"
            ? `Nenhum cliente sem trabalho há mais de ${months} meses (sem contar quem já tem trabalho marcado).`
            : "Nenhum cliente antigo faz aniversário nos próximos 30 dias. A data de nascimento vem do cadastro."}
        </p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {list.slice(0, 8).map((item) => {
            const { client, last, count } = item;
            const detail = view === "tempo"
              ? `${last.eventType || "Trabalho"} em ${monthYear(last.eventDate)} • ${sinceLabel(item.since)}${count > 1 ? ` • ${count} trabalhos` : ""}`
              : `${item.offset === 0 ? "hoje" : item.offset === 1 ? "amanhã" : `dia ${item.date.slice(8, 10)}/${item.date.slice(5, 7)}`} • último: ${last.eventType || "trabalho"} em ${monthYear(last.eventDate)}`;
            return (
              <li key={client.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm">
                <div className="min-w-[12rem] flex-1">
                  <p className="font-medium text-stone-900">
                    {client.name}
                    {client.marketingOptIn === null ? <span className="ml-2 inline-block rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500" title="Cliente antigo: ainda não respondeu se aceita receber novidades">sem autorização registrada</span> : null}
                  </p>
                  <p className="text-xs text-stone-500">{detail}</p>
                </div>
                {phoneOf(client) ? (
                  <button type="button" className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800 hover:bg-violet-100" onClick={() => contact(client, view === "tempo" ? recontactMessage(client, last) : birthdayInviteMessage(client))}>
                    <MessageCircle className="h-3.5 w-3.5" />Chamar
                  </button>
                ) : (
                  <span className="text-[11px] text-stone-400">sem telefone</span>
                )}
                <button type="button" title="Já falei com este cliente (some da lista por 60 dias)" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-stone-500 hover:bg-stone-100" onClick={() => onContacted?.(client)}>
                  <Check className="h-3.5 w-3.5" />Já falei
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {list.length > 8 ? <p className="border-t border-stone-100 px-5 py-2 text-xs text-stone-500">Mostrando 8 de {list.length}. Depois de chamar, eles saem da lista e aparecem os próximos.</p> : null}
      {refused || quiet ? (
        <p className="border-t border-stone-100 px-5 py-2 text-[11px] text-stone-400">
          {[quiet ? `${quiet} já chamado${quiet > 1 ? "s" : ""} nos últimos ${QUIET_DAYS} dias` : "", refused ? `${refused} não aceitou${refused > 1 ? "aram" : ""} receber novidades e não aparece${refused > 1 ? "m" : ""} aqui` : ""].filter(Boolean).join(" • ")}
        </p>
      ) : null}
    </section>
  );
}
