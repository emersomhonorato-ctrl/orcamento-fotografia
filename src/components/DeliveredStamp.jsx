// Selo "carimbado" sobre a foto de capa quando a entrega foi feita (só no admin).
export default function DeliveredStamp({ digital, prints }) {
  if (!digital && !prints) return null;
  const both = digital && prints;
  const title = both ? "Entregue" : digital ? "Digital entregue" : "Reveladas entregues";
  const color = both ? "border-emerald-300 text-emerald-200 bg-emerald-950/45" : "border-sky-200 text-sky-100 bg-sky-950/45";
  const when = (value) => (value ? new Date(value).toLocaleDateString("pt-BR") : null);
  const lines = [digital ? `Digital ✓ ${when(digital)}` : null, prints ? `Reveladas ✓ ${when(prints)}` : null].filter(Boolean);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-10 flex justify-center">
      <div className={`-rotate-6 rounded-lg border-[3px] px-4 py-1.5 text-center shadow-lg backdrop-blur-[1px] ${color}`}>
        <p className="text-xl font-black uppercase tracking-[0.18em]">{title}</p>
        <p className="text-[10px] font-semibold uppercase tracking-wider opacity-90">{lines.join(" • ")}</p>
      </div>
    </div>
  );
}

export function DeliveredToggles({ digital, prints, onToggle, compact = false }) {
  const base = "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition";
  const on = "border-emerald-300 bg-emerald-50 text-emerald-800";
  const off = "border-slate-200 bg-white text-slate-600 hover:bg-slate-50";
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!compact ? <span className="text-[11px] font-semibold text-slate-500">Entrega:</span> : null}
      <button type="button" aria-pressed={Boolean(digital)} className={`${base} ${digital ? on : off}`} onClick={() => onToggle("digital_delivered_at")}>
        {digital ? "✓" : "○"} Digital entregue
      </button>
      <button type="button" aria-pressed={Boolean(prints)} className={`${base} ${prints ? on : off}`} onClick={() => onToggle("prints_delivered_at")}>
        {prints ? "✓" : "○"} Reveladas entregues
      </button>
    </div>
  );
}
