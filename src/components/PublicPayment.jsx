import { useEffect, useState } from "react";
import { supabase } from "@/supabase";
import { STUDIO_WHATSAPP } from "@/lib/delivery";
import { brl, installmentLabel, methodLabel } from "@/lib/payments";

// Página pública de pagamento: https://orcamento.emersonhonoratoretratos.com.br/pagar/<codigo>
export default function PublicPayment({ slug }) {
  const params = new URLSearchParams(window.location.search);
  const returned = params.get("retorno");
  const [payment, setPayment] = useState(null);
  const [state, setState] = useState("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let tries = 0;
    let timer = null;
    async function load() {
      const { data, error: loadError } = await supabase.rpc(returned ? "payment_refresh" : "get_payment", { p_slug: slug });
      if (!active) return;
      if (loadError) {
        setState("error");
        return;
      }
      if (!data) {
        setState("missing");
        return;
      }
      setPayment(data);
      setState("ready");
      // Voltou do Mercado Pago e ainda não caiu? Confere de novo algumas vezes.
      if (returned && returned !== "falhou" && data.status === "pendente" && tries < 6) {
        tries += 1;
        timer = setTimeout(load, 4000);
      }
    }
    load();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [slug, returned]);

  async function pay() {
    setBusy(true);
    setError("");
    const { data, error: payError } = await supabase.rpc("pay_checkout", { p_slug: slug });
    if (payError || !data?.url) {
      setBusy(false);
      setError(payError?.message || "Não consegui abrir o pagamento agora. Tente de novo em instantes.");
      return;
    }
    window.location.href = data.url;
  }

  const first = payment ? String(payment.client_name || "").trim().split(/\s+/)[0] : "";
  const whatsapp = `https://api.whatsapp.com/send?phone=${STUDIO_WHATSAPP}&text=${encodeURIComponent(
    `Oi, Emerson! Sobre o pagamento${payment ? ` de ${payment.description}` : ""}:`,
  )}`;
  const paid = payment?.status === "pago";
  const closed = payment && ["cancelado", "vencido"].includes(payment.status);
  const pendingReturn = payment?.status === "pendente" && returned === "pendente";

  return (
    <div className="min-h-screen bg-[#f6f1ea] text-[#1b1610]">
      <header className="bg-[#1b1610] px-4 pb-20 pt-10 text-center text-[#f6f1ea]">
        <p className="text-[11px] uppercase tracking-[0.35em] text-[#c9a66b]">Emerson Honorato Retratos</p>
        <h1 className="mt-3 font-serif text-3xl sm:text-4xl">{paid ? "Pagamento confirmado" : "Pagamento"}</h1>
      </header>

      <main className="mx-auto -mt-12 max-w-md px-4 pb-16">
        <div className="rounded-[28px] bg-white p-6 shadow-[0_20px_50px_rgba(27,22,16,0.12)] sm:p-8">
          {state === "loading" ? <p className="py-8 text-center text-slate-500">Carregando…</p> : null}
          {state === "error" ? <p className="py-8 text-center text-red-700">Não foi possível carregar agora. Tente de novo em instantes.</p> : null}
          {state === "missing" ? <p className="py-8 text-center text-slate-600">Não encontrei esta cobrança. Confira o link ou fale comigo pelo WhatsApp.</p> : null}

          {state === "ready" && payment ? (
            <>
              {paid ? (
                <div className="text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl">✅</div>
                  <p className="mt-4 text-lg font-semibold">Obrigado, {first}!</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Recebi seu pagamento. Não precisa enviar comprovante.</p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Olá, {first}! Aqui está o seu pagamento:</p>
              )}

              <div className="mt-5 rounded-2xl border border-[#eadfce] bg-[#fbf8f3] p-5">
                <p className="text-sm font-medium text-slate-700">{payment.description}</p>
                <p className="mt-2 text-4xl font-bold tracking-tight">{brl(payment.amount)}</p>
                {paid ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Pago {payment.paid_at ? `em ${new Date(payment.paid_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}
                    {payment.payment_method ? ` • ${methodLabel(payment.payment_method)}` : ""}
                    {Number(payment.installments) > 1 ? ` em ${payment.installments}x` : ""}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">No cartão {installmentLabel(payment.amount, payment.max_installments)} — ou Pix</p>
                )}
              </div>

              {!paid && !closed ? (
                <>
                  {returned === "falhou" ? (
                    <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-800">O pagamento não foi aprovado. Você pode tentar de novo com outro cartão ou pagar com Pix.</p>
                  ) : null}
                  {pendingReturn ? (
                    <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">Seu pagamento está em análise no Mercado Pago. Assim que for aprovado, esta página mostra a confirmação — pode fechar, eu também sou avisado.</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={pay}
                    disabled={busy}
                    className="mt-5 w-full rounded-2xl bg-[#1b1610] px-5 py-4 text-base font-semibold text-[#f6f1ea] shadow-lg transition hover:bg-black disabled:opacity-60"
                  >
                    {busy ? "Abrindo pagamento…" : "Pagar com cartão ou Pix"}
                  </button>
                  {error ? <p className="mt-2 text-center text-sm text-red-700">{error}</p> : null}
                  <p className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
                    🔒 Pagamento seguro pelo Mercado Pago. Seus dados do cartão não passam pelo estúdio.
                  </p>
                  {payment.expires_at ? (
                    <p className="mt-1 text-center text-xs text-slate-400">Link válido até {new Date(payment.expires_at).toLocaleDateString("pt-BR")}</p>
                  ) : null}
                </>
              ) : null}

              {closed ? (
                <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-center text-sm text-slate-600">
                  {payment.status === "vencido" ? "Este link de pagamento venceu." : "Esta cobrança foi cancelada."} Fale comigo pelo WhatsApp que eu te ajudo.
                </p>
              ) : null}

              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="mt-5 block text-center text-sm font-medium text-emerald-700 hover:underline">
                Dúvidas? Fale comigo pelo WhatsApp
              </a>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
