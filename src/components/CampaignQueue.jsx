import { useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, Megaphone, Send, SkipForward, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const CAMPAIGN_ID = "natal-2026";
const TEAM_EMAILS = ["emersomhonorato@gmail.com", "isahonoratoneuropsicopedagoga@gmail.com"];
const DEFAULT_MESSAGE = "Oi, {nome}! Tudo bem? 🎄 Está aberta a agenda dos *Ensaios de Natal 2026* aqui no estúdio: 30 minutos só para a sua família, com cenário de Natal e você escolhe as fotos preferidas depois. Os horários são por ordem de reserva. Veja os pacotes e escolha o seu horário por aqui: https://orcamento.emersonhonoratoretratos.com.br/natal\n\nEmerson Honorato Retratos";
const FAMILY_HINT = /fam[ií]lia|infantil|newborn|gestante|acompanhamento|mensal|mesvers|ch[áa] de|bebe|bebê|anivers|natal/i;

function phoneDigits(client) {
  const digits = String(client.whatsapp || client.phone || "").replace(/\D/g, "");
  if (digits.length < 10) return "";
  return digits.startsWith("55") && digits.length > 11 ? digits : `55${digits}`;
}

function firstName(name = "") {
  const first = String(name).trim().split(/[\s_\-]+/)[0] || "";
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : "";
}

// Fila de envio pelo WhatsApp: um cliente por vez, mensagem pronta, sem disparo automático (evita bloqueio do número)
export default function CampaignQueue({ clients = [], events = [], settings = {}, onUpdateSettings }) {
  const [open, setOpen] = useState(false);
  const [segment, setSegment] = useState("familias");
  const [message, setMessage] = useState(settings.campaignMessage?.[CAMPAIGN_ID] || DEFAULT_MESSAGE);
  const [index, setIndex] = useState(0);
  const sent = useMemo(() => settings.campaignSent?.[CAMPAIGN_ID] || {}, [settings.campaignSent]);

  const familyIds = useMemo(() => {
    const ids = new Set();
    events.forEach((event) => {
      if (event && event.clientId && FAMILY_HINT.test(`${event.eventType || ""} ${event.packageName || ""}`)) ids.add(event.clientId);
    });
    return ids;
  }, [events]);

  const queue = useMemo(() => clients
    .filter((client) => phoneDigits(client) && !TEAM_EMAILS.includes(String(client.email || "").toLowerCase()))
    .filter((client) => segment === "todos" || familyIds.has(client.id) || FAMILY_HINT.test(client.notes || "") || !events.some((event) => event.clientId === client.id))
    .filter((client) => !sent[client.id])
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR")), [clients, segment, familyIds, events, sent]);

  const current = queue[Math.min(index, Math.max(queue.length - 1, 0))];
  const sentCount = Object.keys(sent).length;
  const text = current ? message.replace(/\{nome\}/g, firstName(current.name)) : "";
  const link = current ? `https://api.whatsapp.com/send?phone=${phoneDigits(current)}&text=${encodeURIComponent(text)}` : "";

  function markSent(client) {
    onUpdateSettings({
      campaignSent: { ...(settings.campaignSent || {}), [CAMPAIGN_ID]: { ...sent, [client.id]: new Date().toISOString() } },
      campaignMessage: { ...(settings.campaignMessage || {}), [CAMPAIGN_ID]: message },
    });
  }

  function sendCurrent() {
    if (!current) return;
    window.open(link, "_blank", "noopener,noreferrer");
    markSent(current);
  }

  function skip() {
    setIndex((value) => (value + 1 < queue.length ? value + 1 : 0));
  }

  function restart() {
    if (!window.confirm("Recomeçar a lista? Todos os clientes voltam para a fila, inclusive quem já recebeu.")) return;
    onUpdateSettings({ campaignSent: { ...(settings.campaignSent || {}), [CAMPAIGN_ID]: {} } });
    setIndex(0);
  }

  return (
    <>
      <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setOpen(true)}>
        <Megaphone className="mr-2 h-4 w-4" />Avisar clientes (Natal)
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Avisar clientes pelo WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-stone-500">Um cliente por vez: toque em <strong>Enviar</strong>, o WhatsApp abre com a mensagem pronta, você confirma o envio e volta aqui para o próximo. {sentCount ? `Já avisados: ${sentCount}.` : ""}</p>
            <div className="flex flex-wrap gap-2">
              {[["familias", "Famílias e perfil Natal"], ["todos", "Todos com WhatsApp"]].map(([value, label]) => (
                <button key={value} type="button" onClick={() => { setSegment(value); setIndex(0); }} className={`rounded-full border px-4 py-1.5 ${segment === value ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white text-stone-700"}`}>{label}</button>
              ))}
            </div>
            <div className="space-y-1.5">
              <p className="font-medium text-stone-800">Mensagem <span className="font-normal text-stone-500">({"{nome}"} vira o primeiro nome do cliente)</span></p>
              <Textarea rows={6} value={message} onChange={(event) => setMessage(event.target.value)} />
            </div>
            {current ? (
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold text-stone-900">{current.name}</p>
                    <p className="text-xs text-stone-500">{current.whatsapp || current.phone}</p>
                  </div>
                  <p className="text-xs text-stone-500">{Math.min(index, queue.length - 1) + 1} de {queue.length} na fila</p>
                </div>
                <p className="mt-3 whitespace-pre-line rounded-xl bg-white p-3 text-[13px] leading-5 text-stone-700">{text}</p>
              </div>
            ) : (
              <p className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800"><CheckCircle2 className="h-5 w-5" />Todos desta lista já foram avisados.</p>
            )}
          </div>
          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <Button type="button" variant="ghost" className="text-stone-500" onClick={restart}><X className="mr-1.5 h-4 w-4" />Recomeçar lista</Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={!current} onClick={skip}><SkipForward className="mr-1.5 h-4 w-4" />Pular</Button>
              <Button type="button" disabled={!current} className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={sendCurrent}>
                <Send className="mr-1.5 h-4 w-4" />Enviar<ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
