export default function StatusBadge({ value }) {
  const map = {
    Pendente: "bg-amber-100 text-amber-800 border-amber-200",
    Confirmado: "bg-blue-100 text-blue-800 border-blue-200",
    Concluído: "bg-emerald-100 text-emerald-800 border-emerald-200",
    Cancelado: "bg-red-100 text-red-800 border-red-200",
    Pago: "bg-emerald-100 text-emerald-800 border-emerald-200",
    "Entrada paga": "bg-violet-100 text-violet-800 border-violet-200",
    Atrasado: "bg-red-100 text-red-800 border-red-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
        map[value] || "bg-slate-100 text-slate-800 border-slate-200"
      }`}
    >
      {value}
    </span>
  );
}