import { useMemo } from "react";
import { HeartHandshake, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildWhatsAppLink } from "@/utils/whatsappMessages";
import { formatDateBR, getTodayLocalISO } from "@/utils/formatters";

// Regras de "próximo ensaio": a partir do tipo do trabalho, sugere o próximo contato
const RULES = [
  { id: "newborn", match: /gestante|gr[aá]vida|maternidade|barriga/i, days: 35, offer: "Ensaio Newborn", text: (n) => `Oi, ${n}! 💛 Como vocês estão? O bebê já chegou ou está chegando? O newborn fica mais lindo nos primeiros 15 dias de vida — quer que eu já reserve uma data pra vocês?` },
  { id: "acompanhamento", match: /newborn|rec[eé]m[- ]?nascido/i, days: 80, offer: "Acompanhamento do bebê", text: (n) => `Oi, ${n}! 💛 O bebê já deve estar enorme! Que tal registrar essa fase com um ensaio de acompanhamento? Cada mês muda tudo — posso te mandar as opções?` },
  { id: "smash", match: /newborn|rec[eé]m[- ]?nascido|acompanhamento|mensal/i, days: 320, offer: "Smash the Cake (1 ano)", text: (n) => `Oi, ${n}! 🎂 O primeiro aninho está chegando! Vamos fazer um Smash the Cake pra comemorar? Posso te passar os temas e as datas disponíveis.` },
  { id: "bodas", match: /casamento|wedding|noiv/i, days: 330, offer: "Ensaio de 1 ano de casados", text: (n) => `Oi, ${n}! 💍 Já vai fazer 1 ano do casamento! Que tal um ensaio pra comemorar as bodas de papel? Posso montar uma proposta especial pra vocês.` },
  { id: "natal", match: /natal/i, days: 300, offer: "Ensaio de Natal deste ano", text: (n) => `Oi, ${n}! 🎄 A agenda de Natal deste ano já vai abrir! Quer garantir o seu horário antes de todo mundo?` },
  { id: "anual", match: /fam[ií]lia|infantil|individual|anivers[aá]rio|ensaio|retrato|15 anos|debutante/i, days: 330, offer: "Ensaio anual", text: (n) => `Oi, ${n}! 📸 Já faz quase um ano do nosso ensaio! Que tal registrar como estão agora? Posso te mandar as opções e datas.` },
];

function addDaysISO(dateISO, days) {
  const d = new Date(`${dateISO}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function FollowUpPanel({ events = [], settings = {}, onUpdateSettings }) {
  const today = getTodayLocalISO();
  const contacted = settings.followupContacted || {};
  const dismissed = settings.followupDismissed || {};

  const suggestions = useMemo(() => {
    const done = events.filter((e) => e.status !== "Cancelado" && e.eventDate && e.eventDate <= today);
    const clientKey = (e) => (e.clientId || e.clientName || "").toString().trim().toLowerCase();
    const list = [];
    done.forEach((record) => {
      const label = `${record.eventType || ""} ${record.packageName || ""}`;
      const rules = RULES.filter((r) => r.match.test(label));
      const specific = rules.filter((r) => r.id !== "anual");
      (specific.length ? specific : rules).forEach((r) => {
        const key = `${record.id}:${r.id}`;
        if (contacted[key] || dismissed[key]) return;
        const due = addDaysISO(record.eventDate, r.days);
        const from = addDaysISO(due, -10);
        const until = addDaysISO(due, 75);
        if (today < from || today > until) return;
        // se o cliente já voltou depois disso, não precisa sugerir
        const laterEvents = events.filter((e) => e.id !== record.id && clientKey(e) === clientKey(record) && e.status !== "Cancelado" && e.eventDate > record.eventDate);
        if (r.id === "smash" ? laterEvents.some((e) => /smash|1 ano|anivers/i.test(e.eventType || "")) : laterEvents.length > 0) return;
        list.push({ key, record, rule: r, due });
      });
    });
    return list.sort((a, b) => a.due.localeCompare(b.due)).slice(0, 12);
  }, [events, today, contacted, dismissed]);

  function mark(field, key) {
    onUpdateSettings?.({ [field]: { ...(settings[field] || {}), [key]: today } });
  }

  function send(item) {
    const first = String(item.record.clientName || "").trim().split(/\s+/)[0] || "tudo bem";
    const phone = item.record.whatsapp || item.record.phone;
    const text = `${item.rule.text(first)}\n\n${settings.studioName || "Emerson Honorato Retratos"}`;
    const url = phone ? buildWhatsAppLink(phone, text) : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener");
    mark("followupContacted", item.key);
  }

  return (
    <div className="rounded-[30px] border border-emerald-100 bg-gradient-to-br from-emerald-50/70 via-white to-white p-6 shadow-[0_18px_50px_rgba(40,52,84,0.08)]">
      <div className="flex items-center gap-2">
        <HeartHandshake className="h-5 w-5 text-emerald-700" />
        <h3 className="text-lg font-semibold text-slate-900">Hora de oferecer o próximo ensaio</h3>
      </div>
      <p className="mt-1 text-sm text-slate-500">Clientes que estão no momento certo para voltar (gestante → newborn → acompanhamento → 1 ano, casamento → bodas, ensaio anual).</p>
      <div className="mt-4 space-y-2">
        {suggestions.length === 0 ? (
          <p className="rounded-2xl bg-white/80 px-4 py-3 text-sm text-slate-500">Ninguém no momento. As sugestões aparecem sozinhas conforme as datas chegam.</p>
        ) : suggestions.map((item) => (
          <div key={item.key} className="flex flex-wrap items-center gap-3 rounded-2xl border border-white bg-white/90 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">{item.record.clientName || "Cliente"} → <span className="text-emerald-700">{item.rule.offer}</span></p>
              <p className="text-xs text-slate-500">Fez {item.record.eventType || "trabalho"} em {formatDateBR(item.record.eventDate)} • ideal por volta de {formatDateBR(item.due)}</p>
            </div>
            <Button size="sm" className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => send(item)}><Send className="mr-1.5 h-3.5 w-3.5" />Mandar mensagem</Button>
            <button type="button" title="Dispensar" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100" onClick={() => mark("followupDismissed", item.key)}><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
