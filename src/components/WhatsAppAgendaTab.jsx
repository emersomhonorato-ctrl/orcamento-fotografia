import { useMemo, useState } from "react";
import { Bot, CalendarDays, CheckCircle2, Copy, MapPin, MessageCircle, Send, Smartphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateBR, getTodayLocalISO } from "@/utils/formatters";
import {
  DEFAULT_WHATSAPP_CLOSING,
  buildClientConfirmation,
  buildOwnerAgendaSummary,
  buildOwnerEventNotice,
  buildWhatsAppLink,
  getTimeRange,
  getWeekdayDate,
} from "@/utils/whatsappMessages";

const PERIODS = [
  { id: "hoje", label: "Hoje", days: 0 },
  { id: "amanha", label: "Amanhã", days: 1, only: true },
  { id: "7", label: "Próximos 7 dias", days: 7 },
  { id: "30", label: "Próximos 30 dias", days: 30 },
  { id: "todos", label: "Todos os próximos", days: null },
];

function addDays(iso, days) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatSentAt(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${formatDateBR(value.slice(0, 10))} às ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default function WhatsAppAgendaTab({ events = [], settings = {}, onUpdateSettings, onUpdateRecord }) {
  const [periodId, setPeriodId] = useState("7");
  const [openPreviewId, setOpenPreviewId] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const ownerNumber = settings.ownerWhatsapp || settings.studioPhone || "";
  const period = PERIODS.find((item) => item.id === periodId) || PERIODS[2];

  const periodEvents = useMemo(() => {
    const today = getTodayLocalISO();
    const start = period.only ? addDays(today, period.days) : today;
    const end = period.days === null ? "9999-12-31" : addDays(today, period.days);

    return events
      .filter((record) => record.status !== "Cancelado" && record.eventDate && record.eventDate >= start && record.eventDate <= end)
      .sort((a, b) => `${a.eventDate} ${a.startTime || "99:99"}`.localeCompare(`${b.eventDate} ${b.startTime || "99:99"}`));
  }, [events, period]);

  const pendingCount = periodEvents.filter((record) => !record.whatsappConfirmationSentAt).length;

  function openWhatsApp(phone, text) {
    const link = buildWhatsAppLink(phone, text);
    if (!link) return false;
    window.open(link, "_blank", "noopener");
    return true;
  }

  function sendToClient(record) {
    const phone = record.whatsapp || record.phone;
    if (!phone) {
      window.alert(`${record.clientName || "Este cliente"} não tem WhatsApp cadastrado. Edite o agendamento para incluir o número.`);
      return;
    }
    openWhatsApp(phone, buildClientConfirmation(record, settings));
    onUpdateRecord(record.id, { whatsappConfirmationSentAt: new Date().toISOString() });
  }

  function sendToMe(text, recordId) {
    if (!ownerNumber) {
      window.alert("Cadastre o seu WhatsApp no campo \"Meu WhatsApp\" para receber os avisos.");
      return;
    }
    openWhatsApp(ownerNumber, text);
    if (recordId) onUpdateRecord(recordId, { whatsappOwnerNoticeSentAt: new Date().toISOString() });
  }

  async function copyMessage(id, text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(""), 1800);
    } catch {
      window.prompt("Copie a mensagem:", text);
    }
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[32px] border border-emerald-200/70 bg-gradient-to-r from-[#f3fbf6] via-white to-[#f1faf5] p-5 shadow-[0_22px_60px_rgba(16,94,58,0.08)]">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-emerald-200 bg-white/90 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
            WhatsApp
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <Bot className="h-3.5 w-3.5" /> Mensagens automáticas da agenda
          </span>
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Confirmações por WhatsApp</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Envie a confirmação de data, horário e detalhes para o cliente e um aviso para você. Cada mensagem já avisa que foi gerada automaticamente pelo sistema.
            </p>
          </div>
          <Button
            className="rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => sendToMe(buildOwnerAgendaSummary(periodEvents, period.label.toLowerCase()))}
          >
            <Smartphone className="mr-2 h-4 w-4" />
            Enviar agenda ({period.label.toLowerCase()}) para mim
          </Button>
        </div>
      </div>

      <Card className="studio-panel rounded-3xl border-0 bg-white/90 shadow-sm">
        <CardContent className="grid gap-5 pt-6 md:grid-cols-[1fr_2fr]">
          <div className="space-y-2">
            <Label>Meu WhatsApp (recebe os avisos)</Label>
            <Input
              className="rounded-2xl"
              placeholder="(48) 99999-0000"
              value={settings.ownerWhatsapp ?? ""}
              onChange={(event) => onUpdateSettings({ ownerWhatsapp: event.target.value })}
            />
            {!settings.ownerWhatsapp && settings.studioPhone ? (
              <p className="text-xs text-slate-500">Em branco, usa o telefone do estúdio: {settings.studioPhone}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>Final da mensagem ao cliente</Label>
            <Textarea
              className="min-h-[84px] rounded-2xl"
              value={settings.whatsappConfirmationClosing ?? DEFAULT_WHATSAPP_CLOSING}
              onChange={(event) => onUpdateSettings({ whatsappConfirmationClosing: event.target.value })}
            />
            <p className="text-xs text-slate-500">Use *texto* para negrito no WhatsApp. A assinatura vem das Configurações.</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((item) => (
          <Button
            key={item.id}
            variant={item.id === periodId ? "default" : "outline"}
            className="rounded-2xl"
            onClick={() => setPeriodId(item.id)}
          >
            {item.label}
          </Button>
        ))}
        <span className="ml-auto text-sm text-slate-500">
          {periodEvents.length} agendamento{periodEvents.length === 1 ? "" : "s"}
          {periodEvents.length ? ` • ${pendingCount} sem confirmação enviada` : ""}
        </span>
      </div>

      <div className="space-y-4">
        {periodEvents.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 p-8 text-center text-slate-500">
            <p className="font-medium text-slate-700">Nenhum agendamento neste período</p>
            <p className="mt-2 text-sm">Escolha outro período acima.</p>
          </div>
        ) : (
          periodEvents.map((record) => {
            const clientMessage = buildClientConfirmation(record, settings);
            const ownerMessage = buildOwnerEventNotice(record);
            const sentAt = formatSentAt(record.whatsappConfirmationSentAt);
            const hasPhone = Boolean(record.whatsapp || record.phone);
            const isOpen = openPreviewId === record.id;

            return (
              <div key={record.id} className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                        <CalendarDays className="h-3.5 w-3.5" /> {getWeekdayDate(record.eventDate)} • {getTimeRange(record)}
                      </span>
                      {sentAt ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Enviado ao cliente em {sentAt}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
                          Confirmação não enviada
                        </span>
                      )}
                      {!hasPhone ? (
                        <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-semibold text-red-700">
                          Sem WhatsApp do cliente
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-slate-900">{record.clientName || "Cliente sem nome"}</h3>
                    <p className="text-sm text-slate-500">{record.eventType || record.packageName || "Serviço"}</p>
                    <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                      <MapPin className="h-3.5 w-3.5" /> {record.location || "Local a combinar"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Button className="rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700" disabled={!hasPhone} onClick={() => sendToClient(record)}>
                      <Send className="mr-2 h-4 w-4" />
                      {sentAt ? "Reenviar ao cliente" : "Enviar ao cliente"}
                    </Button>
                    <Button variant="outline" className="rounded-2xl" onClick={() => sendToMe(ownerMessage, record.id)}>
                      <Smartphone className="mr-2 h-4 w-4" />
                      Enviar para mim
                    </Button>
                    <Button variant="outline" className="rounded-2xl" onClick={() => setOpenPreviewId(isOpen ? "" : record.id)}>
                      <MessageCircle className="mr-2 h-4 w-4" />
                      {isOpen ? "Ocultar mensagem" : "Ver mensagem"}
                    </Button>
                  </div>
                </div>

                {isOpen ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {[
                      { id: `${record.id}-client`, title: "Para o cliente", text: clientMessage },
                      { id: `${record.id}-owner`, title: "Para você", text: ownerMessage },
                    ].map((preview) => (
                      <div key={preview.id} className="rounded-2xl border border-emerald-100 bg-[#f0fdf4] p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">{preview.title}</p>
                          <Button variant="ghost" size="sm" className="h-7 rounded-xl text-xs" onClick={() => copyMessage(preview.id, preview.text)}>
                            <Copy className="mr-1 h-3.5 w-3.5" />
                            {copiedId === preview.id ? "Copiado!" : "Copiar"}
                          </Button>
                        </div>
                        <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-slate-700">{preview.text}</pre>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
