import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/supabase";
import { STUDIO_WHATSAPP, formatDateBR } from "@/lib/delivery";

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

const thumbUrl = (id, size = 500) => `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`;
const altThumbUrl = (id, size = 500) => `https://lh3.googleusercontent.com/d/${id}=w${size}`;
const brl = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const shortName = (name = "") => String(name).replace(/\.[A-Za-z0-9]{2,5}$/, "");

function Photo({ photo, size, className, alt }) {
  const [src, setSrc] = useState(thumbUrl(photo.id, size));
  return (
    <img
      src={src}
      alt={alt || shortName(photo.name)}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setSrc((current) => (current.includes("lh3.") ? current : altThumbUrl(photo.id, size)))}
      className={className}
    />
  );
}

function Heart({ filled, className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 21s-7.5-4.6-9.5-9.3C1.1 8.3 3.2 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.8 0 5.9 3.8 4.5 7.2C19.5 16.4 12 21 12 21z" strokeLinejoin="round" />
    </svg>
  );
}

// Página pública: o cliente vê as fotos em baixa (do Google Drive) e marca as favoritas
export default function PublicPhotoSelection({ slug }) {
  useSerifFont();
  const [state, setState] = useState("loading");
  const [data, setData] = useState(null);
  const [pin, setPin] = useState("");
  const [pinValue, setPinValue] = useState("");
  const [selected, setSelected] = useState([]);
  const [filter, setFilter] = useState("todas");
  const [viewer, setViewer] = useState(-1);
  const [saveState, setSaveState] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const saveTimer = useRef(null);
  const latest = useRef({ selected: [], note: "" });

  const load = useCallback(async (pinTry) => {
    const { data: result, error: rpcError } = await supabase.rpc("get_selection", { p_slug: slug, p_pin: pinTry || null });
    if (rpcError || !result) {
      setState("error");
      return;
    }
    setData(result);
    setState(result.status);
    if (Array.isArray(result.selected)) setSelected(result.selected);
    if (result.client_note) setNote(result.client_note);
    if (pinTry) setPinValue(pinTry);
  }, [slug]);

  useEffect(() => {
    const timer = setTimeout(() => load(null), 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (data?.client_name) document.title = `Escolha das fotos — ${data.client_name}`;
  }, [data]);

  const photos = useMemo(() => (Array.isArray(data?.photos) ? data.photos : []), [data]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const visible = filter === "escolhidas" ? photos.filter((p) => selectedSet.has(p.name)) : photos;
  const included = Number(data?.included_count || 0);
  const extraPrice = Number(data?.extra_price || 0);
  const maxCount = Number(data?.max_count || 0);
  const extras = included > 0 ? Math.max(0, selected.length - included) : 0;
  const locked = state !== "aberta";

  const scheduleSave = useCallback((nextSelected, nextNote) => {
    latest.current = { selected: nextSelected, note: nextNote };
    setSaveState("salvando");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const { error: rpcError } = await supabase.rpc("save_selection", {
        p_slug: slug,
        p_pin: pinValue || null,
        p_selected: latest.current.selected,
        p_note: latest.current.note || null,
        p_submit: false,
      });
      setSaveState(rpcError ? "erro" : "salvo");
      if (rpcError) setError(rpcError.message);
    }, 900);
  }, [slug, pinValue]);

  function toggle(name) {
    if (locked) return;
    setError("");
    const has = selectedSet.has(name);
    if (!has && maxCount > 0 && selected.length >= maxCount) {
      setError(`Você pode escolher no máximo ${maxCount} fotos.`);
      return;
    }
    const next = has ? selected.filter((n) => n !== name) : [...selected, name];
    setSelected(next);
    scheduleSave(next, note);
  }

  // teclado no visualizador
  useEffect(() => {
    if (viewer < 0) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setViewer(-1);
      if (event.key === "ArrowRight") setViewer((i) => Math.min(visible.length - 1, i + 1));
      if (event.key === "ArrowLeft") setViewer((i) => Math.max(0, i - 1));
      if (event.key === " " || event.key.toLowerCase() === "f") {
        event.preventDefault();
        const photo = visible[viewer];
        if (photo) toggle(photo.name);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function submit() {
    setSending(true);
    setError("");
    clearTimeout(saveTimer.current);
    const { error: rpcError } = await supabase.rpc("save_selection", {
      p_slug: slug,
      p_pin: pinValue || null,
      p_selected: selected,
      p_note: note || null,
      p_submit: true,
    });
    setSending(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setConfirming(false);
    setState("enviada");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const wa = (text) => `https://api.whatsapp.com/send?phone=${STUDIO_WHATSAPP}&text=${encodeURIComponent(text)}`;
  const first = String(data?.client_name || "").trim().split(/\s+/)[0];

  const shell = (children) => (
    <div className="flex min-h-screen items-center justify-center bg-[#0f0d0b] px-5 py-12 text-white">
      <div className="w-full max-w-sm text-center">
        <img src={LOGO} alt="Emerson Honorato Retratos" className="mx-auto h-16 w-16 object-contain" />
        {children}
      </div>
    </div>
  );

  if (state === "loading") return shell(<p className="mt-5 text-sm text-white/70">Carregando suas fotos…</p>);
  if (state === "not_found" || state === "error") {
    return shell(
      <>
        <h1 className="mt-6 text-4xl" style={SERIF}>Galeria não encontrada</h1>
        <p className="mt-3 text-sm text-white/70">Confira se o link está completo ou fale comigo pelo WhatsApp.</p>
        <a href={wa("Olá! Não consegui abrir o link para escolher minhas fotos.")} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex rounded-2xl bg-emerald-600 px-6 py-3 font-semibold">Falar no WhatsApp</a>
      </>,
    );
  }
  if (state === "need_pin" || state === "wrong_pin") {
    return shell(
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pin.trim()) load(pin.trim());
        }}
        className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.06] p-7"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#e9c77b]">Escolha das fotos</p>
        <h1 className="mt-2 text-4xl" style={SERIF}>Olá, {String(data?.client_name || "").split(" ")[0]}</h1>
        <p className="mt-2 text-sm text-white/70">Digite a senha que você recebeu.</p>
        <input autoFocus inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Senha" className="mt-6 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3.5 text-center text-lg tracking-[0.4em] placeholder:tracking-normal placeholder:text-white/40 focus:border-[#e9c77b] focus:outline-none" />
        {state === "wrong_pin" ? <p className="mt-3 text-sm text-red-300">Senha incorreta. Tente de novo.</p> : null}
        <button type="submit" className="mt-5 w-full rounded-2xl bg-[#e9c77b] px-5 py-3.5 font-semibold text-[#1b1610]">Ver minhas fotos</button>
      </form>,
    );
  }

  const current = viewer >= 0 ? visible[viewer] : null;

  return (
    <div className="min-h-screen bg-[#0f0d0b] pb-36 text-white">
      <header className="mx-auto max-w-6xl px-5 pb-6 pt-8 text-center">
        <img src={LOGO} alt="Emerson Honorato Retratos" className="mx-auto h-14 w-14 object-contain" />
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.34em] text-[#e9c77b]">{state === "enviada" ? "Escolha enviada" : "Escolha suas favoritas"}</p>
        <h1 className="mt-2 text-4xl leading-tight sm:text-6xl" style={SERIF}>{data.title}</h1>
        <p className="mt-2 text-sm text-white/70">{data.client_name}{data.event_date ? ` • ${formatDateBR(data.event_date)}` : ""} • {photos.length} fotos</p>
        {state === "enviada" ? (
          <div className="mx-auto mt-6 max-w-lg rounded-[24px] border border-emerald-400/30 bg-emerald-500/10 p-5">
            <p className="text-lg font-semibold">Recebi sua escolha, {first}! 💛</p>
            <p className="mt-1 text-sm text-white/75">{selected.length} fotos escolhidas{data.submitted_at ? ` em ${new Date(data.submitted_at).toLocaleString("pt-BR")}` : ""}. Agora é comigo: vou tratar cada uma com carinho.</p>
            <a href={wa(`Olá, Emerson! Enviei minha escolha de fotos (${data.title}).`)} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold">Falar no WhatsApp</a>
          </div>
        ) : state === "expired" ? (
          <div className="mx-auto mt-6 max-w-lg rounded-[24px] border border-red-400/30 bg-red-500/10 p-5 text-sm">
            O prazo para escolher terminou{data.expires_at ? ` em ${formatDateBR(data.expires_at)}` : ""}. Fale comigo que eu libero de novo.
            <a href={wa(`Olá, Emerson! O prazo para escolher as fotos (${data.title}) terminou. Pode liberar de novo?`)} target="_blank" rel="noopener noreferrer" className="mt-3 block font-semibold text-emerald-300">Falar no WhatsApp →</a>
          </div>
        ) : (
          <div className="mx-auto mt-5 max-w-2xl text-[15px] leading-7 text-white/80">
            {data.message ? <p className="whitespace-pre-line">{data.message}</p> : null}
            <p className="mt-2 text-sm text-white/60">
              Toque no <span className="text-rose-300">♥</span> para escolher. {included > 0 ? `Seu pacote inclui ${included} fotos` : "Escolha quantas quiser"}
              {included > 0 && extraPrice > 0 ? `; cada foto a mais custa ${brl(extraPrice)}` : ""}.
              {data.expires_at ? ` Escolha até ${formatDateBR(data.expires_at)}.` : ""} Sua escolha fica salva sozinha — pode voltar depois.
            </p>
          </div>
        )}
      </header>

      <div className="sticky top-0 z-20 border-y border-white/10 bg-[#0f0d0b]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 text-sm">
          {[["todas", `Todas (${photos.length})`], ["escolhidas", `Escolhidas (${selected.length})`]].map(([key, label]) => (
            <button key={key} type="button" onClick={() => setFilter(key)} className={`rounded-full px-4 py-1.5 font-medium transition ${filter === key ? "bg-white text-[#1b1610]" : "text-white/70 hover:bg-white/10"}`}>{label}</button>
          ))}
          <span className="ml-auto text-xs text-white/50">{saveState === "salvando" ? "Salvando…" : saveState === "salvo" ? "Salvo ✓" : saveState === "erro" ? "Não salvou — verifique a internet" : ""}</span>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-2 pt-3 sm:px-4">
        {visible.length === 0 ? (
          <p className="py-16 text-center text-white/60">{filter === "escolhidas" ? "Você ainda não escolheu nenhuma foto." : "Nenhuma foto nesta galeria."}</p>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2 lg:grid-cols-4">
            {visible.map((photo, index) => {
              const isSel = selectedSet.has(photo.name);
              return (
                <div key={photo.id} className={`group relative overflow-hidden rounded-lg bg-white/5 ${isSel ? "ring-2 ring-rose-400" : ""}`}>
                  <button type="button" onClick={() => setViewer(index)} className="block aspect-[4/5] w-full">
                    <Photo photo={photo} size={500} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
                  </button>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => toggle(photo.name)}
                    aria-label={isSel ? "Remover da escolha" : "Escolher esta foto"}
                    className={`absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition ${isSel ? "bg-rose-500 text-white" : "bg-black/45 text-white hover:bg-black/65"} ${locked && !isSel ? "hidden" : ""}`}
                  >
                    <Heart filled={isSel} />
                  </button>
                  <span className="pointer-events-none absolute bottom-1.5 left-2 text-[10px] font-medium text-white/80 drop-shadow">{shortName(photo.name)}</span>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* barra de resumo */}
      {state === "aberta" ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#171310]/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold">
                {selected.length} escolhida{selected.length === 1 ? "" : "s"}
                {included > 0 ? <span className="font-normal text-white/60"> de {included} inclusas</span> : null}
              </p>
              {extras > 0 ? (
                <p className="text-xs text-amber-300">{extras} extra{extras > 1 ? "s" : ""}{extraPrice > 0 ? ` × ${brl(extraPrice)} = ${brl(extras * extraPrice)}` : ""}</p>
              ) : included > 0 ? (
                <div className="mt-1 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-rose-400" style={{ width: `${Math.min(100, (selected.length / included) * 100)}%` }} /></div>
              ) : null}
              {error ? <p className="mt-1 text-xs text-red-300">{error}</p> : null}
            </div>
            <button type="button" disabled={!selected.length} onClick={() => setConfirming(true)} className="rounded-2xl bg-[#e9c77b] px-6 py-3 text-sm font-bold text-[#1b1610] shadow-lg transition hover:bg-[#f3d692] disabled:opacity-40">
              Enviar minha escolha
            </button>
          </div>
        </div>
      ) : null}

      {/* visualizador */}
      {current ? (
        <div className="fixed inset-0 z-40 flex flex-col bg-black/95">
          <div className="flex items-center justify-between px-4 py-3 text-sm text-white/80">
            <span>{shortName(current.name)} • {viewer + 1} de {visible.length}</span>
            <button type="button" onClick={() => setViewer(-1)} className="rounded-full px-3 py-1.5 text-lg hover:bg-white/10" aria-label="Fechar">✕</button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
            <Photo key={current.id} photo={current} size={1600} className="max-h-full max-w-full object-contain" />
            {viewer > 0 ? <button type="button" onClick={() => setViewer(viewer - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-4 py-3 text-2xl hover:bg-white/20" aria-label="Anterior">‹</button> : null}
            {viewer < visible.length - 1 ? <button type="button" onClick={() => setViewer(viewer + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-4 py-3 text-2xl hover:bg-white/20" aria-label="Próxima">›</button> : null}
          </div>
          <div className="flex items-center justify-center gap-3 px-4 py-4">
            {!locked ? (
              <button type="button" onClick={() => toggle(current.name)} className={`inline-flex items-center gap-2 rounded-2xl px-6 py-3 font-semibold ${selectedSet.has(current.name) ? "bg-rose-500 text-white" : "bg-white text-[#1b1610]"}`}>
                <Heart filled={selectedSet.has(current.name)} />
                {selectedSet.has(current.name) ? "Escolhida" : "Escolher esta"}
              </button>
            ) : null}
            <span className="hidden text-xs text-white/40 sm:inline">← → para navegar • espaço para escolher</span>
          </div>
        </div>
      ) : null}

      {/* confirmar envio */}
      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={() => setConfirming(false)}>
          <div className="w-full max-w-md rounded-t-[28px] bg-white p-6 text-[#1b1610] sm:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-3xl" style={SERIF}>Enviar sua escolha?</h2>
            <p className="mt-2 text-sm leading-6 text-[#4a4036]">
              Você escolheu <strong>{selected.length} fotos</strong>
              {included > 0 ? ` (${Math.min(selected.length, included)} do pacote${extras ? ` + ${extras} extra${extras > 1 ? "s" : ""}` : ""})` : ""}.
              {extras > 0 && extraPrice > 0 ? <> Valor das extras: <strong>{brl(extras * extraPrice)}</strong>.</> : null}
              {included > 0 && selected.length < included ? <> Ainda dá para escolher mais {included - selected.length} sem custo.</> : null}
            </p>
            <label className="mt-4 block text-sm font-medium">
              Algum pedido especial? (opcional)
              <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="Ex.: a foto EME_1230 em preto e branco…" className="mt-1 min-h-[90px] w-full rounded-2xl border border-[#e4dbd0] px-4 py-3 text-sm focus:border-[#a8875a] focus:outline-none" />
            </label>
            {error ? <p className="mt-3 rounded-2xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p> : null}
            <p className="mt-3 text-xs text-[#7a6650]">Depois de enviar, a escolha fica travada. Se precisar mudar, é só me chamar.</p>
            <div className="mt-5 flex gap-2">
              <button type="button" disabled={sending} onClick={submit} className="flex-1 rounded-2xl bg-[#1b1610] px-5 py-3.5 font-semibold text-white disabled:opacity-60">{sending ? "Enviando…" : "Enviar escolha"}</button>
              <button type="button" onClick={() => setConfirming(false)} className="rounded-2xl px-4 py-3.5 text-sm text-[#7a6650]">Voltar</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
