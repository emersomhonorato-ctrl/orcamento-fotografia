import { useEffect, useState } from "react";
import { supabase } from "@/supabase";
import { STUDIO_WHATSAPP, driveEmbedUrl, formatDateBR } from "@/lib/delivery";

const LOGO = "/Emerson%20Honorato%20Retratos%20Logo.png";
const SERIF = { fontFamily: "'Cormorant Garamond', Georgia, 'Times New Roman', serif" };

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

function firstName(name = "") {
  return String(name).trim().split(/\s+/)[0] || "";
}

function Shell({ cover, children }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0f0d0b] text-white">
      {cover ? (
        <img src={cover} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-[#0f0d0b]/80 to-[#0f0d0b]" />
      <div className="relative flex min-h-screen items-center justify-center px-5 py-12">{children}</div>
    </div>
  );
}

// Página pública: o cliente abre o link e vê/baixa as fotos do Google Drive
export default function PublicPhotoDelivery({ slug }) {
  useSerifFont();
  const [state, setState] = useState("loading");
  const [data, setData] = useState(null);
  const [pin, setPin] = useState("");
  const [checking, setChecking] = useState(false);
  const [galleryLoaded, setGalleryLoaded] = useState(false);

  async function load(pinValue) {
    const { data: result, error } = await supabase.rpc("get_delivery", { p_slug: slug, p_pin: pinValue || null });
    if (error || !result) {
      setState("error");
      return;
    }
    setData(result);
    setState(result.status);
  }

  useEffect(() => {
    let active = true;
    supabase.rpc("get_delivery", { p_slug: slug, p_pin: null }).then(({ data: result, error }) => {
      if (!active) return;
      if (error || !result) {
        setState("error");
        return;
      }
      setData(result);
      setState(result.status);
    });
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (data?.client_name) document.title = `Fotos de ${firstName(data.client_name)} — Emerson Honorato Retratos`;
  }, [data]);

  async function submitPin(event) {
    event.preventDefault();
    if (!pin.trim()) return;
    setChecking(true);
    await load(pin.trim());
    setChecking(false);
  }

  function openReview() {
    supabase.rpc("mark_review_click", { p_slug: slug }).then(() => {});
    window.open(data.review_url, "_blank", "noopener");
  }

  const whatsappLink = (text) => `https://api.whatsapp.com/send?phone=${STUDIO_WHATSAPP}&text=${encodeURIComponent(text)}`;

  if (state === "loading") {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 text-white/70">
          <img src={LOGO} alt="Emerson Honorato Retratos" className="h-16 w-16 animate-pulse object-contain" />
          <p className="text-sm tracking-wide">Preparando suas fotos…</p>
        </div>
      </Shell>
    );
  }

  if (state === "need_pin" || state === "wrong_pin") {
    return (
      <Shell cover={data?.cover_url}>
        <form onSubmit={submitPin} className="w-full max-w-sm rounded-[28px] border border-white/10 bg-white/[0.06] p-7 text-center shadow-2xl backdrop-blur-xl">
          <img src={LOGO} alt="Emerson Honorato Retratos" className="mx-auto h-14 w-14 object-contain" />
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#e9c77b]">Galeria protegida</p>
          <h1 className="mt-2 text-4xl" style={SERIF}>Olá, {firstName(data?.client_name)}</h1>
          <p className="mt-2 text-sm text-white/70">Digite a senha que você recebeu para ver suas fotos.</p>
          <input
            autoFocus
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Senha"
            className="mt-6 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3.5 text-center text-lg tracking-[0.4em] text-white placeholder:tracking-normal placeholder:text-white/40 focus:border-[#e9c77b] focus:outline-none"
          />
          {state === "wrong_pin" ? <p className="mt-3 text-sm text-red-300">Senha incorreta. Tente de novo.</p> : null}
          <button type="submit" disabled={checking} className="mt-5 w-full rounded-2xl bg-[#e9c77b] px-5 py-3.5 font-semibold text-[#1b1610] transition hover:bg-[#f3d692] disabled:opacity-60">
            {checking ? "Verificando…" : "Ver minhas fotos"}
          </button>
        </form>
      </Shell>
    );
  }

  if (state !== "ok") {
    const expired = state === "expired";
    return (
      <Shell>
        <div className="w-full max-w-sm text-center">
          <img src={LOGO} alt="Emerson Honorato Retratos" className="mx-auto h-16 w-16 object-contain" />
          <h1 className="mt-6 text-4xl" style={SERIF}>{expired ? "Este link expirou" : "Galeria não encontrada"}</h1>
          <p className="mt-3 text-sm leading-6 text-white/70">
            {expired
              ? "O prazo para baixar as fotos terminou. Fale comigo que eu libero de novo pra você."
              : "Confira se o link está completo ou fale comigo pelo WhatsApp."}
          </p>
          <a
            href={whatsappLink(expired ? `Olá! O link das minhas fotos (${data?.title || ""}) expirou. Pode liberar de novo?` : "Olá! Não consegui abrir o link das minhas fotos.")}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex rounded-2xl bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-700"
          >
            Falar no WhatsApp
          </a>
        </div>
      </Shell>
    );
  }

  const embed = driveEmbedUrl(data.drive_url);
  const name = firstName(data.client_name);

  return (
    <div className="min-h-screen bg-[#f7f3ee] text-[#1b1610]">
      {/* Capa */}
      <header className="relative flex min-h-[78vh] items-end overflow-hidden bg-[#0f0d0b] text-white sm:min-h-[86vh]">
        {data.cover_url ? (
          <img src={data.cover_url} alt={data.title} fetchpriority="high" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#3a2f22,#0f0d0b_70%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/30" />
        <div className="absolute left-0 right-0 top-0 flex items-center justify-center pt-6">
          <img src={LOGO} alt="Emerson Honorato Retratos" className="h-14 w-14 object-contain drop-shadow-lg" />
        </div>
        <div className="relative mx-auto w-full max-w-4xl px-6 pb-14 text-center sm:pb-20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.36em] text-[#e9c77b]">Suas fotos chegaram</p>
          <h1 className="mt-3 text-5xl leading-[1.05] sm:text-7xl" style={SERIF}>{data.title}</h1>
          <p className="mt-4 text-sm text-white/80">
            {data.client_name}
            {data.event_date ? ` • ${formatDateBR(data.event_date)}` : ""}
          </p>
          <a
            href="#galeria"
            className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-medium backdrop-blur transition hover:bg-white/20"
          >
            Ver galeria <span aria-hidden="true">↓</span>
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5">
        {/* Mensagem + ações */}
        <section className="-mt-10 rounded-[32px] bg-white p-7 shadow-[0_30px_80px_rgba(27,22,16,0.12)] sm:p-10">
          <div className="grid gap-8 md:grid-cols-[1.3fr_1fr] md:items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl" style={SERIF}>Olá, {name}!</h2>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-7 text-[#4a4036]">
                {data.message ||
                  "Foi um prazer registrar esse momento. Separei cada foto com muito carinho — espero que você ame o resultado tanto quanto eu amei fazer."}
              </p>
              {data.expires_at ? (
                <p className="mt-4 inline-flex rounded-full bg-[#f7f3ee] px-3 py-1 text-xs font-medium text-[#7a6650]">
                  Disponível para download até {formatDateBR(data.expires_at)}
                </p>
              ) : null}
            </div>
            <div className="space-y-3">
              <a
                href={data.drive_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1b1610] px-6 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-[#2c241a]"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Baixar todas as fotos
              </a>
              <a
                href={whatsappLink(`Olá, Emerson! Recebi minhas fotos (${data.title}) 😍`)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#e4dbd0] px-6 py-3.5 text-sm font-semibold text-[#1b1610] transition hover:bg-[#f7f3ee]"
              >
                Falar com o Emerson
              </a>
            </div>
          </div>
        </section>

        {/* Galeria */}
        <section id="galeria" className="scroll-mt-6 py-14">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#a8875a]">Galeria</p>
              <h2 className="mt-1 text-4xl" style={SERIF}>Suas fotos</h2>
            </div>
            <a href={data.drive_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[#7a6650] underline-offset-4 hover:underline">
              Abrir no Google Drive ↗
            </a>
          </div>
          {embed ? (
            <div className="relative overflow-hidden rounded-[28px] border border-[#e4dbd0] bg-white shadow-sm">
              {!galleryLoaded ? (
                <div className="absolute inset-0 grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="aspect-[4/5] animate-pulse rounded-xl bg-[#efe8df]" />
                  ))}
                </div>
              ) : null}
              <iframe
                title="Galeria de fotos"
                src={embed}
                loading="lazy"
                onLoad={() => setGalleryLoaded(true)}
                className={`relative h-[75vh] min-h-[480px] w-full transition-opacity duration-500 ${galleryLoaded ? "opacity-100" : "opacity-0"}`}
              />
            </div>
          ) : (
            <a href={data.drive_url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-[#d9cdbf] bg-white px-6 py-16 text-center hover:bg-[#fbf8f4]">
              <span className="text-4xl" aria-hidden="true">📁</span>
              <span className="mt-3 text-lg font-semibold">Abrir suas fotos no Google Drive</span>
              <span className="mt-1 text-sm text-[#7a6650]">Toque para ver e baixar</span>
            </a>
          )}
        </section>

        {/* Álbuns e impressões */}
        {Array.isArray(data.products) && data.products.length ? (
          <section className="pb-14">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#a8875a]">Eternize</p>
            <h2 className="mt-1 text-4xl" style={SERIF}>Suas fotos merecem sair da tela</h2>
            <p className="mt-2 max-w-2xl text-[15px] leading-7 text-[#4a4036]">Fotos no celular se perdem. Impressas, elas viram memória de família.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.products.map((item, index) => (
                <div key={`${item.name}-${index}`} className="flex flex-col rounded-[24px] border border-[#e4dbd0] bg-white p-6 shadow-sm">
                  <span className="text-2xl" aria-hidden="true">{["📖", "🖼️", "📷", "🎁", "✨"][index % 5]}</span>
                  <h3 className="mt-3 text-2xl" style={SERIF}>{item.name}</h3>
                  {item.description ? <p className="mt-2 flex-1 text-sm leading-6 text-[#4a4036]">{item.description}</p> : <div className="flex-1" />}
                  {item.price ? <p className="mt-4 text-sm font-semibold text-[#7a6650]">{item.price}</p> : null}
                  <a
                    href={whatsappLink(`Olá, Emerson! Vi minhas fotos (${data.title}) e tenho interesse em: ${item.name}. Pode me passar os detalhes?`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex justify-center rounded-2xl bg-[#1b1610] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2c241a]"
                  >
                    Quero saber mais
                  </a>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Avaliação no Google */}
        {data.review_url ? (
          <section className="pb-14">
            <div className="relative overflow-hidden rounded-[32px] border border-[#ecdcc0] bg-gradient-to-br from-[#fffaf0] via-white to-[#fbf1df] p-8 text-center shadow-[0_20px_60px_rgba(168,135,90,0.15)] sm:p-12">
              <div className="flex justify-center gap-1.5 text-[#e2b04a]" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} viewBox="0 0 24 24" className="h-8 w-8 drop-shadow-sm sm:h-9 sm:w-9" fill="currentColor"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" /></svg>
                ))}
              </div>
              <h2 className="mt-5 text-4xl sm:text-5xl" style={SERIF}>Gostou das suas fotos?</h2>
              <p className="mx-auto mt-3 max-w-lg text-[15px] leading-7 text-[#4a4036]">
                Sua opinião ajuda outras famílias a me encontrarem. Leva menos de 1 minuto e significa muito pra mim. 💛
              </p>
              <button
                type="button"
                onClick={openReview}
                className="mt-7 inline-flex items-center gap-3 rounded-2xl bg-white px-7 py-4 text-base font-semibold text-[#1b1610] shadow-[0_10px_30px_rgba(27,22,16,0.12)] ring-1 ring-[#e4dbd0] transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(27,22,16,0.16)]"
              >
                <svg viewBox="0 0 48 48" className="h-6 w-6" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
                </svg>
                Avaliar no Google
              </button>
            </div>
          </section>
        ) : null}

        {/* Indique e ganhe */}
        {data.referral_code ? (
          <section className="pb-14">
            <div className="grid gap-6 rounded-[32px] border border-[#e4dbd0] bg-white p-7 shadow-sm sm:p-10 md:grid-cols-[1.4fr_1fr] md:items-center">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#a8875a]">Indique e ganhe</p>
                <h2 className="mt-1 text-4xl" style={SERIF}>Conhece alguém que vai amar?</h2>
                <p className="mt-3 text-[15px] leading-7 text-[#4a4036]">{data.referral_reward || "Indique um amigo e ganhe um presente no seu próximo ensaio."}</p>
              </div>
              <div className="rounded-[24px] bg-[#f7f3ee] p-5 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-[#7a6650]">Seu código</p>
                <p className="mt-1 text-3xl font-bold tracking-[0.18em] text-[#1b1610]">{data.referral_code}</p>
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Fiz meu ensaio com o Emerson Honorato Retratos e amei as fotos! 📸💛\nPede seu orçamento por aqui (já vai com o meu código ${data.referral_code}):\nhttps://orcamento.emersonhonoratoretratos.com.br/pedido?indicacao=${data.referral_code}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex w-full justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  Indicar pelo WhatsApp
                </a>
              </div>
            </div>
          </section>
        ) : null}

        {/* Como baixar */}
        <section className="pb-16">
          <div className="rounded-[28px] bg-[#1b1610] p-7 text-white sm:p-10">
            <h2 className="text-3xl" style={SERIF}>Como baixar</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-3">
              {[
                ["1", "Abra no Drive", "Toque em “Baixar todas as fotos”. Não precisa ter conta Google."],
                ["2", "Baixe tudo", "No computador, clique em “Fazer download” no topo: as fotos vêm num arquivo .zip."],
                ["3", "No celular", "Abra a foto, toque nos ⋮ três pontinhos e escolha “Fazer download”."],
              ].map(([n, title, text]) => (
                <div key={n} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e9c77b] text-sm font-bold text-[#1b1610]">{n}</span>
                  <p className="mt-3 font-semibold">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-white/70">{text}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-white/60">
              Dica: guarde uma cópia no seu computador ou na nuvem — e se postar, me marca! 📸
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#e4dbd0] py-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#1b1610] p-1.5">
          <img src={LOGO} alt="" className="h-full w-full object-contain" />
        </span>
        <p className="mt-2 text-xs uppercase tracking-[0.3em] text-[#7a6650]">Emerson Honorato Retratos</p>
      </footer>
    </div>
  );
}
