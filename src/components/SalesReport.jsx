import { useEffect, useMemo, useState } from "react";
import { BarChart3, Megaphone, Target, TrendingUp } from "lucide-react";
import { supabase } from "@/supabase";
import { formatCurrency } from "@/utils/formatters";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeSource(value) {
  const text = value === null || value === undefined ? "" : String(value);
  const t = text.toLowerCase();
  if (!t.trim()) return "Não informado";
  if (t.includes("insta")) return "Instagram";
  if (t.includes("google") || t.includes("pesquisa")) return "Google";
  if (t.includes("indica") || t.includes("amig") || t.includes("famil")) return "Indicação";
  if (t.includes("face")) return "Facebook";
  if (t.includes("whats")) return "WhatsApp";
  if (t.includes("tiktok")) return "TikTok";
  if (t.includes("já sou") || t.includes("ja sou") || t.includes("cliente")) return "Já era cliente";
  return text.trim().slice(0, 24);
}

function Bar({ label, value, max, display, tone = "bg-[#7f274f]" }) {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm">
      <span className="truncate text-slate-600" title={label}>{label}</span>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
      </div>
      <span className="min-w-[72px] text-right font-medium text-slate-900">{display}</span>
    </div>
  );
}

// Relatório de vendas: faturamento, tipos de ensaio, ticket médio, conversão e origem dos clientes
export default function SalesReport({ events = [], budgets = [] }) {
  const [sources, setSources] = useState([]);

  useEffect(() => {
    let active = true;
    supabase
      .from("budget_requests")
      .select("how_found, referral_code")
      .order("created_at", { ascending: false })
      .limit(1000)
      .then(({ data, error }) => {
        if (active && !error && data) setSources(data);
      });
    return () => {
      active = false;
    };
  }, []);

  const report = useMemo(() => {
    const valid = events.filter((item) => item.status !== "Cancelado" && item.eventDate);
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: monthKey(d), label: `${MONTHS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, total: 0, paid: 0, count: 0 });
    }
    const byMonth = new Map(months.map((m) => [m.key, m]));
    const byType = new Map();
    let yearTotal = 0;
    let yearCount = 0;
    const thisYear = String(now.getFullYear());

    valid.forEach((item) => {
      const amount = Number(item.computedAmount || item.amount || 0);
      const month = byMonth.get(String(item.eventDate).slice(0, 7));
      if (month) {
        month.total += amount;
        month.paid += Number(item.amountPaid || 0);
        month.count += 1;
      }
      if (String(item.eventDate).startsWith(thisYear)) {
        yearTotal += amount;
        yearCount += 1;
      }
      const type = String(item.eventType || "Outros").trim() || "Outros";
      const current = byType.get(type) || { type, total: 0, count: 0 };
      current.total += amount;
      current.count += 1;
      byType.set(type, current);
    });

    const converted = events.filter((item) => item.convertedFromBudget).length;
    const lost = budgets.filter((item) => item.status === "Cancelado");
    const open = budgets.filter((item) => item.status !== "Cancelado").length;
    const decided = converted + lost.length;
    const reasons = new Map();
    lost.forEach((item) => {
      const reason = String(item.lostReason || "Sem motivo registrado").trim() || "Sem motivo registrado";
      reasons.set(reason, (reasons.get(reason) || 0) + 1);
    });

    const sourceCounts = new Map();
    sources.forEach((row) => {
      const key = row.referral_code ? "Indicação (código)" : normalizeSource(row.how_found);
      sourceCounts.set(key, (sourceCounts.get(key) || 0) + 1);
    });

    return {
      months,
      maxMonth: Math.max(...months.map((m) => m.total), 0),
      last12: months.reduce((sum, m) => sum + m.total, 0),
      types: Array.from(byType.values()).sort((a, b) => b.total - a.total).slice(0, 8),
      yearTotal,
      ticket: yearCount ? yearTotal / yearCount : 0,
      yearCount,
      converted,
      lost: lost.length,
      open,
      conversion: decided ? Math.round((converted / decided) * 100) : null,
      reasons: Array.from(reasons.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6),
      sources: Array.from(sourceCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8),
      sourceTotal: sources.length,
    };
  }, [events, budgets, sources]);

  const maxType = Math.max(...report.types.map((t) => t.total), 0);
  const maxSource = Math.max(...report.sources.map(([, n]) => n), 0);
  const maxReason = Math.max(...report.reasons.map(([, n]) => n), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [<TrendingUp key="i" className="h-5 w-5 text-[#7f274f]" />, "Faturamento no ano", formatCurrency(report.yearTotal), `${report.yearCount} trabalhos em ${new Date().getFullYear()}`],
          [<BarChart3 key="i" className="h-5 w-5 text-[#7f274f]" />, "Ticket médio", formatCurrency(report.ticket), "valor médio por trabalho no ano"],
          [<Target key="i" className="h-5 w-5 text-[#7f274f]" />, "Orçamentos que viram contrato", report.conversion === null ? "—" : `${report.conversion}%`, `${report.converted} fechados • ${report.lost} perdidos • ${report.open} em aberto`],
          [<Megaphone key="i" className="h-5 w-5 text-[#7f274f]" />, "Pedidos pelo formulário", String(report.sourceTotal), report.sources[0] ? `mais vêm de: ${report.sources[0][0]}` : "ainda sem pedidos"],
        ].map(([icon, title, value, hint]) => (
          <div key={title} className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_50px_rgba(40,52,84,0.08)]">
            {icon}
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{hint}</p>
          </div>
        ))}
      </div>

      <div className="rounded-[30px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_50px_rgba(40,52,84,0.08)]">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Faturamento por mês</h3>
            <p className="text-sm text-slate-500">Últimos 12 meses pela data do trabalho • total {formatCurrency(report.last12)}</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#7f274f]/25" />Previsto</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#7f274f]" />Recebido</span>
          </div>
        </div>
        <div className="mt-6 flex h-48 items-end gap-2">
          {report.months.map((m) => {
            const h = report.maxMonth ? Math.round((m.total / report.maxMonth) * 100) : 0;
            const p = m.total ? Math.round((Math.min(m.paid, m.total) / m.total) * h) : 0;
            return (
              <div key={m.key} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${m.label}: ${formatCurrency(m.total)} (${m.count} trabalhos) • recebido ${formatCurrency(m.paid)}`}>
                <span className="text-[10px] font-medium text-slate-500 opacity-0 transition group-hover:opacity-100">{m.total ? formatCurrency(m.total).replace(",00", "") : ""}</span>
                <div className="relative w-full max-w-[40px] overflow-hidden rounded-t-lg bg-[#7f274f]/20" style={{ height: `${Math.max(h, m.total ? 3 : 0)}%` }}>
                  <div className="absolute bottom-0 left-0 right-0 bg-[#7f274f]" style={{ height: h ? `${(p / h) * 100}%` : 0 }} />
                </div>
                <span className="text-[10px] text-slate-500">{m.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-[30px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_50px_rgba(40,52,84,0.08)]">
          <h3 className="text-lg font-semibold text-slate-900">O que mais vende</h3>
          <p className="mb-4 text-sm text-slate-500">Faturamento por tipo de trabalho (todos os tempos)</p>
          <div className="space-y-3">
            {report.types.length ? report.types.map((t) => (
              <Bar key={t.type} label={`${t.type} (${t.count})`} value={t.total} max={maxType} display={formatCurrency(t.total).replace(",00", "")} />
            )) : <p className="text-sm text-slate-500">Sem dados ainda.</p>}
          </div>
        </div>
        <div className="rounded-[30px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_50px_rgba(40,52,84,0.08)]">
          <h3 className="text-lg font-semibold text-slate-900">De onde vêm os clientes</h3>
          <p className="mb-4 text-sm text-slate-500">Resposta do formulário “como nos conheceu”</p>
          <div className="space-y-3">
            {report.sources.length ? report.sources.map(([name, n]) => (
              <Bar key={name} label={name} value={n} max={maxSource} display={`${n} (${Math.round((n / report.sourceTotal) * 100)}%)`} tone="bg-amber-500" />
            )) : <p className="text-sm text-slate-500">Os dados aparecem conforme chegam pedidos pelo formulário.</p>}
          </div>
        </div>
        <div className="rounded-[30px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_50px_rgba(40,52,84,0.08)]">
          <h3 className="text-lg font-semibold text-slate-900">Por que perco orçamentos</h3>
          <p className="mb-4 text-sm text-slate-500">Motivo informado ao cancelar um orçamento</p>
          <div className="space-y-3">
            {report.reasons.length ? report.reasons.map(([name, n]) => (
              <Bar key={name} label={name} value={n} max={maxReason} display={String(n)} tone="bg-slate-500" />
            )) : <p className="text-sm text-slate-500">Nenhum orçamento perdido. 🎉</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
