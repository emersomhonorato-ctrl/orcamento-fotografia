import { useCallback, useEffect, useMemo, useState } from "react";
import { Gift, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/supabase";

const dateBR = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "");

function referralFromNotes(notes = "") {
  const match = String(notes).match(/Indica[çc][ãa]o:\s*([^\n]+)/i);
  return match ? match[1].trim() : "";
}

// Indique e ganhe: quem indicou, quem veio pela indicação e se o prêmio já foi entregue
export default function ReferralsPanel({ settings = {}, onUpdateSettings }) {
  const [state, setState] = useState("loading");
  const [rows, setRows] = useState([]);
  const given = useMemo(() => settings.referralRewardsGiven || {}, [settings.referralRewardsGiven]);

  const load = useCallback(async () => {
    setState("loading");
    const [deliveries, requests, bookings] = await Promise.all([
      supabase.from("photo_deliveries").select("client_name, referral_code").not("referral_code", "is", null).limit(2000),
      supabase.from("budget_requests").select("id, name, created_at, referral_code, how_found, referred_by").or("referral_code.not.is.null,how_found.eq.Indicação").order("created_at", { ascending: false }).limit(500),
      supabase.from("bookings").select("id, name, status, starts_at, notes, created_at").ilike("notes", "%Indica%").order("created_at", { ascending: false }).limit(500),
    ]);
    if (deliveries.error || requests.error || bookings.error) {
      setState("error");
      return;
    }
    const byCode = new Map((deliveries.data || []).map((d) => [String(d.referral_code).toUpperCase(), d.client_name]));
    const list = [
      ...(bookings.data || []).map((b) => {
        const said = referralFromNotes(b.notes);
        if (!said) return null;
        const code = said.toUpperCase().replace(/[^A-Z0-9-]/g, "");
        return {
          key: `booking-${b.id}`,
          who: byCode.get(code) || said,
          code: byCode.has(code) ? code : "",
          guest: b.name,
          origin: "Ensaio de Natal",
          when: b.starts_at,
          status: b.status === "confirmado" ? "agendou" : b.status === "cancelado" ? "cancelado" : "aguardando",
        };
      }).filter(Boolean),
      ...(requests.data || []).map((r) => {
        const code = String(r.referral_code || "").toUpperCase();
        return {
          key: `request-${r.id}`,
          who: byCode.get(code) || String(r.referred_by || "").trim() || code || "Não disse quem indicou",
          code,
          guest: r.name,
          origin: "Pedido de orçamento",
          when: r.created_at,
          status: "pedido",
        };
      }),
    ];
    setRows(list);
    setState("ready");
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  function toggleGiven(row) {
    const next = { ...given };
    if (next[row.key]) delete next[row.key];
    else next[row.key] = new Date().toISOString();
    onUpdateSettings({ referralRewardsGiven: next });
  }

  const pending = rows.filter((row) => row.status === "agendou" && !given[row.key]).length;
  const STATUS = {
    agendou: ["Agendou ✓", "bg-emerald-50 text-emerald-800 border-emerald-200"],
    aguardando: ["Reservou · aguardando sinal", "bg-amber-50 text-amber-800 border-amber-200"],
    cancelado: ["Cancelou", "bg-stone-100 text-stone-500 border-stone-200"],
    pedido: ["Pediu orçamento", "bg-sky-50 text-sky-800 border-sky-200"],
  };

  return (
    <Card className="studio-panel rounded-3xl border-0 bg-white/90 shadow-sm">
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold"><Gift className="h-5 w-5 text-[#7f274f]" />Indique e ganhe</h3>
            <p className="text-sm text-slate-500">Quem indicou ganha 5 fotos extras tratadas quando a família indicada agenda.{pending ? ` ${pending} prêmio(s) para entregar.` : ""}</p>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={load} disabled={state === "loading"}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
        </div>
        {state === "error" ? <p className="text-sm text-red-700">Não foi possível carregar as indicações agora.</p> : null}
        {state === "ready" && rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Nenhuma indicação ainda. Elas aparecem aqui quando alguém agenda ou pede orçamento com um código ou nome de quem indicou.</p>
        ) : null}
        {rows.length ? (
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
            {rows.map((row) => {
              const [label, tone] = STATUS[row.status];
              const done = Boolean(given[row.key]);
              return (
                <div key={row.key} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{row.who}{row.code ? <span className="ml-2 text-xs font-normal text-slate-400">código {row.code}</span> : null}</p>
                    <p className="text-xs text-slate-500">indicou <strong className="font-medium text-slate-700">{row.guest}</strong> · {row.origin}{row.when ? ` · ${dateBR(row.when)}` : ""}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone}`}>{label}</span>
                  {row.status === "agendou" || done ? (
                    <Button size="sm" variant={done ? "outline" : "default"} className={`rounded-xl ${done ? "" : "studio-primary text-white"}`} onClick={() => toggleGiven(row)}>
                      {done ? `Prêmio entregue em ${dateBR(given[row.key])}` : "Marcar prêmio entregue"}
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
