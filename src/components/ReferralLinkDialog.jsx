import { useEffect, useState } from "react";
import { Copy, Gift, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/supabase";
import { openExternal } from "@/lib/openExternal";
import { buildWhatsAppLink } from "@/utils/whatsappMessages";

// Link de indicação de um cliente: quem chega por ele ganha 10% de desconto,
// e quem indicou ganha 5 fotos extras no pacote para cada indicação que fechar.
const BASE = "https://orcamento.emersonhonoratoretratos.com.br/pedido?indicacao=";
const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "";

function baseCode(name) {
  const letters = firstName(name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase()
    .slice(0, 6);
  return letters || "AMIGO";
}

async function codeExists(code) {
  const [own, delivery] = await Promise.all([
    supabase.from("referral_codes").select("code").eq("code", code).maybeSingle(),
    supabase.from("photo_deliveries").select("id").eq("referral_code", code).limit(1),
  ]);
  return Boolean(own.data) || Boolean(delivery.data && delivery.data.length);
}

// Usa o código que o cliente já tem (do app ou da entrega de fotos); se não tiver, cria um novo
export async function getOrCreateReferralCode(client) {
  if (client.id) {
    const { data } = await supabase.from("referral_codes").select("code").eq("client_id", String(client.id)).maybeSingle();
    if (data?.code) return data.code;
  }
  const name = String(client.name || "").trim();
  if (name) {
    const { data } = await supabase.from("photo_deliveries").select("referral_code").ilike("client_name", name).not("referral_code", "is", null).limit(1);
    if (data && data[0]?.referral_code) return String(data[0].referral_code).toUpperCase();
  }
  const prefix = baseCode(name);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = `${prefix}${Math.floor(100 + Math.random() * 900)}`;
    if (await codeExists(code)) continue;
    const { error } = await supabase.from("referral_codes").insert({
      code,
      client_id: client.id ? String(client.id) : null,
      client_name: name || "Cliente",
      client_whatsapp: String(client.whatsapp || client.phone || "") || null,
    });
    if (!error) return code;
    if (!/duplicate|unique/i.test(error.message || "")) throw error;
  }
  throw new Error("Não consegui criar um código agora. Tente de novo.");
}

export function referralInviteMessage(client, link) {
  const first = firstName(client.name);
  return [
    `Oi${first ? `, ${first}` : ""}! Tudo bem? Aqui é o Emerson 💛`,
    "Queria te contar uma novidade: agora você pode indicar amigos e família para fotografar comigo!",
    "🎁 Quem vier pela sua indicação ganha *10% de desconto* no ensaio.",
    "📸 E *você ganha 5 fotos extras* no seu pacote para cada pessoa que fechar.",
    `É só mandar este link para quem você quiser:\n${link}`,
    "Obrigado por confiar no meu trabalho! 🙏",
  ].join("\n\n");
}

export function referralFriendMessage(client, link) {
  const first = firstName(client.name);
  return [
    `Fiz minhas fotos com o Emerson Honorato Retratos e amei! 📸💛`,
    `Pedindo o seu orçamento por este link você ganha *10% de desconto*${first ? ` (indicação de ${first})` : ""}:`,
    link,
  ].join("\n");
}

export default function ReferralLinkDialog({ client, onClose }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    let active = true;
    getOrCreateReferralCode(client)
      .then((value) => active && setCode(value))
      .catch((err) => active && setError(err.message || "Não consegui criar o link agora."));
    return () => {
      active = false;
    };
  }, [client]);

  const link = code ? `${BASE}${code}` : "";
  const phone = String(client.whatsapp || client.phone || "").replace(/\D/g, "");

  async function copy(text, which) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      window.prompt("Copie:", text);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-3" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold"><Gift className="h-4 w-4 text-[#7f274f]" />Link de indicação</h3>
          <button type="button" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Fechar"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-sm text-slate-600">
          Link de <strong>{client.name || "Cliente"}</strong>. Quem pedir orçamento por ele ganha <strong>10% de desconto</strong> (entra sozinho no orçamento), e {firstName(client.name) || "o cliente"} ganha <strong>5 fotos extras</strong> no pacote para cada indicação que fechar.
        </p>

        {error ? <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
        {!code && !error ? <p className="mt-4 text-sm text-slate-500">Preparando o link…</p> : null}

        {code ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-slate-50 p-3 text-center">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Código</p>
              <p className="text-2xl font-bold tracking-[0.18em] text-slate-900">{code}</p>
              <p className="mt-2 break-all font-mono text-xs text-slate-600">{link}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                className="rounded-2xl"
                onClick={() => {
                  const text = referralInviteMessage(client, link);
                  openExternal(phone ? buildWhatsAppLink(phone, text) : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`);
                }}
              >
                <MessageCircle className="mr-2 h-4 w-4" />Enviar para {firstName(client.name) || "o cliente"}
              </Button>
              <Button variant="outline" className="rounded-2xl" onClick={() => copy(link, "link")}>
                <Copy className="mr-2 h-4 w-4" />{copied === "link" ? "Copiado!" : "Copiar link"}
              </Button>
            </div>
            <button type="button" className="text-xs font-semibold text-slate-600 underline" onClick={() => copy(referralFriendMessage(client, link), "friend")}>
              {copied === "friend" ? "Mensagem copiada!" : "Copiar mensagem pronta para o cliente repassar aos amigos"}
            </button>
            <p className="text-xs text-slate-500">As indicações aparecem na aba Entregas, no quadro “Indique e ganhe”, onde você marca as 5 fotos extras como entregues.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
