import { useState } from "react";
import { Pencil, Target } from "lucide-react";

const brl = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Meta de faturamento do mês: barra de progresso + edição rápida
export default function MonthGoalBar({ monthLabel, goal = 0, value = 0, onSave }) {
  const [draft, setDraft] = useState(null);
  const percent = goal > 0 ? Math.round((value / goal) * 100) : 0;
  const missing = Math.max(goal - value, 0);

  function save() {
    const parsed = Number(String(draft || "").replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, ""));
    onSave?.(Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0);
    setDraft(null);
  }

  return (
    <div className="mt-3 rounded-2xl border border-stone-200 bg-white px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <Target className="h-4 w-4 text-stone-500" />
        <p className="text-sm font-semibold text-stone-900">Meta de faturamento</p>
        {draft !== null ? (
          <div className="flex items-center gap-2">
            <input autoFocus inputMode="decimal" className="h-8 w-32 rounded-lg border border-stone-300 px-2 text-sm" placeholder="Ex.: 15000" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") save(); if (event.key === "Escape") setDraft(null); }} />
            <button type="button" className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white" onClick={save}>Salvar</button>
            <button type="button" className="text-xs text-stone-500" onClick={() => setDraft(null)}>Cancelar</button>
          </div>
        ) : (
          <button type="button" className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800" onClick={() => setDraft(goal ? String(goal) : "")}>
            <Pencil className="h-3 w-3" />{goal ? `${brl(goal)} por mês` : "Definir meta mensal"}
          </button>
        )}
        {goal > 0 ? (
          <p className="ml-auto text-sm text-stone-600">
            <strong className={percent >= 100 ? "text-emerald-700" : "text-stone-900"}>{percent}%</strong> de {monthLabel}
            {missing > 0 ? ` • faltam ${brl(missing)}` : " • meta batida! 🎉"}
          </p>
        ) : null}
      </div>
      {goal > 0 ? (
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-stone-100">
          <div className={`h-full rounded-full transition-all ${percent >= 100 ? "bg-emerald-500" : "bg-[#7a1712]"}`} style={{ width: `${Math.min(percent, 100)}%` }} />
        </div>
      ) : null}
    </div>
  );
}
