import { useCallback, useEffect, useState } from "react";
import { Archive, CalendarDays, ClipboardList, Copy, ExternalLink, FilePlus2, MapPin, MessageCircle, RefreshCw, Send, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/supabase";
import { formatDateBR } from "@/utils/formatters";
import { buildWhatsAppLink, buildWhatsAppShareLink } from "@/utils/whatsappMessages";

export const PUBLIC_REQUEST_URL = "https://orcamento.emersonhonoratoretratos.com.br/pedido";

export function buildRequestInviteMessage(settings = {}) {
  const studioName = settings.studioName || "Emerson Honorato Retratos";
  return [
    "Olá! 😊",
    "",
    "Para eu preparar o seu orçamento com tudo certinho, preencha este formulário rápido (leva menos de 2 minutos):",
    PUBLIC_REQUEST_URL,
    "",
    "Assim que eu receber, te respondo por aqui com os valores e a disponibilidade.",
    "",
    studioName,
  ].join("\n");
}

function formatCreatedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${formatDateBR(value.slice(0, 10))} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default function BudgetRequestsPanel({ settings = {}, onCreateBudget, onRequestsLoaded }) {
  const [requests, setRequests] = useState([]);
  const [state, setState] = useState("loading"); // loading | ready | missing | error
  const [showArchived, setShowArchived] = useState(false);
  const [clientPhone, setClientPhone] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const query = supabase.from("budget_requests").select("*").order("created_at", { ascending: false }).limit(100);
    const { data, error } = await query;
    if (error) {
      const missing = error.code === "42P01" || error.code === "PGRST205" || /does not exist|could not find/i.test(error.message || "");
      setState(missing ? "missing" : "error");
      return;
    }
    setRequests(data || []);
    setState("ready");
    onRequestsLoaded?.(data || []);
  }, [onRequestsLoaded]);

  useEffect(() => {
    let active = true;
    supabase
      .from("budget_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          const missing = error.code === "42P01" || error.code === "PGRST205" || /does not exist|could not find/i.test(error.message || "");
          setState(missing ? "missing" : "error");
          return;
        }
        setRequests(data || []);
        setState("ready");
        onRequestsLoaded?.(data || []);
      });
    return () => {
      active = false;
    };
  }, [onRequestsLoaded]);

  async function setStatus(request, status) {
    setRequests((current) => current.map((item) => (item.id === request.id ? { ...item, status } : item)));
    const { error } = await supabase.from("budget_requests").update({ status }).eq("id", request.id);
    if (error) load();
  }

  function sendInvite() {
    const text = buildRequestInviteMessage(settings);
    const link = clientPhone.replace(/\D/g, "") ? buildWhatsAppLink(clientPhone, text) : buildWhatsAppShareLink(text);
    window.open(link, "_blank", "noopener");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(PUBLIC_REQUEST_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copie o link:", PUBLIC_REQUEST_URL);
    }
  }

  function replyOnWhatsApp(request) {
    const firstName = String(request.name || "").trim().split(/\s+/)[0] || "";
    const text = `Olá, ${firstName}! Recebi seu pedido de orçamento para ${String(request.service || "o seu evento").toLowerCase()}${
      request.event_date ? ` no dia ${formatDateBR(request.event_date)}` : ""
    }. Já estou preparando a proposta e te envio por aqui. 😊`;
    window.open(buildWhatsAppLink(request.whatsapp, text), "_blank", "noopener");
    if (request.status === "novo") setStatus(request, "respondido");
  }

  function createBudget(request) {
    onCreateBudget(request);
    setStatus(request, "convertido");
  }

  const visible = requests.filter((request) => (showArchived ? true : !["arquivado", "convertido"].includes(request.status)));
  const newCount = requests.filter((request) => request.status === "novo").length;

  return (
    <Card className="studio-panel overflow-hidden rounded-3xl border-0 bg-white/90 shadow-sm">
      <CardContent className="space-y-5 pt-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-[#7f274f]" />
              <h3 className="text-lg font-semibold text-slate-900">Pedidos de orçamento</h3>
              {newCount ? (
                <span className="rounded-full bg-[#7f274f] px-2.5 py-0.5 text-xs font-semibold text-white">{newCount} novo{newCount === 1 ? "" : "s"}</span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-slate-500">Mande o formulário pelo WhatsApp; o que o cliente preencher aparece aqui.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={clientPhone}
              onChange={(event) => setClientPhone(event.target.value)}
              placeholder="WhatsApp do cliente (opcional)"
              className="w-56 rounded-2xl"
            />
            <Button className="rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={sendInvite}>
              <Send className="mr-2 h-4 w-4" />
              Enviar formulário
            </Button>
            <Button variant="outline" className="rounded-2xl" onClick={copyLink}>
              <Copy className="mr-2 h-4 w-4" />
              {copied ? "Copiado!" : "Copiar link"}
            </Button>
            <Button variant="outline" className="rounded-2xl" onClick={() => window.open(`${window.location.origin}/pedido`, "_blank", "noopener")}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Ver formulário
            </Button>
          </div>
        </div>

        {state === "missing" ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Falta criar a tabela de pedidos no Supabase. Rode o arquivo <code>supabase/seguranca-e-pedidos.sql</code> no SQL Editor do Supabase.
          </div>
        ) : null}
        {state === "error" ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Não foi possível carregar os pedidos agora.{" "}
            <button type="button" className="underline" onClick={load}>Tentar de novo</button>
          </div>
        ) : null}

        {state === "ready" ? (
          <>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{visible.length ? `${visible.length} pedido${visible.length === 1 ? "" : "s"}` : "Nenhum pedido em aberto"}</span>
              <div className="flex gap-3">
                <button type="button" className="inline-flex items-center gap-1 hover:text-slate-800" onClick={load}>
                  <RefreshCw className="h-3.5 w-3.5" /> Atualizar
                </button>
                <button type="button" className="hover:text-slate-800" onClick={() => setShowArchived((value) => !value)}>
                  {showArchived ? "Ocultar arquivados" : "Mostrar arquivados/convertidos"}
                </button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {visible.map((request) => (
                <div
                  key={request.id}
                  className={`rounded-2xl border p-4 ${request.status === "novo" ? "border-[#7f274f]/30 bg-[#fff7fa]" : "border-slate-200 bg-white"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{request.name}</p>
                      <p className="text-sm text-slate-500">{request.service || "Serviço não informado"}</p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          {
                            novo: "bg-[#7f274f] text-white",
                            respondido: "bg-sky-100 text-sky-800",
                            convertido: "bg-emerald-100 text-emerald-800",
                            arquivado: "bg-slate-100 text-slate-600",
                          }[request.status] || "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {request.status}
                      </span>
                      <p className="mt-1 text-[11px] text-slate-400">{formatCreatedAt(request.created_at)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                    <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{request.event_date ? formatDateBR(request.event_date) : "Data a definir"}{request.event_time ? ` • ${request.event_time}` : ""}</span>
                    {request.location ? <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{request.location}</span> : null}
                    {request.people ? <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{request.people}</span> : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{[request.whatsapp, request.email].filter(Boolean).join(" • ")}</p>
                  {request.details ? <p className="mt-2 whitespace-pre-line rounded-xl bg-white/70 p-3 text-sm leading-6 text-slate-700">{request.details}</p> : null}
                  {request.how_found ? <p className="mt-2 text-xs text-slate-400">Conheceu por: {request.how_found}</p> : null}
                  {request.referral_code ? <p className="mt-1 inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">🎁 Indicação: código {request.referral_code}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" className="rounded-xl" onClick={() => createBudget(request)}>
                      <FilePlus2 className="mr-1.5 h-4 w-4" /> Criar orçamento
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => replyOnWhatsApp(request)}>
                      <MessageCircle className="mr-1.5 h-4 w-4" /> Responder
                    </Button>
                    {request.status !== "arquivado" ? (
                      <Button size="sm" variant="ghost" className="rounded-xl text-slate-500" onClick={() => setStatus(request, "arquivado")}>
                        <Archive className="mr-1.5 h-4 w-4" /> Arquivar
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
