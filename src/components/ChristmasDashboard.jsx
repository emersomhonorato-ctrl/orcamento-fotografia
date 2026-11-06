import { useEffect, useState } from "react";
import { CalendarCheck, Gift, Sparkles, Users } from "lucide-react";
import { supabase } from "@/supabase";
import { BOOKING_CAMPAIGN_ID, bookingTotal, fetchAllRows, formatBRL, themeEmoji } from "@/lib/bookings";

const digits = (value) => String(value || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");

function Stat({ label, value, hint, tone = "text-slate-900" }) {
  return (
    <div className="rounded-2xl bg-white/80 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tracking-tight ${tone}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

// Painel da campanha de ensaios (Natal) no Dashboard
export default function ChristmasDashboard({ onOpenBookings }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from("booking_campaigns").select("id, title, active, slot_minutes").eq("id", BOOKING_CAMPAIGN_ID).maybeSingle(),
      fetchAllRows(() => supabase.from("booking_slots").select("id, status, starts_at").eq("campaign_id", BOOKING_CAMPAIGN_ID).order("starts_at")),
      fetchAllRows(() => supabase.from("bookings").select("*").eq("campaign_id", BOOKING_CAMPAIGN_ID).order("created_at")),
      fetchAllRows(() => supabase.from("booking_leads").select("id, whatsapp").eq("campaign_id", BOOKING_CAMPAIGN_ID).order("created_at")),
    ]).then(([campaignRes, slotsRes, bookingsRes, leadsRes]) => {
      if (!active || campaignRes.error || !campaignRes.data) return;
      setData({ campaign: campaignRes.data, slots: slotsRes.data || [], bookings: bookingsRes.data || [], leads: leadsRes.data || [] });
    });
    return () => {
      active = false;
    };
  }, []);

  if (!data?.campaign?.active) return null;
  const { campaign, slots, bookings, leads } = data;
  // eslint-disable-next-line react-hooks/purity -- só compara com a hora atual para contar horários futuros
  const now = Date.now();
  const live = bookings.filter((item) => item.status === "aguardando_sinal" || item.status === "confirmado");
  const confirmed = live.filter((item) => item.status === "confirmado");
  const waiting = live.filter((item) => item.status === "aguardando_sinal");
  const future = slots.filter((slot) => new Date(slot.starts_at).getTime() > now);
  const free = future.filter((slot) => slot.status === "livre").length;
  const reserved = slots.filter((slot) => slot.status === "reservado").length;
  const sellable = reserved + free;
  const occupancy = sellable ? Math.round((reserved / sellable) * 100) : 0;

  const sold = live.reduce((sum, item) => sum + bookingTotal(item), 0);
  const received = confirmed.reduce((sum, item) => sum + Math.min(Number(item.deposit_amount || 0), bookingTotal(item)), 0);
  const toReceive = Math.max(sold - received, 0);

  const leadPhones = new Set(leads.map((lead) => digits(lead.whatsapp)).filter(Boolean));
  const bookedPhones = new Set(live.map((item) => digits(item.whatsapp)).filter(Boolean));
  const converted = [...leadPhones].filter((phone) => bookedPhones.has(phone)).length;
  const conversion = leadPhones.size ? Math.round((converted / leadPhones.size) * 100) : 0;
  const referrals = live.filter((item) => /🎁 Indicação/.test(String(item.notes || ""))).length;
  const doubles = live.filter((item) => item.is_double).length;

  // Dias com mais horários livres (para divulgar)
  const freeByDay = {};
  future.filter((slot) => slot.status === "livre").forEach((slot) => {
    const key = new Date(slot.starts_at).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
    freeByDay[key] = (freeByDay[key] || 0) + 1;
  });
  const topFree = Object.entries(freeByDay).slice(0, 40).sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <section className="overflow-hidden rounded-2xl border border-[#e7d3c7] bg-gradient-to-br from-[#fff7f2] via-white to-[#f3f8f4]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#efe0d6] px-5 py-3">
        <span className="text-lg">{themeEmoji(campaign.title)}</span>
        <h2 className="text-sm font-semibold text-slate-900">{campaign.title || "Agenda online"}</h2>
        <span className="text-xs text-slate-500">{occupancy}% dos horários vendidos</span>
        {onOpenBookings ? (
          <button type="button" onClick={onOpenBookings} className="ml-auto inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50">
            <CalendarCheck className="h-3.5 w-3.5" />Abrir Ensaios
          </button>
        ) : null}
      </div>
      <div className="space-y-3 p-4">
        <div className="h-2.5 overflow-hidden rounded-full bg-[#efe0d6]">
          <div className="h-full rounded-full bg-[#7a1712]" style={{ width: `${Math.min(occupancy, 100)}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat label="Reservas" value={live.length} hint={`${confirmed.length} confirmadas • ${waiting.length} aguardando sinal`} />
          <Stat label="Horários livres" value={free} hint={`${reserved} reservados • daqui para frente`} />
          <Stat label="Vendido" value={formatBRL(sold)} hint={`${formatBRL(received)} em sinais recebidos`} tone="text-emerald-600" />
          <Stat label="A receber" value={formatBRL(toReceive)} hint="sinais pendentes + restante no dia" tone="text-amber-600" />
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <div className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3 text-sm">
            <Users className="h-4 w-4 text-slate-500" />
            <p><strong>{converted}</strong> de <strong>{leadPhones.size}</strong> interessados reservaram <span className="text-slate-500">({conversion}%)</span></p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3 text-sm">
            <Gift className="h-4 w-4 text-slate-500" />
            <p><strong>{referrals}</strong> {referrals === 1 ? "reserva veio" : "reservas vieram"} por indicação</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3 text-sm">
            <Sparkles className="h-4 w-4 text-slate-500" />
            <p><strong>{doubles}</strong> {doubles === 1 ? "ensaio" : "ensaios"} de 1 hora</p>
          </div>
        </div>
        {topFree.length ? (
          <p className="text-xs text-slate-600">
            <strong>Mais vagas para divulgar:</strong> {topFree.map(([day, count]) => `${day} (${count})`).join(" • ")}
          </p>
        ) : null}
      </div>
    </section>
  );
}
