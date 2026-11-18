import { useEffect, useMemo, useState } from "react";
import { Copy, CreditCard, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/supabase";
import { formatDateBR } from "@/lib/delivery";
import { PAY_PUBLIC_BASE, brl, installmentLabel } from "@/lib/payments";
import { openExternal } from "@/lib/openExternal";
import { buildWhatsAppLink } from "@/utils/whatsappMessages";

// Link de pagamento (Mercado Pago: Pix, crédito ou débito) direto de um trabalho que está devendo.

function parseMoney(value) {
  const text = String(value || "").replace(/\s|R\$/g, "");
  const n = Number(text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function plain(value) {
  return Number(value || 0).toFixed(2).replace(".", ",");
}

export default function PaymentLinkDialog({ record, onClose }) {
  const total = Number(record.computedAmount || record.amount || 0);
  const paid = Number(record.amountPaid || 0);
  const balance = Math.max(0, Number(record.balance ?? total - paid));
  const half = Math.min(balance, Math.round((total / 2) * 100) / 100);
  const startsWithDeposit = paid < 1 && half >= 1 && half < balance;
  const [kind, setKind] = useState(startsWithDeposit ? "sinal" : "saldo");
  const [other, setOther] = useState("");
  const [installments, setInstallments] = useState("12");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [payment, setPayment] = useState(null);
  const [copied, setCopied] = useState(false);
  const [openLinks, setOpenLinks] = useState([]);

  const amount = kind === "sinal" ? half : kind === "saldo" ? balance : parseMoney(other);
  const what = [record.eventType || "Serviço fotográfico", record.eventDate ? formatDateBR(record.eventDate) : ""].filter(Boolean).join(" — ");
  const description = kind === "sinal" ? `Sinal (50%) — ${what}` : kind === "saldo" ? `Restante — ${what}` : `Pagamento — ${what}`;

  useEffect(() => {
    let active = true;
    supabase.from("payments").select("*").eq("event_id", String(record.id)).eq("status", "pendente").order("created_at", { ascending: false }).then(({ data }) => {
      if (active && data) setOpenLinks(data);
    });
    return () => {
      active = false;
    };
  }, [record.id]);

  const sameOpen = useMemo(() => openLinks.find((item) => Math.abs(Number(item.amount) - amount) < 0.01) || null, [openLinks, amount]);

  async function create() {
    if (amount < 1) return setMessage("Coloque um valor de pelo menos R$ 1,00.");
    if (sameOpen) {
      setPayment(sameOpen);
      return;
    }
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase
      .from("payments")
      .insert({
        kind: "avulso",
        event_id: String(record.id),
        client_name: record.clientName || "Cliente",
        client_whatsapp: record.whatsapp || record.phone || null,
        client_email: record.email || null,
        description,
        amount,
        max_installments: Math.min(12, Math.max(1, Number(installments) || 1)),
      })
      .select()
      .single();
    setBusy(false);
    if (error) return setMessage(`Não consegui criar o link: ${error.message}`);
    setPayment(data);
  }

  const link = payment ? `${PAY_PUBLIC_BASE}${payment.slug}` : "";

  function whatsappText() {
    const first = String(record.clientName || "").trim().split(/\s+/)[0];
    return [
      `Oi${first ? `, ${first}` : ""}! Tudo bem? 😊`,
      `Segue o link para pagamento de *${payment.description}* — *${brl(payment.amount)}*.`,
      `Você pode pagar no Pix, no débito ou no crédito (${installmentLabel(payment.amount, payment.max_installments)}), na página segura do Mercado Pago:`,
      link,
      "Assim que pagar, eu já recebo a confirmação automaticamente. Obrigado! 📸",
    ].join("\n\n");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copie o link:", link);
    }
  }

  const phone = record.whatsapp || record.phone || "";
  const option = (value, label, detail) => (
    <button
      type="button"
      onClick={() => setKind(value)}
      className={`rounded-2xl border-2 px-3 py-2.5 text-left transition ${kind === value ? "border-[#1b1610] bg-[#1b1610] text-white" : "border-slate-200 hover:border-slate-400"}`}
    >
      <span className="block text-sm font-semibold">{label}</span>
      <span className={`block text-xs ${kind === value ? "text-white/70" : "text-slate-500"}`}>{detail}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-3" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold"><CreditCard className="h-4 w-4" />Link de pagamento</h3>
          <button type="button" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Fechar"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-sm text-slate-600"><strong>{record.clientName || "Cliente"}</strong> · {what}</p>
        <p className="mt-1 text-xs text-slate-500">Total {brl(total)} · pago {brl(paid)} · falta <strong>{brl(balance)}</strong></p>

        {!payment ? (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {half >= 1 && half < balance ? option("sinal", "Sinal 50%", brl(half)) : null}
              {option("saldo", paid > 0 ? "Restante" : "Valor total", brl(balance))}
              {option("outro", "Outro valor", "você digita")}
            </div>
            {kind === "outro" ? (
              <div className="grid gap-1.5"><Label htmlFor="link-valor">Valor (R$)</Label><Input id="link-valor" inputMode="decimal" placeholder={plain(balance)} value={other} onChange={(e) => setOther(e.target.value)} /></div>
            ) : null}
            <div className="grid gap-1.5">
              <Label htmlFor="link-parcelas">Parcelas no crédito</Label>
              <select id="link-parcelas" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" value={installments} onChange={(e) => setInstallments(e.target.value)}>
                {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((n) => <option key={n} value={n}>{n === "1" ? "Só à vista" : `Até ${n}x`}</option>)}
              </select>
            </div>
            <p className="rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">O cliente escolhe na página do Mercado Pago: <strong>Pix</strong>, <strong>débito</strong> ou <strong>crédito</strong>. Quando ele paga, o valor entra sozinho como recebido neste trabalho.</p>
            {sameOpen ? <p className="text-xs text-amber-700">Já existe um link aberto de {brl(sameOpen.amount)} para este trabalho; vou usar o mesmo.</p> : null}
            {message ? <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-800">{message}</p> : null}
            <Button className="w-full rounded-2xl" disabled={busy || amount < 1} onClick={create}>{busy ? "Criando…" : `Gerar link de ${brl(amount)}`}</Button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-950">
              <p className="font-semibold">{payment.description}</p>
              <p>{brl(payment.amount)} · Pix, débito ou crédito ({installmentLabel(payment.amount, payment.max_installments)})</p>
            </div>
            <div className="break-all rounded-2xl bg-slate-50 p-3 font-mono text-xs text-slate-700">{link}</div>
            <div className="flex flex-wrap gap-2">
              <Button className="rounded-2xl" onClick={() => openExternal(phone ? buildWhatsAppLink(phone, whatsappText()) : `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappText())}`)}><MessageCircle className="mr-2 h-4 w-4" />Enviar no WhatsApp</Button>
              <Button variant="outline" className="rounded-2xl" onClick={copy}><Copy className="mr-2 h-4 w-4" />{copied ? "Copiado!" : "Copiar link"}</Button>
            </div>
            <p className="text-xs text-slate-500">O link também fica na aba Cobranças, onde dá para acompanhar ou cancelar.</p>
          </div>
        )}
      </div>
    </div>
  );
}
