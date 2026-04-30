import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTodayLocalISO } from "@/utils/formatters";

export default function CalendarMini({ events, selectedDate, onSelectDate }) {
  const today = getTodayLocalISO();
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date(`${today}T12:00:00`);
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    if (!selectedDate) return;

    const nextSelectedDate = new Date(`${selectedDate}T12:00:00`);
    if (Number.isNaN(nextSelectedDate.getTime())) return;

    setViewMonth((current) => {
      if (
        current.getFullYear() === nextSelectedDate.getFullYear()
        && current.getMonth() === nextSelectedDate.getMonth()
      ) {
        return current;
      }

      return new Date(nextSelectedDate.getFullYear(), nextSelectedDate.getMonth(), 1);
    });
  }, [selectedDate]);

  const month = viewMonth.getMonth();
  const year = viewMonth.getFullYear();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekDay = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const days = [];
  for (let i = 0; i < startWeekDay; i += 1) days.push(null);
  for (let day = 1; day <= totalDays; day += 1) days.push(day);

  const eventCountByDate = useMemo(() => {
    const next = new Map();
    events.forEach((event) => {
      if (!event.eventDate || event.recordType !== "evento") return;
      next.set(event.eventDate, (next.get(event.eventDate) || 0) + 1);
    });
    return next;
  }, [events]);

  const monthName = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(viewMonth);

  function isoForDay(day) {
    const monthValue = String(month + 1).padStart(2, "0");
    const dayValue = String(day).padStart(2, "0");
    return `${year}-${monthValue}-${dayValue}`;
  }

  function selectedDayNumber() {
    const baseDate = selectedDate ? new Date(`${selectedDate}T12:00:00`) : new Date(`${today}T12:00:00`);
    return Number.isNaN(baseDate.getTime()) ? 1 : baseDate.getDate();
  }

  function selectMonth(nextMonthDate, preferredDay = selectedDayNumber()) {
    const normalizedMonth = new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), 1);
    const lastValidDay = new Date(normalizedMonth.getFullYear(), normalizedMonth.getMonth() + 1, 0).getDate();
    const nextDay = Math.min(preferredDay, lastValidDay);
    const nextIso = `${normalizedMonth.getFullYear()}-${String(normalizedMonth.getMonth() + 1).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`;

    setViewMonth(normalizedMonth);
    onSelectDate(nextIso);
  }

  function changeViewMonth(direction) {
    selectMonth(new Date(year, month + direction, 1));
  }

  function goToToday() {
    const currentDay = new Date(`${today}T12:00:00`);
    selectMonth(new Date(currentDay.getFullYear(), currentDay.getMonth(), 1), currentDay.getDate());
  }

  return (
    <Card className="studio-panel rounded-3xl border-0 shadow-sm backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex min-w-0 items-center gap-2 text-lg capitalize">
            <CalendarDays className="h-5 w-5 shrink-0" />
            <span className="truncate">{monthName}</span>
          </CardTitle>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => changeViewMonth(-1)}
              className="rounded-full p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="rounded-full px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => changeViewMonth(1)}
              className="rounded-full p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500">
          {["D", "S", "T", "Q", "Q", "S", "S"].map((dayLabel, index) => (
            <div key={`${dayLabel}-${index}`}>{dayLabel}</div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-2">
          {days.map((day, index) => {
            if (!day) return <div key={`empty-${index}`} className="h-10 rounded-xl" />;

            const iso = isoForDay(day);
            const count = eventCountByDate.get(iso) || 0;
            const active = selectedDate === iso;
            const isToday = iso === today;

            return (
              <button
                key={iso}
                type="button"
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
