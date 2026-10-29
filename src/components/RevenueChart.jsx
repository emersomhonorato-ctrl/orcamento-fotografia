import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { historyOf } from "@/lib/finance";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const CLOSED = "#8a2f57";
const RECEIVED = "#08957a";
const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const short = (v) => (v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : String(Math.round(v)));

function isDeal(record) {
  return record && record.status !== "Cancelado" && (record.recordType === "evento" || record.status === "Aprovado");
}

// Faturamento por mês: valor fechado (pela data do trabalho) e recebido (pela data do pagamento)
export default function RevenueChart({ records = [] }) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [hover, setHover] = useState(null);

  const data = useMemo(() => {
    const closed = { [year]: Array(12).fill(0), [year - 1]: Array(12).fill(0) };
    const received = Array(12).fill(0);
    records.filter(isDeal).forEach((record) => {
      const date = String(record.eventDate || "");
      const y = Number(date.slice(0, 4));
      const m = Number(date.slice(5, 7)) - 1;
      if (closed[y] && m >= 0 && m < 12) closed[y][m] += Number(record.computedAmount ?? record.amount ?? 0);
      historyOf(record).forEach((payment) => {
        const when = String(payment.date || record.eventDate || "");
        if (Number(when.slice(0, 4)) === year) {
          const pm = Number(when.slice(5, 7)) - 1;
          if (pm >= 0 && pm < 12) received[pm] += Number(payment.amount || 0);
        }
      });
    });
    return MONTHS.map((label, index) => ({
      label,
      closed: closed[year][index],
      received: received[index],
      lastYear: closed[year - 1][index],
    }));
  }, [records, year]);

  const totals = data.reduce((acc, item) => ({
    closed: acc.closed + item.closed,
    received: acc.received + item.received,
    lastYear: acc.lastYear + item.lastYear,
  }), { closed: 0, received: 0, lastYear: 0 });
  const growth = totals.lastYear > 0 ? ((totals.closed - totals.lastYear) / totals.lastYear) * 100 : null;
  const max = Math.max(1, ...data.flatMap((item) => [item.closed, item.received, item.lastYear]));
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const currentMonth = year === thisYear ? new Date().getMonth() : -1;

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-stone-900">Faturamento por mês</h3>
          <p className="mt-0.5 text-sm text-stone-500">
            Fechado {brl(totals.closed)} · Recebido {brl(totals.received)}
            {growth !== null ? ` · ${growth >= 0 ? "+" : ""}${growth.toFixed(0)}% vs ${year - 1}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Ano anterior" onClick={() => setYear((y) => y - 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50"><ChevronLeft className="h-4 w-4" /></button>
          <span className="w-14 text-center text-sm font-semibold text-stone-900">{year}</span>
          <button type="button" aria-label="Próximo ano" onClick={() => setYear((y) => y + 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-stone-600">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: CLOSED }} />Fechado (data do trabalho)</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: RECEIVED }} />Recebido (data do pagamento)</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 bg-stone-400" />Fechado em {year - 1}</span>
      </div>

      <div className="relative mt-4 h-56">
        <div className="absolute inset-0 left-10 flex flex-col-reverse justify-between">
          {ticks.map((tick) => (
            <div key={tick} className="relative border-t border-stone-100">
              <span className="absolute -left-10 -top-2 w-9 text-right text-[10px] text-stone-400">{short(tick)}</span>
            </div>
          ))}
        </div>
        <div className="absolute inset-0 left-10 flex items-end">
          {data.map((item, index) => (
            <div
              key={item.label}
              className="relative flex h-full flex-1 cursor-default items-end justify-center gap-[2px] px-[3px]"
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setHover(index)}
            >
              {hover === index ? <div className="absolute inset-0 rounded-md bg-stone-100/70" /> : null}
              <div className="relative w-full max-w-[14px] rounded-t-[4px]" style={{ height: `${(item.closed / max) * 100}%`, background: CLOSED, minHeight: item.closed ? 2 : 0 }} />
              <div className="relative w-full max-w-[14px] rounded-t-[4px]" style={{ height: `${(item.received / max) * 100}%`, background: RECEIVED, minHeight: item.received ? 2 : 0 }} />
              {item.lastYear > 0 ? (
                <div className="pointer-events-none absolute left-1 right-1 h-0.5 rounded bg-stone-400" style={{ bottom: `${(item.lastYear / max) * 100}%` }} />
              ) : null}
              {hover === index ? (
                <div className={`absolute bottom-full z-20 mb-1 w-44 rounded-lg border border-stone-200 bg-white p-2.5 text-xs shadow-lg ${index > 8 ? "right-0" : index < 3 ? "left-0" : "left-1/2 -translate-x-1/2"}`}>
                  <p className="font-semibold text-stone-900">{MONTHS[index]} {year}</p>
                  <p className="mt-1 flex justify-between text-stone-600"><span>Fechado</span><span className="font-medium text-stone-900">{brl(item.closed)}</span></p>
                  <p className="flex justify-between text-stone-600"><span>Recebido</span><span className="font-medium text-stone-900">{brl(item.received)}</span></p>
                  <p className="flex justify-between text-stone-500"><span>{year - 1}</span><span>{brl(item.lastYear)}</span></p>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <div className="ml-10 mt-1 flex">
        {data.map((item, index) => (
          <span key={item.label} className={`flex-1 text-center text-[10px] ${index === currentMonth ? "font-semibold text-stone-900" : "text-stone-400"}`}>{item.label}</span>
        ))}
      </div>
    </section>
  );
}
