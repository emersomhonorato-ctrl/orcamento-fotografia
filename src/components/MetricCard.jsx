import { Card, CardContent } from "@/components/ui/card";

export default function MetricCard({ title, value, subtitle, icon: Icon }) {
  return (
    <Card className="rounded-3xl border-0 bg-white/80 shadow-sm backdrop-blur">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{title}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{typeof value === "string" && value.includes("R$") ? <span className="text-emerald-600">{value}</span> : value}</p>
            {subtitle ? <p className="mt-2 text-xs text-slate-500">{subtitle}</p> : null}
          </div>
          <div className="rounded-2xl bg-slate-100 p-3">
            <Icon className="h-5 w-5 text-slate-700" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}