import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/supabase";
import { STUDIO_WHATSAPP } from "@/lib/delivery";
import AlbumSpread from "@/components/album/AlbumSpread";

// Página do cliente: vê o álbum diagramado e aprova cada lâmina ou pede troca
const LOGO = "/Emerson%20Honorato%20Retratos%20Logo.png";

export default function PublicAlbum({ slug }) {
  const [data, setData] = useState(null);
  const [erro, setErro] = useState("");
  const [feedback, setFeedback] = useState({});
  const [abrirNota, setAbrirNota] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [largura, setLargura] = useState(360);
  const salvarTimer = useRef(null);

  useEffect(() => {
    supabase.rpc("get_album", { p_slug: slug }).then(({ data: d, error }) => {
      if (error) return setErro("Não consegui abrir o álbum agora. Tente de novo em instantes.");
      if (!d || d.status === "not_found") return setErro("Álbum não encontrado. Confira o link que você recebeu.");
      setData(d);
      setFeedback(d.feedback || {});
    });
  }, [slug]);

  useEffect(() => {
    const ajustar = () => setLargura(Math.min(1000, window.innerWidth - 24));
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, []);

  const fotosPorId = useMemo(() => new Map((data?.photos || []).map((f) => [f.id, f])), [data]);
  const total = data?.spreads?.length || 0;
  const aprovadas = Object.entries(feedback).filter(([k, v]) => Number(k) < total && v?.ok === true).length;
  const trocas = Object.entries(feedback).filter(([k, v]) => Number(k) < total && v?.ok === false).length;
  const travado = data?.status === "aprovado";
  const marca = `EMERSON HONORATO RETRATOS • PROVA • ${String(data?.client_name || "").toUpperCase()}`;

  // guarda o rascunho das respostas (se fechar a página, não perde)
  function responder(indice, valor) {
    const novo = { ...feedback, [indice]: valor };
    setFeedback(novo);
    clearTimeout(salvarTimer.current);
    salvarTimer.current = setTimeout(() => supabase.rpc("answer_album", { p_slug: slug, p_feedback: novo, p_finish: false }), 800);
  }

  async function concluir() {
    setEnviando(true);
    clearTimeout(salvarTimer.current);
    const { data: r, error } = await supabase.rpc("answer_album", { p_slug: slug, p_feedback: feedback, p_finish: true });
    setEnviando(false);
    if (error) return alert(error.message.replace(/^.*?: /, ""));
    setData((d) => ({ ...d, status: r.status }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (erro) return <div className="flex min-h-screen items-center justify-center bg-[#14110d] p-6 text-center text-white/80">{erro}</div>;
  if (!data) return <div className="flex min-h-screen items-center justify-center bg-[#14110d] text-white/60">Abrindo o álbum…</div>;

  return (
    <div className="min-h-screen bg-[#14110d] pb-32 text-white" style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }} onContextMenu={(e) => e.preventDefault()}>
      <header className="mx-auto max-w-3xl px-5 pb-6 pt-10 text-center">
        <img src={LOGO} alt="Emerson Honorato Retratos" className="mx-auto h-14 w-14 object-contain" />
        <p className="mt-4 text-[11px] uppercase tracking-[0.3em] text-[#e9c77b]">Aprovação do álbum{data.version > 1 ? ` • versão ${data.version}` : ""}</p>
        <h1 className="mt-2 text-3xl font-light" style={{ fontFamily: '"Didot", "Bodoni 72", Georgia, serif' }}>{data.title}</h1>
        {data.message ? <p className="mx-auto mt-4 max-w-xl whitespace-pre-line text-sm leading-6 text-white/75">{data.message}</p> : null}
        {data.status === "aprovado" ? (
          <p className="mx-auto mt-5 max-w-md rounded-2xl bg-emerald-500/15 px-4 py-3 text-sm text-emerald-200">✅ Álbum aprovado! Agora ele vai para a produção. Obrigado pela confiança 💛</p>
        ) : data.status === "ajustes" ? (
          <p className="mx-auto mt-5 max-w-md rounded-2xl bg-amber-500/15 px-4 py-3 text-sm text-amber-100">Recebi seus pedidos de troca. Assim que eu ajustar, te mando a nova versão por aqui mesmo.</p>
        ) : (
          <p className="mx-auto mt-5 max-w-md text-xs leading-5 text-white/55">
            {data.protect !== false ? "👆 Toque e segure em cada lâmina para ver nítido. " : ""}Marque <b>Aprovar</b> ou <b>Pedir troca</b> (contando o que quer mudar). No final, toque em <b>Enviar resposta</b>.
          </p>
        )}
      </header>

      <main className="mx-auto flex max-w-5xl flex-col items-center gap-10 px-3">
        {data.spreads.map((lamina, i) => {
          const f = feedback[i];
          return (
            <section key={i} className="flex w-full flex-col items-center gap-3">
              <p className="text-xs uppercase tracking-[0.25em] text-white/50">Lâmina {i + 1} de {total}</p>
              <AlbumSpread lamina={lamina} size={data.size} fotosPorId={fotosPorId} largura={largura} protegido={data.protect !== false} marca={marca} />
              {!travado ? (
                <div className="flex w-full max-w-xl flex-col items-center gap-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { responder(i, { ok: true }); setAbrirNota(null); }}
                      className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${f?.ok === true ? "bg-emerald-500 text-white" : "bg-white/10 text-white hover:bg-white/20"}`}
                    >
                      ✓ Aprovar
                    </button>
                    <button
                      type="button"
                      onClick={() => { responder(i, { ok: false, note: f?.note || "" }); setAbrirNota(i); }}
                      className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${f?.ok === false ? "bg-amber-400 text-[#1b1610]" : "bg-white/10 text-white hover:bg-white/20"}`}
                    >
                      ✎ Pedir troca
                    </button>
                  </div>
                  {f?.ok === false && (abrirNota === i || f.note) ? (
                    <textarea
                      autoFocus={abrirNota === i}
                      value={f.note || ""}
                      onChange={(e) => responder(i, { ok: false, note: e.target.value.slice(0, 600) })}
                      rows={2}
                      placeholder="O que você quer mudar nesta lâmina? Ex.: trocar a foto da direita por uma com a vovó"
                      className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-[#e9c77b]/40"
                      style={{ userSelect: "text", WebkitUserSelect: "text" }}
                    />
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}
      </main>

      {!travado ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#14110d]/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
            <span className="text-sm text-white/75">
              {aprovadas} de {total} aprovadas{trocas ? ` • ${trocas} para trocar` : ""}
            </span>
            <a href={`https://wa.me/${STUDIO_WHATSAPP}`} target="_blank" rel="noreferrer" className="text-xs text-white/50 underline">Dúvida? WhatsApp</a>
            <button
              type="button"
              disabled={enviando || (aprovadas < total && trocas === 0)}
              onClick={concluir}
              className="ml-auto rounded-full bg-[#e9c77b] px-6 py-2.5 text-sm font-bold text-[#1b1610] disabled:opacity-40"
            >
              {enviando ? "Enviando…" : trocas ? "Enviar pedidos de troca" : "Aprovar álbum"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
