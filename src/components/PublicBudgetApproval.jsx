import { useEffect, useState } from "react";
import { supabase } from "@/supabase";
import { formatCurrency, formatDateBR } from "@/utils/formatters";

const LOGO = "/Emerson%20Honorato%20Retratos%20Logo.png";
const SERIF = { fontFamily: "'Cormorant Garamond', Georgia, 'Times New Roman', serif" };
const DEFAULT_WHATSAPP = "5548999652317";

function useSerifFont() {
  useEffect(() => {
    const id = "eh-serif-font";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&display=swap";
    document.head.appendChild(link);
  }, []);
}

function formatCpf(value) {
  const d = String(value).replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

function whatsappNumber(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length < 10) return DEFAULT_WHATSAPP;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

// Página pública do orçamento: o cliente vê a proposta, lê o contrato e aprova (ou recusa)
export default function PublicBudgetApproval({ slug }) {
  useSerifFont();
  const [state, setState] = useState("loading");
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ name: "", cpf: "", accept: false });
  const [showContract, setShowContract] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [declineNote, setDeclineNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    supabase.rpc("get_budget_share", { p_slug: slug }).then(({ data: result, error: rpcError }) => {
      if (!active) return;
      if (rpcError || !result) {
        setState("error");
        return;
      }
      setData(result);
      setState(result.status);
      if (result.snapshot?.clientName) setForm((current) => ({ ...current, name: current.name || result.snapshot.clientName }));
    });
    return () => {
      active = false;
    };
  }, [slug]);

  const snap = data?.snapshot || {};
  const first = String(snap.clientName || "").trim().split(/\s+/)[0];
  const wa = (text) => `https://api.whatsapp.com/send?phone=${whatsappNumber(snap.studioWhatsapp)}&text=${encodeURIComponent(text)}`;

  async function respond(accept) {
    setError("");
    if (accept) {
      if (form.name.trim().split(/\s+/).filter((part) => part.length >= 2).length < 2) return setError("Informe seu nome completo.");
      if (form.cpf.replace(/\D/g, "").length !== 11) return setError("Informe um CPF válido (11 números).");
      if (snap.contractText && !form.accept) return setError("Para aprovar, marque que leu e aceita o contrato.");
    }
    setSending(true);
    const { data: result, error: rpcError } = await supabase.rpc("respond_budget_share", {
      p_slug: slug,
      p_accept: accept,
      p_name: accept ? form.name.trim() : null,
      p_cpf: accept ? form.cpf : null,
      p_note: accept ? null : declineNote.trim() || null,
    });
    setSending(false);
    if (rpcError) return setError(rpcError.message || "Não foi possível enviar agora. Tente de novo.");
    setState(result?.status || (accept ? "aprovado" : "recusado"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const shell = (children) => (
    <div className="min-h-screen bg-[#f7f3ee] px-4 py-10 text-[#1b1610]">
      <div className="mx-auto max-w-lg text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#1b1610] p-2">
          <img src={LOGO} alt="Emerson Honorato Retratos" className="h-full w-full object-contain" />
        </span>
        {children}
      </div>
    </div>
  );

  if (state === "loading") return shell(<p className="mt-6 text-sm text-[#7a6650]">Carregando sua proposta…</p>);
  if (state === "not_found" || state === "error") {
    return shell(
      <>
        <h1 className="mt-6 text-4xl" style={SERIF}>Proposta não encontrada</h1>
        <p className="mt-3 text-sm text-[#4a4036]">Confira se o link está completo ou fale comigo pelo WhatsApp.</p>
        <a href={wa("Olá! Não consegui abrir o link do meu orçamento.")} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex rounded-2xl bg-emerald-600 px-6 py-3 font-semibold text-white">Falar no WhatsApp</a>
      </>,
    );
  }
  if (state === "aprovado") {
    return shell(
      <>
        <p className="mt-6 text-5xl" aria-hidden="true">🎉</p>
        <h1 className="mt-3 text-4xl sm:text-5xl" style={SERIF}>Data reservada, {first}!</h1>
        <p className="mt-3 text-[15px] leading-7 text-[#4a4036]">
          Seu orçamento de <strong>{snap.eventType}</strong> foi aprovado{data?.approved_name ? ` por ${data.approved_name}` : ""}. Agora é só combinar o pagamento do sinal para garantir tudo.
        </p>
        <a href={wa(`Olá, Emerson! Aprovei o orçamento de ${snap.eventType}${snap.eventDate ? ` (${formatDateBR(snap.eventDate)})` : ""}. Como faço o pagamento do sinal?`)} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex rounded-2xl bg-emerald-600 px-6 py-3.5 font-semibold text-white shadow hover:bg-emerald-700">Combinar o pagamento pelo WhatsApp</a>
        <p className="mt-6 text-xs text-[#7a6650]">Guarde este link: ele mostra o resumo do que foi combinado.</p>
      </>,
    );
  }
  if (state === "recusado") {
    return shell(
      <>
        <h1 className="mt-6 text-4xl" style={SERIF}>Obrigado pelo retorno, {first}!</h1>
        <p className="mt-3 text-sm leading-6 text-[#4a4036]">Se mudar de ideia ou quiser ajustar algo na proposta, é só me chamar.</p>
        <a href={wa(`Olá, Emerson! Sobre o orçamento de ${snap.eventType}, queria conversar.`)} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex rounded-2xl bg-[#1b1610] px-6 py-3 font-semibold text-white">Falar no WhatsApp</a>
      </>,
    );
  }

  const expired = state === "expired";
  const inputClass = "w-full rounded-2xl border border-[#e4dbd0] bg-white px-4 py-3 text-[15px] focus:border-[#a8875a] focus:outline-none";

  return (
    <div className="min-h-screen bg-[#f7f3ee] text-[#1b1610]">
      <header className="bg-[#1b1610] px-5 pb-24 pt-10 text-center text-white">
        <span className="mx-auto flex h-14 w-14 items-center justify-center">
          <img src={LOGO} alt="Emerson Honorato Retratos" className="h-full w-full object-contain" />
        </span>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.34em] text-[#e9c77b]">Proposta para você</p>
        <h1 className="mt-2 text-4xl leading-tight sm:text-6xl" style={SERIF}>{snap.eventType}</h1>
        <p className="mt-3 text-sm text-white/75">
          {snap.clientName}
          {snap.eventDate ? ` • ${formatDateBR(snap.eventDate)}` : ""}
          {snap.startTime ? ` • ${snap.startTime}${snap.endTime ? ` às ${snap.endTime}` : ""}` : ""}
        </p>
      </header>

      <main className="mx-auto -mt-16 max-w-2xl space-y-5 px-4 pb-16">
        <section className="rounded-[28px] bg-white p-6 shadow-[0_30px_80px_rgba(27,22,16,0.12)] sm:p-8">
          <h2 className="text-3xl" style={SERIF}>Olá, {first}!</h2>
          <p className="mt-2 text-[15px] leading-7 text-[#4a4036]">Preparei com carinho esta proposta. Confira os detalhes abaixo e, se estiver tudo certo, aprove por aqui mesmo para reservar a sua data.</p>

          {snap.location ? <p className="mt-4 text-sm text-[#4a4036]">📍 {snap.location}</p> : null}
          {snap.description ? <p className="mt-4 whitespace-pre-line rounded-2xl bg-[#f7f3ee] p-4 text-sm leading-6 text-[#4a4036]">{snap.description}</p> : null}

          {Array.isArray(snap.items) && snap.items.length ? (
            <div className="mt-5 divide-y divide-[#efe8df] rounded-2xl border border-[#efe8df]">
              {snap.items.map((item, index) => (
                <div key={index} className="flex items-start justify-between gap-4 p-4">
                  <div>
                    <p className="font-medium">{item.name}{item.quantity > 1 ? ` × ${item.quantity}` : ""}</p>
                    {item.description ? <p className="mt-1 text-xs leading-5 text-[#7a6650]">{item.description}</p> : null}
                  </div>
                  {item.unitPrice ? <p className="shrink-0 text-sm font-medium">{formatCurrency(item.unitPrice * (item.quantity || 1))}</p> : null}
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-5 flex items-end justify-between rounded-2xl bg-[#1b1610] px-5 py-4 text-white">
            <span className="text-sm text-white/70">Investimento total</span>
            <span className="text-3xl font-semibold" style={SERIF}>{formatCurrency(snap.total)}</span>
          </div>

          <dl className="mt-5 space-y-3 text-sm">
            {snap.paymentTerms ? (<div><dt className="font-semibold">Pagamento</dt><dd className="mt-0.5 text-[#4a4036]">{snap.paymentTerms}</dd></div>) : null}
            {snap.deliveryTerms ? (<div><dt className="font-semibold">Entrega</dt><dd className="mt-0.5 text-[#4a4036]">{snap.deliveryTerms}</dd></div>) : null}
            {data?.expires_at ? (<div><dt className="font-semibold">Validade</dt><dd className={`mt-0.5 ${expired ? "text-red-700" : "text-[#4a4036]"}`}>{expired ? `Venceu em ${formatDateBR(data.expires_at)}` : `Até ${formatDateBR(data.expires_at)}`}</dd></div>) : null}
          </dl>
        </section>

        {snap.contractText ? (
          <section className="rounded-[28px] bg-white p-6 shadow-sm sm:p-8">
            <button type="button" onClick={() => setShowContract((v) => !v)} className="flex w-full items-center justify-between text-left">
              <span>
                <span className="block text-2xl" style={SERIF}>Contrato de prestação de serviços</span>
                <span className="text-xs text-[#7a6650]">Toque para {showContract ? "fechar" : "ler"} o contrato completo</span>
              </span>
              <span className="text-xl text-[#a8875a]">{showContract ? "−" : "+"}</span>
            </button>
            {showContract ? (
              <div className="mt-4 max-h-[60vh] overflow-y-auto whitespace-pre-line rounded-2xl border border-[#efe8df] bg-[#fbf8f4] p-4 text-[13px] leading-6 text-[#3b332b]">{snap.contractText}</div>
            ) : null}
          </section>
        ) : null}

        {expired ? (
          <section className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-center">
            <p className="font-semibold text-red-900">Esta proposta venceu.</p>
            <p className="mt-1 text-sm text-red-800">Me chama que eu confiro a disponibilidade e atualizo pra você.</p>
            <a href={wa(`Olá, Emerson! A proposta de ${snap.eventType} venceu. Pode atualizar pra mim?`)} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white">Falar no WhatsApp</a>
          </section>
        ) : (
          <section className="rounded-[28px] bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-3xl" style={SERIF}>Aprovar e reservar a data</h2>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-sm font-medium">Nome completo</span>
                <input className={`${inputClass} mt-1`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
              </label>
              <label className="block">
                <span className="text-sm font-medium">CPF <span className="font-normal text-[#7a6650]">(vai no contrato)</span></span>
                <input className={`${inputClass} mt-1`} inputMode="numeric" placeholder="000.000.000-00" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: formatCpf(e.target.value) })} />
              </label>
              {snap.contractText ? (
                <label className="flex items-start gap-3 rounded-2xl bg-[#f7f3ee] p-3 text-sm leading-6">
                  <input type="checkbox" className="mt-1 h-4 w-4" checked={form.accept} onChange={(e) => setForm({ ...form, accept: e.target.checked })} />
                  <span>Li e aceito o contrato e as condições desta proposta.</span>
                </label>
              ) : null}
              {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
              <button type="button" disabled={sending} onClick={() => respond(true)} className="w-full rounded-2xl bg-[#1b1610] px-5 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-[#2c241a] disabled:opacity-60">
                {sending ? "Enviando…" : "✓ Aprovar orçamento"}
              </button>
              <p className="text-center text-[11px] leading-5 text-[#7a6650]">Ao aprovar, registramos seu nome, CPF, data e hora como aceite deste orçamento e contrato.</p>
            </div>

            <div className="mt-6 border-t border-[#efe8df] pt-4 text-center">
              {declining ? (
                <div className="space-y-3 text-left">
                  <label className="block">
                    <span className="text-sm font-medium">Pode me contar o motivo? (opcional)</span>
                    <textarea className={`${inputClass} mt-1 min-h-[80px]`} value={declineNote} onChange={(e) => setDeclineNote(e.target.value)} placeholder="Ex.: preço, data, fechei com outro…" maxLength={500} />
                  </label>
                  <div className="flex gap-2">
                    <button type="button" disabled={sending} onClick={() => respond(false)} className="flex-1 rounded-2xl border border-[#e4dbd0] px-4 py-3 text-sm font-semibold">Enviar resposta</button>
                    <button type="button" onClick={() => setDeclining(false)} className="rounded-2xl px-4 py-3 text-sm text-[#7a6650]">Voltar</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap justify-center gap-4 text-sm">
                  <a href={wa(`Olá, Emerson! Tenho uma dúvida sobre o orçamento de ${snap.eventType}.`)} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-700 underline-offset-4 hover:underline">Tenho uma dúvida</a>
                  <button type="button" onClick={() => setDeclining(true)} className="text-[#7a6650] underline-offset-4 hover:underline">Não vou seguir agora</button>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
