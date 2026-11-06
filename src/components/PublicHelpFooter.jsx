import { STUDIO_WHATSAPP } from "@/lib/delivery";
import { openExternal } from "@/lib/openExternal";

const CONTEXT_LABEL = {
  natal: "de agendamento do ensaio",
  pedido: "de pedido de orçamento",
  orcamento: "do meu orçamento",
  contrato: "do contrato",
  pagar: "de pagamento",
  selecao: "de escolha das fotos",
  entrega: "de entrega das fotos",
  ajuda: "de ajuda",
};

// Rodapé das páginas dos clientes: ajuda, WhatsApp do estúdio, privacidade e termos
export default function PublicHelpFooter({ context = "", dark = false }) {
  const label = CONTEXT_LABEL[context] || "do estúdio";
  const message = `Olá! Estou na página ${label} (${window.location.href}) e tenho uma dúvida: `;
  const muted = dark ? "text-stone-400" : "text-slate-500";
  return (
    <footer className={`${dark ? "bg-[#0f0d0b] text-stone-200" : "bg-[#f7f4ef] text-slate-700"} ${context === "selecao" ? "pb-40" : "pb-10"} px-4 pt-6 print:hidden`}>
      <div className={`mx-auto max-w-xl rounded-2xl border ${dark ? "border-stone-800 bg-stone-900/60" : "border-stone-200 bg-white"} px-5 py-4 text-center`}>
        <p className="text-sm font-semibold">Precisa de ajuda?</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {context !== "ajuda" ? (
            <a href="/ajuda" className={`rounded-xl border px-3 py-2 text-xs font-semibold ${dark ? "border-stone-700 hover:bg-stone-800" : "border-stone-200 hover:bg-stone-50"}`}>Perguntas frequentes</a>
          ) : null}
          <button type="button" onClick={() => openExternal(`https://wa.me/${STUDIO_WHATSAPP}?text=${encodeURIComponent(message)}`)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">
            Falar com o estúdio no WhatsApp
          </button>
        </div>
        <p className={`mt-3 text-[11px] ${muted}`}>
          Respondemos o quanto antes.{" "}
          <a href="/privacidade" className="underline">Privacidade</a> · <a href="/termos" className="underline">Termos</a>
        </p>
      </div>
    </footer>
  );
}
