import { useMemo } from "react";
import { CalendarDays, MapPin, MessageCircle } from "lucide-react";
import { photographerLabel } from "@/lib/team";

function localKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dayTitle(key, index) {
  if (index === 0) return "Hoje";
  if (index === 1) return "Amanhã";
  const date = new Date(`${key}T12:00:00`);
  const label = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Hoje e os próximos 7 dias, no topo do dashboard
export default function WeekAgenda({ events = [], onOpen, onWhatsApp }) {
  const days = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return Array.from({ length: 8 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index);
      const key = localKey(date);
      const items = events
        .filter((record) => record.eventDate === key && record.status !== "Cancelado")
        .sort((a, b) => String(a.startTime || "99").localeCompare(String(b.startTime || "99")));
      return { key, index, items };
    });
  }, [events]);

  const total = days.reduce((sum, day) => sum + day.items.length, 0);
  const busyDays = days.filter((day) => day.items.length);

  return (
    <section className="rounded-2xl border border-stone-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-5 py-3">
        <CalendarDays className="h-4 w-4 text-stone-500" />
        <h2 className="text-sm font-semibold text-stone-900">Próximos 7 dias</h2>
        <span className="text-xs text-stone-500">{total ? `${total} compromisso${total > 1 ? "s" : ""}` : "agenda livre"}</span>
      </div>
      {busyDays.length === 0 ? (
        <p className="px-5 py-6 text-sm text-stone-500">Nenhum compromisso de hoje até {dayTitle(days[7].key, 7).toLowerCase()}.</p>
      ) : (
        <div className="divide-y divide-stone-100">
          {busyDays.map((day) => (
            <div key={day.key} className="grid gap-2 px-5 py-3 sm:grid-cols-[150px_1fr]">
              <p className={`text-sm font-semibold ${day.index === 0 ? "text-[#7a1712]" : "text-stone-700"}`}>{dayTitle(day.key, day.index)}</p>
              <ul className="space-y-2">
                {day.items.map((record) => {
                  const phone = String(record.whatsapp || record.phone || "").replace(/\D/g, "");
                  return (
                    <li key={record.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="w-[92px] shrink-0 font-semibold tabular-nums text-stone-900">
                        {record.startTime ? `${record.startTime}${record.endTime ? `–${record.endTime}` : ""}` : "sem horário"}
                      </span>
                      <button type="button" className="min-w-0 text-left font-medium text-stone-900 hover:underline" onClick={() => onOpen?.(record)}>
                        {record.clientName || "Sem nome"}
                      </button>
                      <span className="text-stone-500">{record.eventType}</span>
                      {record.photographer ? <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600">{photographerLabel(record.photographer)}</span> : null}
                      {record.location ? <span className="inline-flex items-center gap-1 text-xs text-stone-500"><MapPin className="h-3 w-3" />{record.location}</span> : null}
                      {phone ? (
                        <button type="button" title="Mandar lembrete pelo WhatsApp" className="ml-auto inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100" onClick={() => onWhatsApp?.(record, day.index)}>
                          <MessageCircle className="h-3.5 w-3.5" />Lembrete
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
