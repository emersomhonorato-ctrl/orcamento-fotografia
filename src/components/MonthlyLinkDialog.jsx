import { useEffect, useState } from "react";
import { CalendarClock, Copy, MessageCircle, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/supabase";
import { openExternal } from "@/lib/openExternal";
import { buildWhatsAppLink } from "@/utils/whatsappMessages";

// Link para o cliente do acompanhamento mensal marcar as sessões sozinho.

export const MONTHLY_PUBLIC_BASE = "https://orcamento.emersonhonoratoretratos.com.br/mensal/";

export const MONTHLY_DEFAULTS = {
  weekday_from: "18:00",
  weekday_to: "21:00",
  weekend_from: "08:00",
  weekend_to: "18:00",
  duration_minutes: 120,
  gap_minutes: 120,
  min_notice_hours: 24,
  months_ahead: 2,
};

export function newMonthlyToken() {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hoursLabel(minutes) {
  const h = Number(minutes) / 60;
  return `${String(h).replace(".", ",")} h`;
}

export default function MonthlyLinkDialog({ record, token, onClose }) {
  const [copied, setCopied] = useState(false);
  const [cfg, setCfg] = useState(null);
  const [draft, setDraft] = useState(null);
  const [message, setMessage] = useState("");
  const link = `${MONTHLY_PUBLIC_BASE}${token}`;
  const firstName = String(record.clientName || "").trim().split(/\s+/)[0] || "";
  const phone = record.whatsapp || record.phone || "";
  const text = `Olá${firstName ? `, ${firstName}` : ""}! 😊 Por este link você marca as sessões do acompanhamento mensal, escolhendo o dia e o horário livres na minha agenda:\n${link}`;

  useEffect(() => {
    let active = true;
    supabase.from("studio_settings").select("monthly_booking").eq("id", 1).maybeSingle().then(({ data, error }) => {
      if (!active) return;
      if (error) setMessage(/monthly_booking/.test(error.message) ? "Falta atualizar o banco (supabase/agendamento-mensal.sql)." : error.message);
      setCfg({ ...MONTHLY_DEFAULTS, ...(data?.monthly_booking || {}) });
    });
    return () => {
      active = false;
    };
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copie o link:", link);
    }
  }

  async function saveCfg() {
    const value = {
      weekday_from: draft.weekday_from || MONTHLY_DEFAULTS.weekday_from,
      weekday_to: draft.weekday_to || MONTHLY_DEFAULTS.weekday_to,
      weekend_from: draft.weekend_from || MONTHLY_DEFAULTS.weekend_from,
      weekend_to: draft.weekend_to || MONTHLY_DEFAULTS.weekend_to,
      duration_minutes: Math.max(30, Math.round(Number(String(draft.duration_hours).replace(",", ".")) * 60) || 120),
      gap_minutes: Math.max(0, Math.round(Number(String(draft.gap_hours).replace(",", ".")) * 60) || 0),
      min_notice_hours: Math.max(0, Number(draft.min_notice_hours) || 0),
      months_ahead: Math.min(6, Math.max(1, Number(draft.months_ahead) || 2)),
    };
    const { error } = await supabase.from("studio_settings").upsert({ id: 1, monthly_booking: value, updated_at: new Date().toISOString() });
    if (error) return setMessage(/monthly_booking/.test(error.message) ? "Falta atualizar o banco (supabase/agendamento-mensal.sql)." : `Erro ao salvar: ${error.message}`);
    setCfg(value);
    setDraft(null);
    setMessage("Horários salvos. Valem para todos os links mensais.");
  }

  const field = (key, props = {}) => <Input id={`mensal-${key}`} value={draft[key] ?? ""} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} {...props} />;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-3" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold"><CalendarClock className="h-4 w-4" />Link de agendamento mensal</h3>
          <button type="button" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Fechar"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-sm text-slate-600">{record.clientName || "Cliente"} escolhe o dia e o horário livres. A sessão entra confirmada na agenda, ligada a este contrato.</p>

        <div className="mt-3 break-all rounded-2xl bg-slate-50 p-3 font-mono text-xs text-slate-700">{link}</div>
        <p className="mt-1 text-[11px] text-slate-500">Se o link acabou de ser criado, ele começa a funcionar assim que o app salvar (alguns segundos).</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button className="rounded-2xl" onClick={() => openExternal(phone ? buildWhatsAppLink(phone, text) : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`)}><MessageCircle className="mr-2 h-4 w-4" />Enviar no WhatsApp</Button>
          <Button variant="outline" className="rounded-2xl" onClick={copy}><Copy className="mr-2 h-4 w-4" />{copied ? "Copiado!" : "Copiar link"}</Button>
          <Button variant="ghost" className="rounded-2xl" onClick={() => openExternal(link.replace(MONTHLY_PUBLIC_BASE, `${window.location.origin}/mensal/`))}>Ver como o cliente</Button>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Horários que o link oferece</p>
            {cfg && !draft ? (
              <button type="button" className="text-xs font-semibold underline" onClick={() => setDraft({ ...cfg, duration_hours: String(cfg.duration_minutes / 60).replace(".", ","), gap_hours: String(cfg.gap_minutes / 60).replace(".", ",") })}>Mudar</button>
            ) : null}
          </div>
          {!cfg ? <p className="mt-2 text-sm text-slate-500">Carregando…</p> : null}
          {cfg && !draft ? (
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              <li>Segunda a sexta: das {cfg.weekday_from} às {cfg.weekday_to}</li>
              <li>Sábado e domingo: das {cfg.weekend_from} às {cfg.weekend_to}</li>
              <li>Sessão de {hoursLabel(cfg.duration_minutes)}, com {hoursLabel(cfg.gap_minutes)} livres antes e depois de outro trabalho</li>
              <li>Uma por mês, até {cfg.months_ahead} {Number(cfg.months_ahead) === 1 ? "mês" : "meses"} à frente; antecedência mínima de {cfg.min_notice_hours} h</li>
            </ul>
          ) : null}
          {draft ? (
            <div className="mt-3 grid gap-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1"><Label htmlFor="mensal-weekday_from">Seg a sex, a partir de</Label>{field("weekday_from", { type: "time" })}</div>
                <div className="grid gap-1"><Label htmlFor="mensal-weekday_to">até</Label>{field("weekday_to", { type: "time" })}</div>
                <div className="grid gap-1"><Label htmlFor="mensal-weekend_from">Sáb e dom, a partir de</Label>{field("weekend_from", { type: "time" })}</div>
                <div className="grid gap-1"><Label htmlFor="mensal-weekend_to">até</Label>{field("weekend_to", { type: "time" })}</div>
                <div className="grid gap-1"><Label htmlFor="mensal-duration_hours">Duração (horas)</Label>{field("duration_hours", { inputMode: "decimal" })}</div>
                <div className="grid gap-1"><Label htmlFor="mensal-gap_hours">Folga entre ensaios (horas)</Label>{field("gap_hours", { inputMode: "decimal" })}</div>
                <div className="grid gap-1"><Label htmlFor="mensal-min_notice_hours">Antecedência mínima (horas)</Label>{field("min_notice_hours", { inputMode: "numeric" })}</div>
                <div className="grid gap-1"><Label htmlFor="mensal-months_ahead">Meses abertos</Label>{field("months_ahead", { inputMode: "numeric" })}</div>
              </div>
              <p className="text-[11px] text-slate-500">"Até" é o horário em que a sessão precisa terminar.</p>
              <div className="flex gap-2">
                <Button className="rounded-2xl" onClick={saveCfg}><Save className="mr-2 h-4 w-4" />Salvar</Button>
                <Button variant="ghost" className="rounded-2xl" onClick={() => setDraft(null)}>Cancelar</Button>
              </div>
            </div>
          ) : null}
        </div>
        {message ? <p className="mt-3 rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</p> : null}
      </div>
    </div>
  );
}
