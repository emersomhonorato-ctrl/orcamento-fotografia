import { useMemo, useState } from "react";
import { Baby, CalendarCheck, CalendarClock, MessageCircle, Pencil, Plus, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSessionPlan } from "@/lib/sessions";
import { formatDateBR } from "@/lib/delivery";
import { openExternal } from "@/lib/openExternal";
import { buildWhatsAppLink } from "@/utils/whatsappMessages";
import { MonthlySettings, monthlyMessage } from "@/components/MonthlyLinkDialog";

// Aba "Mês a mês": todos os clientes do acompanhamento mensal, com a sessão do mês e o link de agendamento.

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function normalize(text) {
  return String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthName(key) {
  const [y, m] = key.split("-").map(Number);
  const name = MONTHS[m - 1] || "";
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}${y !== new Date().getFullYear() ? ` ${y}` : ""}`;
}

function currentKeys() {
  const now = new Date();
  return {
    thisMonth: monthKey(now),
    nextMonth: monthKey(new Date(now.getFullYear(), now.getMonth() + 1, 1)),
    today: `${monthKey(now)}-${String(now.getDate()).padStart(2, "0")}`,
  };
}

export default function MonthlyPanel({ events = [], onOpenLink, onSchedule, onEdit }) {
  const [query, setQuery] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const { thisMonth, nextMonth } = currentKeys();

  const contracts = useMemo(() => {
    const { thisMonth: current, nextMonth: next, today } = currentKeys();
    const byParent = new Map();
    for (const item of events) {
      if (!item.parentEventId || item.status === "Cancelado") continue;
      const list = byParent.get(item.parentEventId) || [];
      list.push(item);
      byParent.set(item.parentEventId, list);
    }
    return events
      .filter((record) => getSessionPlan(record)?.kind === "mensal")
      .map((record) => {
        const sessions = (byParent.get(record.id) || []).sort((a, b) => String(a.eventDate || "9999").localeCompare(String(b.eventDate || "9999")));
        const inMonth = (key) => sessions.find((s) => String(s.eventDate || "").startsWith(key)) || null;
        return {
          record,
          sessions,
          done: sessions.filter((s) => s.eventDate && s.eventDate < today).length,
          current: inMonth(current),
          next: inMonth(next),
          last: [...sessions].reverse().find((s) => s.eventDate && s.eventDate < today) || null,
        };
      })
      .sort((a, b) => Number(Boolean(a.current)) - Number(Boolean(b.current)) || String(a.record.clientName || "").localeCompare(String(b.record.clientName || ""), "pt-BR"));
  }, [events]);

  const filtered = contracts.filter((c) => {
    if (onlyMissing && c.current) return false;
    const q = normalize(query.trim());
    return !q || normalize(`${c.record.clientName} ${c.record.eventType}`).includes(q);
  });
  const missing = contracts.filter((c) => !c.current).length;

  function remind(c) {
    const record = c.record;
    if (!record.monthlyToken) {
      onOpenLink(record);
      return;
    }
    const phone = record.whatsapp || record.phone || "";
    const text = monthlyMessage(record, record.monthlyToken);
    openExternal(phone ? buildWhatsAppLink(phone, text) : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`);
  }

  function slot(label, session) {
    return (
      <div className={`rounded-2xl px-3 py-2 text-sm ${session ? "bg-emerald-50 text-emerald-950" : "bg-amber-50 text-amber-950"}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
        {session ? (
          <button type="button" className="text-left font-medium hover:underline" onClick={() => onEdit(session)}>
            {formatDateBR(session.eventDate)}{session.startTime ? ` às ${session.startTime}` : ""}{session.sessionTheme ? ` · ${session.sessionTheme}` : ""}
          </button>
        ) : (
          <p className="font-medium">Falta marcar</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="studio-panel rounded-3xl border-0 bg-white/90 shadow-sm">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold"><Baby className="h-5 w-5" />Mês a mês</h2>
              <p className="text-sm text-slate-500">Clientes do acompanhamento mensal: sessão de cada mês e o link para eles marcarem.</p>
            </div>
            <Button variant="outline" className="rounded-2xl" onClick={() => setShowSettings((v) => !v)}><CalendarClock className="mr-2 h-4 w-4" />Horários do link</Button>
          </div>
          {showSettings ? <MonthlySettings compact /> : null}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Clientes</p><p className="text-xl font-semibold">{contracts.length}</p></div>
            <div className="rounded-2xl bg-emerald-50 p-3"><p className="text-xs text-emerald-800">{monthName(thisMonth)}: marcadas</p><p className="text-xl font-semibold text-emerald-950">{contracts.length - missing}</p></div>
            <button type="button" onClick={() => setOnlyMissing((v) => !v)} className={`rounded-2xl p-3 text-left transition ${onlyMissing ? "bg-amber-200" : "bg-amber-50 hover:bg-amber-100"}`}>
              <p className="text-xs text-amber-800">Falta marcar {onlyMissing ? "(filtrando)" : ""}</p>
              <p className="text-xl font-semibold text-amber-950">{missing}</p>
            </button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="rounded-xl pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar cliente" />
          </div>
        </CardContent>
      </Card>

      {!contracts.length ? (
        <p className="rounded-3xl bg-white/90 p-6 text-center text-sm text-slate-500">Nenhum contrato de acompanhamento mensal na agenda. Eles aparecem aqui quando o tipo do trabalho tem "acompanhamento" ou "mensal".</p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {filtered.map((c) => (
          <Card key={c.record.id} className="rounded-3xl border border-slate-100 bg-white shadow-sm">
            <CardContent className="space-y-3 pt-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">{c.record.clientName || "Cliente"}</p>
                  <p className="truncate text-xs text-slate-500">{c.record.eventType}{c.record.eventDate ? ` · contrato de ${formatDateBR(c.record.eventDate)}` : ""}</p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{c.done} {c.done === 1 ? "sessão feita" : "sessões feitas"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {slot(monthName(thisMonth), c.current)}
                {slot(monthName(nextMonth), c.next)}
              </div>
              {c.last ? <p className="text-xs text-slate-500">Última: {formatDateBR(c.last.eventDate)}{c.last.sessionTheme ? ` · ${c.last.sessionTheme}` : ""}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="rounded-xl" onClick={() => onOpenLink(c.record)}><CalendarClock className="mr-1.5 h-4 w-4" />{c.record.monthlyToken ? "Link do cliente" : "Criar link"}</Button>
                {!c.current ? <Button size="sm" variant="outline" className="rounded-xl" onClick={() => remind(c)}><MessageCircle className="mr-1.5 h-4 w-4" />Lembrar de marcar</Button> : null}
                <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => onSchedule(c.record)}><Plus className="mr-1.5 h-4 w-4" />Agendar eu mesmo</Button>
              </div>
              {c.sessions.length ? (
                <details className="text-sm">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-600"><CalendarCheck className="mr-1 inline h-3.5 w-3.5" />Todas as sessões ({c.sessions.length})</summary>
                  <ul className="mt-2 divide-y divide-slate-100">
                    {c.sessions.map((s) => (
                      <li key={s.id} className="flex items-center gap-2 py-1.5">
                        <span className="w-24 tabular-nums">{s.eventDate ? formatDateBR(s.eventDate) : "Sem data"}</span>
                        <span className="text-slate-500">{s.startTime || ""}</span>
                        <span className="min-w-0 flex-1 truncate text-slate-700">{s.eventType}{s.sessionTheme ? ` — ${s.sessionTheme}` : ""}</span>
                        <button type="button" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" onClick={() => onEdit(s)} aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
