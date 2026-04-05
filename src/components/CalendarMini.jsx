import { useMemo } from "react";
import { CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTodayLocalISO } from "@/utils/formatters";

export default function CalendarMini({ events, selectedDate, onSelectDate }) {
  const today = getTodayLocalISO();

  const baseDate = useMemo(() => {
    return selectedDate ? new Date(`${selectedDate}T12:00:00`) : new Date(`${today}T12:00:00`);
  }, [selectedDate, today]);

  const month = baseDate.getMonth();
  const year = baseDate.getFullYear();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekDay = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const days = [];
  for (let i = 0; i < startWeekDay; i++) days.push(null);
  for (let d = 1; d <= totalDays; d++) days.push(d);

  const monthName = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(baseDate);

  function isoForDay(day) {
    const m = String(month + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${year}-${m}-${d}`;
  }

  return (
    <Card className="rounded-3xl border-0 bg-white/80 shadow-sm backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg capitalize">
          <CalendarDays className="h-5 w-5" />
          {monthName}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500">
          {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
            <div key={`${d}-${i}`}>{d}</div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-2">
          {days.map((day, index) => {
            if (!day) return <div key={`empty-${index}`} className="h-10 rounded-xl" />;

            const iso = isoForDay(day);
            const count = events.filter((e) => e.eventDate === iso).length;
            const active = selectedDate === iso;
            const isToday = iso === today;

            return (
              <button
                key={iso}
                onClick={() => onSelectDate(iso)}
                className={`relative h-10 rounded-xl border text-sm font-medium transition hover:scale-[1.02] ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : isToday
                      ? "border-slate-300 bg-slate-100 text-slate-900"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {day}
                {count > 0 ? (
                  <span
                    className={`absolute bottom-1 right-1 inline-flex h-2.5 w-2.5 rounded-full ${
                      active ? "bg-white" : "bg-slate-900"
                    }`}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}