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

const when = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" }) : "");

// Página pública do contrato: o cliente lê e assina (aceite com nome + CPF)
export default function PublicContractSign({ slug }) {
  useSerifFont();
  const [state, setState] = useState("loading");
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ name: "", cpf: "", accept: false });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    supabase.rpc("get_contract_share", { p_slug: slug }).then(({ data: result, error: rpcError }) => {
      if (!active) return;
      if (rpcError || !result) return setState("error");
      setData(result);
      setState(result.status);
      if (result.snapshot?.clientName) setForm((current) => ({ ...current, name: current.name || result.snapshot.clientName }));
      if (result.snapshot?.clientCpf) setForm((current) => ({ ...current, cpf: current.cpf || formatCpf(result.snapshot.clientCpf) }));
    });
    return () => {
      active = false;
    };
  }, [slug]);

  const snap = data?.snapshot || {};
  const first = String(snap.clientName || "").trim().split(/\s+/)[0];
  const wa = (text) => `https://api.whatsapp.com/send?phone=${whatsappNumber(snap.studioWhatsapp)}&text=${encodeURIComponent(text)}`;

  async function sign() {
    setError("");
    if (form.name.trim().split(/\s+/).filter((part) => part.length >= 2).length < 2) return setError("Informe seu nome completo.");
    if (form.cpf.replace(/\D/g, "").length !== 11) return setError("Informe um CPF válido (11 números).");
    if (!form.accept) return setError("Marque que leu e concorda com o contrato.");
    setSending(true);
    const { data: result, error: rpcError } = await supabase.rpc("sign_contract_share", {
      p_slug: slug,
      p_name: form.name.trim(),
      p_cpf: form.cpf,
      p_agree: true,
    });
    setSending(false);
    if (rpcError) return setError(rpcError.message || "Não foi possível assinar agora. Tente de novo.");
    setData((current) => ({ ...current, signed_at: result?.signed_at, signed_name: form.name.trim(), text_hash: result?.text_hash }));
    setState("assinado");
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

  if (state === "loading") return shell(<p className="mt-6 text-sm text-[#7a6650]">Carregando seu contrato…</p>);
  if (state === "not_found" || state === "error") {
    return shell(
      <>
        <h1 className="mt-6 text-4xl" style={SERIF}>Contrato não encontrado</h1>
        <p className="mt-3 text-sm text-[#4a4036]">Confira se o link está completo ou fale comigo pelo WhatsApp.</p>
        <a href={wa("Olá! Não consegui abrir o link do meu contrato.")} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex rounded-2xl bg-emerald-600 px-6 py-3 font-semibold text-white">Falar no WhatsApp</a>
      </>,
    );
  }

  const signed = state === "assinado";
  const inputClass = "w-full rounded-2xl border border-[#e4dbd0] bg-white px-4 py-3 text-[15px] focus:border-[#a8875a] focus:outline-none";

  return (
    <div className="min-h-screen bg-[#f7f3ee] text-[#1b1610] print:bg-white">
      <header className="bg-[#1b1610] px-5 pb-24 pt-10 text-center text-white print:bg-white print:pb-4 print:text-black">
        <span className="mx-auto flex h-14 w-14 items-center justify-center">
          <img src={LOGO} alt="Emerson Honorato Retratos" className="h-full w-full object-contain" />
        </span>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.34em] text-[#e9c77b]">Contrato de prestação de serviços</p>
        <h1 className="mt-2 text-4xl leading-tight sm:text-6xl" style={SERIF}>{snap.eventType}</h1>
        <p className="mt-3 text-sm text-white/75 print:text-black">
          {snap.clientName}
          {snap.eventDate ? ` • ${formatDateBR(snap.eventDate)}` : ""}
          {snap.startTime ? ` • ${snap.startTime}${snap.endTime ? ` às ${snap.endTime}` : ""}` : ""}
        </p>
      </header>

      <main className="mx-auto -mt-16 max-w-2xl space-y-5 px-4 pb-16 print:mt-0">
        {signed ? (
          <section className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-6 text-center shadow-[0_30px_80px_rgba(27,22,16,0.12)] sm:p-8">
            <p className="text-4xl" aria-hidden="true">✍️</p>
            <h2 className="mt-2 text-3xl" style={SERIF}>Contrato assinado{first ? `, ${first}` : ""}!</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-900">
              Assinado por <strong>{data?.signed_name}</strong> em {when(data?.signed_at)}.
            </p>
            {data?.text_hash ? <p className="mt-2 break-all text-[10px] text-emerald-800/70">Código de verificação: {data.text_hash.slice(0, 32)}</p> : null}
            <div className="mt-5 flex flex-wrap justify-center gap-3 print:hidden">
              <button type="button" onClick={() => window.print()} className="rounded-2xl bg-[#1b1610] px-5 py-3 text-sm font-semibold text-white">Salvar / imprimir</button>
              <a href={wa(`Olá, Emerson! Assinei o contrato de ${snap.eventType}.`)} target="_blank" rel="noopener noreferrer" className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white">Avisar no WhatsApp</a>
            </div>
          </section>
        ) : (
          <section className="rounded-[28px] bg-white p-6 shadow-[0_30px_80px_rgba(27,22,16,0.12)] sm:p-8">
            <h2 className="text-3xl" style={SERIF}>Olá, {first}!</h2>
            <p className="mt-2 text-[15px] leading-7 text-[#4a4036]">Aqui está o contrato do seu trabalho. Leia com calma e, no final da página, assine com seu nome e CPF.</p>
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              {snap.location ? (<div><dt className="font-semibold">Local</dt><dd className="mt-0.5 text-[#4a4036]">{snap.location}</dd></div>) : null}
              {snap.total ? (<div><dt className="font-semibold">Valor</dt><dd className="mt-0.5 text-[#4a4036]">{formatCurrency(snap.total)}</dd></div>) : null}
              {snap.paymentTerms ? (<div className="sm:col-span-2"><dt className="font-semibold">Pagamento</dt><dd className="mt-0.5 text-[#4a4036]">{snap.paymentTerms}</dd></div>) : null}
            </dl>
          </section>
        )}

        <section className="rounded-[28px] bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-2xl" style={SERIF}>Contrato</h2>
          <div className="mt-4 whitespace-pre-line rounded-2xl border border-[#efe8df] bg-[#fbf8f4] p-4 text-[13px] leading-6 text-[#3b332b] print:border-0 print:bg-white">{snap.contractText}</div>
          {signed ? (
            <p className="mt-4 rounded-2xl bg-[#f7f3ee] p-4 text-xs leading-5 text-[#4a4036]">
              Aceite eletrônico: {data?.signed_name}, em {when(data?.signed_at)}, pelo link enviado por {snap.studioName || "Emerson Honorato Retratos"}.
            </p>
          ) : null}
        </section>

        {!signed ? (
          <section className="rounded-[28px] bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-3xl" style={SERIF}>Assinar o contrato</h2>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-sm font-medium">Nome completo</span>
                <input className={`${inputClass} mt-1`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
              </label>
              <label className="block">
                <span className="text-sm font-medium">CPF</span>
                <input className={`${inputClass} mt-1`} inputMode="numeric" placeholder="000.000.000-00" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: formatCpf(e.target.value) })} />
              </label>
              <label className="flex items-start gap-3 rounded-2xl bg-[#f7f3ee] p-3 text-sm leading-6">
                <input type="checkbox" className="mt-1 h-4 w-4" checked={form.accept} onChange={(e) => setForm({ ...form, accept: e.target.checked })} />
                <span>Li e concordo com todas as cláusulas deste contrato.</span>
              </label>
              {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
              <button type="button" disabled={sending} onClick={sign} className="w-full rounded-2xl bg-[#1b1610] px-5 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-[#2c241a] disabled:opacity-60">
                {sending ? "Assinando…" : "✍️ Assinar contrato"}
              </button>
              <p className="text-center text-[11px] leading-5 text-[#7a6650]">Ao assinar, registramos seu nome, CPF, data, hora e o aparelho usado como aceite eletrônico deste contrato.</p>
              <p className="text-center text-sm">
                <a href={wa(`Olá, Emerson! Tenho uma dúvida sobre o contrato de ${snap.eventType}.`)} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-700 underline-offset-4 hover:underline">Tenho uma dúvida</a>
              </p>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
