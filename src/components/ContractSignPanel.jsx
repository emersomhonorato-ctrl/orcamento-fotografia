import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Copy, Eye, PenLine, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/supabase";

export const CONTRACT_PUBLIC_BASE = "https://orcamento.emersonhonoratoretratos.com.br/contrato/";

function makeSlug() {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function phoneForWhats(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length < 10) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

const when = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");

// Envio do contrato para o cliente assinar online, com acompanhamento do status
export default function ContractSignPanel({ record, settings = {}, contractText = "", onSigned }) {
  const [share, setShare] = useState(null);
  const [state, setState] = useState("loading");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!record?.id) return;
    setState("loading");
    const { data, error } = await supabase.from("contract_shares").select("*").eq("event_id", String(record.id)).maybeSingle();
    if (error) {
      setState("error");
      setMessage("Não foi possível carregar o status do contrato online.");
      return;
    }
    setShare(data || null);
    setState("ready");
  }, [record?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (share?.status === "assinado" && record && record.contractSignedAt !== share.signed_at) {
      onSigned?.(record.id, {
        contractSignedAt: share.signed_at,
        contractSignedName: share.signed_name,
        contractSignedOnline: true,
      });
    }
  }, [share, record, onSigned]);

  const link = share ? `${CONTRACT_PUBLIC_BASE}${share.slug}` : "";

  async function createLink() {
    if (!String(contractText || "").trim()) {
      setMessage("O contrato está vazio. Confira o modelo em Configurações.");
      return;
    }
    if (share?.status === "assinado" && !window.confirm("Este contrato já foi assinado. Gerar um novo link vai pedir uma nova assinatura. Continuar?")) return;
    setState("saving");
    const snapshot = {
      clientName: record.clientName || "",
      clientCpf: record.clientCpf || "",
      eventType: record.eventType || record.packageName || "Serviço fotográfico",
      eventDate: record.eventDate || "",
      startTime: record.startTime || "",
      endTime: record.endTime || "",
      location: record.location || "",
      total: Number(record.computedAmount || record.amount || 0),
      paymentTerms: record.contractPaymentMethod || settings.paymentTerms || "",
      contractText: String(contractText).trim(),
      studioName: settings.studioName || "Emerson Honorato Retratos",
      studioWhatsapp: String(settings.studioPhone || "5548999652317").replace(/\D/g, ""),
      createdAt: new Date().toISOString(),
    };
    const row = {
      event_id: String(record.id),
      slug: share?.status === "enviado" ? share.slug : makeSlug(),
      snapshot,
      status: "enviado",
      signed_at: null,
      signed_name: null,
      signed_cpf: null,
      signed_ip: null,
      signed_agent: null,
      text_hash: null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from("contract_shares").upsert(row, { onConflict: "event_id" }).select().single();
    if (error) {
      setState("ready");
      setMessage(`Não foi possível criar o link: ${error.message}`);
      return;
    }
    setShare(data);
    setState("ready");
    setMessage(share ? "Link atualizado com o contrato atual." : "Link criado. Agora é só enviar para o cliente.");
    if (record.contractSignedAt) onSigned?.(record.id, { contractSignedAt: "", contractSignedName: "", contractSignedOnline: false });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setMessage("Link copiado.");
    } catch {
      window.prompt("Copie o link:", link);
    }
  }

  const first = String(record?.clientName || "").trim().split(/\s+/)[0];
  const whatsText = `Olá${first ? `, ${first}` : ""}! Segue o contrato do seu ${record?.eventType || "trabalho"} para você ler e assinar online (leva 1 minutinho): ${link}`;
  const phone = phoneForWhats(record?.whatsapp || record?.phone);
  const whatsLink = `https://api.whatsapp.com/send?${phone ? `phone=${phone}&` : ""}text=${encodeURIComponent(whatsText)}`;

  return (
    <div className="mt-5 rounded-[24px] border border-stone-200 bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${share?.status === "assinado" ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-600"}`}>
            {share?.status === "assinado" ? <CheckCircle2 className="h-5 w-5" /> : <PenLine className="h-5 w-5" />}
          </span>
          <div>
            <p className="font-semibold text-stone-900">Assinatura online</p>
            <p className="text-sm text-stone-500">
              {state === "loading" ? "Carregando…" : share?.status === "assinado"
                ? `Assinado por ${share.signed_name} em ${when(share.signed_at)}${share.signed_cpf ? ` · CPF ${share.signed_cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}` : ""}`
                : share
                  ? `Aguardando assinatura · ${share.views ? `cliente abriu ${share.views}x${share.last_viewed_at ? ` (última ${when(share.last_viewed_at)})` : ""}` : "ainda não abriu"}`
                  : "O cliente recebe um link, lê o contrato e assina com nome e CPF."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {share ? (
            <>
              {share.status === "enviado" ? (
                <a href={whatsLink} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-xl bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700">
                  <Send className="mr-1.5 h-4 w-4" />Enviar no WhatsApp
                </a>
              ) : null}
              <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl" onClick={copy}><Copy className="mr-1.5 h-4 w-4" />Copiar link</Button>
              <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-xl border border-stone-200 px-3 text-sm text-stone-700 hover:bg-stone-50"><Eye className="mr-1.5 h-4 w-4" />Ver</a>
              <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl" disabled={state === "saving"} onClick={createLink} title="Atualiza o link com o texto atual do contrato">
                <RefreshCw className="mr-1.5 h-4 w-4" />{share.status === "assinado" ? "Pedir nova assinatura" : "Atualizar texto"}
              </Button>
            </>
          ) : (
            <Button type="button" className="studio-primary h-9 rounded-xl text-white" disabled={state !== "ready"} onClick={createLink}>
              <PenLine className="mr-1.5 h-4 w-4" />{state === "saving" ? "Criando…" : "Enviar para assinar online"}
            </Button>
          )}
        </div>
      </div>
      {message ? <p className="mt-3 text-xs text-stone-500">{message}</p> : null}
    </div>
  );
}
