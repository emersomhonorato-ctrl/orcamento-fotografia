import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Share2 } from "lucide-react";
import { buildMonthCalendarPdf, eventsOfMonth, monthTitle } from "@/utils/monthCalendarPdf";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const CHIP = [
  "bg-pink-50 text-pink-900 border-pink-700",
  "bg-blue-50 text-blue-900 border-blue-700",
  "bg-green-50 text-green-900 border-green-700",
  "bg-orange-50 text-orange-900 border-orange-700",
  "bg-violet-50 text-violet-900 border-violet-700",
  "bg-cyan-50 text-cyan-900 border-cyan-700",
  "bg-yellow-50 text-yellow-900 border-yellow-700",
];
function chipClass(type = "") {
  let hash = 0;
  for (const char of String(type)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return CHIP[hash % CHIP.length];
}
const pad = (n) => String(n).padStart(2, "0");

// Calendário do mês na Agenda, com PDF para encaminhar
export default function MonthAgendaCalendar({ events = [], settings = {}, onOpenEvent }) {
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [includeValues, setIncludeValues] = useState(false);
  const [includePhones, setIncludePhones] = useState(false);
  const [busy, setBusy] = useState(false);
  const { year, month } = cursor;

  const list = useMemo(() => eventsOfMonth(events, year, month), [events, year, month]);
  const byDay = useMemo(() => {
    const map = new Map();
    list.forEach((event) => {
      if (!map.has(event.eventDate)) map.set(event.eventDate, []);
      map.get(event.eventDate).push(event);
    });
    return map;
  }, [list]);

  const firstWeekday = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Math.ceil((firstWeekday + days) / 7) * 7;
  const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  function move(delta) {
    setCursor(({ year: y, month: m }) => {
      const date = new Date(y, m + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  }

  function makePdf() {
    return buildMonthCalendarPdf({ events, year, month, settings, includeValues, includePhones });
  }

  function download() {
    setBusy(true);
    try {
      const { doc, fileName } = makePdf();
      doc.save(fileName);
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    setBusy(true);
    try {
      const { doc, fileName } = makePdf();
      const file = new File([doc.output("blob")], fileName, { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Agenda — ${monthTitle(year, month)}` });
      } else {
        doc.save(fileName);
      }
    } catch {
      /* compartilhamento cancelado */
    } finally {
      setBusy(false);
    }
  }

  const canShareFiles = typeof navigator !== "undefined" && typeof navigator.canShare === "function";

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-label="Mês anterior" onClick={() => move(-1)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="min-w-[11rem] text-center text-lg font-semibold text-stone-900">{monthTitle(year, month)}</h2>
        <button type="button" aria-label="Próximo mês" onClick={() => move(1)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setCursor({ year: now.getFullYear(), month: now.getMonth() })} className="h-9 rounded-lg px-3 text-sm text-stone-600 hover:bg-stone-100">Hoje</button>
        <span className="text-sm text-stone-500">{list.length} compromisso{list.length === 1 ? "" : "s"}</span>
        <div className="flex-1" />
        <label className="flex items-center gap-1.5 text-sm text-stone-600"><input type="checkbox" checked={includePhones} onChange={(e) => setIncludePhones(e.target.checked)} />WhatsApp</label>
        <label className="flex items-center gap-1.5 text-sm text-stone-600"><input type="checkbox" checked={includeValues} onChange={(e) => setIncludeValues(e.target.checked)} />Valores</label>
        <button type="button" disabled={busy} onClick={download} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-stone-200 px-3 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60">
          <Download className="h-4 w-4" />Baixar PDF
        </button>
        {canShareFiles ? (
          <button type="button" disabled={busy} onClick={share} className="studio-primary inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-white disabled:opacity-60">
            <Share2 className="h-4 w-4" />Encaminhar
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-stone-400">O PDF traz o calendário do mês e a lista com horário, cliente, trabalho e local. Marque WhatsApp e Valores só se for mandar para quem pode ver.</p>

      <div className="mt-4 overflow-x-auto">
        <div className="grid min-w-[720px] grid-cols-7 overflow-hidden rounded-xl border border-stone-200">
          {WEEKDAYS.map((name) => (
            <div key={name} className="border-b border-stone-200 bg-stone-50 py-2 text-center text-xs font-medium text-stone-500">{name}</div>
          ))}
          {Array.from({ length: cells }, (_, cell) => {
            const day = cell - firstWeekday + 1;
            const inMonth = day >= 1 && day <= days;
            const iso = inMonth ? `${year}-${pad(month + 1)}-${pad(day)}` : "";
            const items = inMonth ? byDay.get(iso) || [] : [];
            return (
              <div key={cell} className={`min-h-[112px] border-b border-r border-stone-100 p-1.5 ${inMonth ? "bg-white" : "bg-stone-50/70"} [&:nth-child(7n)]:border-r-0`}>
                {inMonth ? (
                  <>
                    <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs tabular-nums ${iso === todayIso ? "studio-primary font-semibold text-white" : "text-stone-700"}`}>{day}</span>
                    <div className="mt-1 space-y-1">
                      {items.slice(0, 4).map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => onOpenEvent?.(event)}
                          title={[event.startTime, event.clientName, event.eventType, event.location].filter(Boolean).join(" • ")}
                          className={`block w-full truncate rounded-md border-l-2 px-1.5 py-1 text-left text-[11px] leading-tight ${chipClass(event.eventType)}`}
                        >
                          <span className="font-semibold">{event.startTime ? `${event.startTime} ` : ""}{event.clientName}</span>
                          <span className="block truncate opacity-80">{[event.eventType, event.sessionTheme].filter(Boolean).join(" — ")}</span>
                        </button>
                      ))}
                      {items.length > 4 ? <p className="px-1 text-[11px] text-stone-500">+{items.length - 4} mais</p> : null}
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
