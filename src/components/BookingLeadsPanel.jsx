import { useEffect, useMemo, useState } from "react";
import { Send, Users } from "lucide-react";
import { supabase } from "@/supabase";
import { buildWhatsAppLink } from "@/utils/whatsappMessages";
import { openExternal } from "@/lib/openExternal";

const digits = (value) => String(value || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");

// Quem deixou nome e WhatsApp para ver os valores, mas ainda não reservou
export default function BookingLeadsPanel({ campaignId, campaignTitle, bookings = [], publicUrl }) {
  const [leads, setLeads] = useState([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let active = true;
    supabase
      .from("booking_leads")
      .select("id, created_at, name, whatsapp")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        if (active && !error && Array.isArray(data)) setLeads(data);
      });
    return () => {
      active = false;
    };
  }, [campaignId, bookings.length]);

  const pending = useMemo(() => {
    const booked = new Set(bookings.filter((item) => item.status !== "cancelado").map((item) => digits(item.whatsapp)));
    const seen = new Set();
    return leads.filter((lead) => {
      const key = digits(lead.whatsapp);
      if (!key || booked.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [leads, bookings]);

  if (!pending.length) return null;
  const visible = showAll ? pending : pending.slice(0, 8);

  function invite(lead) {
    const first = String(lead.name || "").trim().split(/\s+/)[0] || "";
    const text = `Oi${first ? `, ${first}` : ""}! Tudo bem? Vi que você olhou os pacotes do *${campaignTitle || "Ensaio de Natal"}* 🎄 Ficou alguma dúvida? Os horários estão acabando. Se quiser garantir o seu, é por aqui: ${publicUrl}\n\nEmerson Honorato Retratos`;
    openExternal(buildWhatsAppLink(lead.whatsapp, text));
  }

  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-4">
      <p className="flex items-center gap-2 font-semibold text-amber-900"><Users className="h-4 w-4" />Interessados que ainda não reservaram ({pending.length})</p>
      <p className="mt-1 text-xs text-amber-800">Deixaram nome e WhatsApp para ver os valores. Um convite pessoal costuma fechar a reserva.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {visible.map((lead) => (
          <div key={lead.id} className="flex items-center justify-between gap-2 rounded-2xl bg-white px-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900">{lead.name}</p>
              <p className="text-xs text-slate-500">{lead.whatsapp} • {new Date(lead.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</p>
            </div>
            <button type="button" onClick={() => invite(lead)} className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"><Send className="h-3.5 w-3.5" />Convidar</button>
          </div>
        ))}
      </div>
      {pending.length > 8 ? (
        <button type="button" onClick={() => setShowAll((value) => !value)} className="mt-2 text-xs font-medium text-amber-900 underline">{showAll ? "Mostrar menos" : `Ver todos (${pending.length})`}</button>
      ) : null}
    </div>
  );
}
