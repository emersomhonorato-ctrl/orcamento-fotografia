import { useEffect, useReducer, useRef, useState } from "react";
import { Download, FolderOpen, Images, RotateCcw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ASSINATURA, criarProjeto, criarProjetoCapa, MODELOS, modelosPossiveis, mudarModelo, trocarFoto } from "@/lib/carrossel/layout";
import { lerFotos, liberarFotos, EXT_MUSICA, EXT_VIDEO } from "@/lib/carrossel/photos";
import { ALTURA_REELS, baixarZip, renderizar, SEM_SERIFA, SERIFA } from "@/lib/carrossel/render";

// Carrossel Álbum dentro do app: escolhe as fotos do computador, monta o carrossel estilo álbum,
// a foto única (e a capa), deixa trocar/enquadrar e baixa os JPGs. Tudo no navegador.

const NOMES_PAGINA = { capa: "capa", encerramento: "encerramento", panoramica: "foto dupla" };
const nomeArquivo = (texto) => String(texto || "trabalho").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 _-]+/g, " ").trim().replace(/\s+/g, "-") || "trabalho";

function Slot({ s, foto, k, selecionado, onSelecionar, onMudou }) {
  const ref = useRef(null);
  const [x, y, w, h] = s.caixa;
  const sw = w * k;
  const sh = h * k;
  const esc = foto ? Math.max(sw / foto.largura, sh / foto.altura) * Math.max(1, s.zoom) : 1;
  const dw = foto ? foto.largura * esc : sw;
  const dh = foto ? foto.altura * esc : sh;

  // rodinha do mouse = zoom (precisa de listener "não passivo" para não rolar a página)
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const roda = (ev) => {
      ev.preventDefault();
      onSelecionar();
      s.zoom = Math.min(4, Math.max(1, s.zoom * Math.exp(-ev.deltaY * 0.0015)));
      onMudou();
    };
    el.addEventListener("wheel", roda, { passive: false });
    return () => el.removeEventListener("wheel", roda);
  }, [s, onSelecionar, onMudou]);

  function arrastar(ev) {
    onSelecionar();
    const el = ref.current;
    el.setPointerCapture(ev.pointerId);
    let ux = ev.clientX;
    let uy = ev.clientY;
    const mover = (e) => {
      const sobraX = dw - sw;
      const sobraY = dh - sh;
      if (sobraX > 0) s.ox = Math.min(1, Math.max(0, s.ox - (e.clientX - ux) / sobraX));
      if (sobraY > 0) s.oy = Math.min(1, Math.max(0, s.oy - (e.clientY - uy) / sobraY));
      ux = e.clientX;
      uy = e.clientY;
      onMudou();
    };
    const soltar = () => {
      el.removeEventListener("pointermove", mover);
      el.removeEventListener("pointerup", soltar);
    };
    el.addEventListener("pointermove", mover);
    el.addEventListener("pointerup", soltar);
  }

  return (
    <div
      ref={ref}
      onPointerDown={arrastar}
      className={`absolute cursor-grab touch-none overflow-hidden bg-stone-300 active:cursor-grabbing ${selecionado ? "z-10 outline outline-2 outline-offset-2 outline-[#2f5d50]" : ""}`}
      style={{ left: x * k, top: y * k, width: sw, height: sh }}
    >
      {foto ? (
        <img
          src={foto.mini}
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none select-none"
          style={{ width: dw, height: dh, left: -s.ox * (dw - sw), top: -s.oy * (dh - sh) }}
        />
      ) : null}
    </div>
  );
}

function Texto({ k, y, children, serifa, tamanho, espaco = 0, cor = "#262626" }) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 whitespace-nowrap text-center"
      style={{ top: y * k, fontSize: tamanho * k, letterSpacing: espaco * k, color: cor, fontFamily: serifa ? SERIFA : SEM_SERIFA, fontWeight: serifa ? 400 : 300, lineHeight: 1.15 }}
    >
      {children}
    </div>
  );
}

function Pagina({ p, projeto, porNome, largPag, rotulo, sel, setSel, onMudou, modelos, onModelo }) {
  const M = projeto.medidas;
  const dupla = p.tipo === "panoramica";
  const k = largPag / M.largura;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative overflow-hidden bg-[#f7f5f1] shadow-sm" style={{ width: (dupla ? 2 : 1) * largPag, height: M.altura * k }}>
        {p.slots.map((s, i) => (
          <Slot key={i} s={s} foto={porNome.get(s.foto)} k={k} selecionado={sel === s} onSelecionar={() => setSel(s)} onMudou={onMudou} />
        ))}
        {dupla ? <div className="pointer-events-none absolute inset-y-0 left-1/2 border-l border-dashed border-black/25" /> : null}
        {p.tipo === "capa" ? (
          <>
            {projeto.cliente ? <Texto k={k} y={M.margem + p.slots[0].caixa[3] + 70} serifa tamanho={78}>{projeto.cliente}</Texto> : null}
            {projeto.tipo ? <Texto k={k} y={M.margem + p.slots[0].caixa[3] + 180} tamanho={24} espaco={6} cor="#96928c">{projeto.tipo.toUpperCase()}</Texto> : null}
          </>
        ) : null}
        {p.tipo === "encerramento" ? (
          <>
            {projeto.cliente ? <Texto k={k} y={M.altura / 2 - 150} serifa tamanho={56}>{projeto.cliente}</Texto> : null}
            <div className="absolute border-t border-[#96928c]" style={{ left: (M.largura / 2 - 30) * k, width: 60 * k, top: (M.altura / 2 - 20) * k }} />
            <Texto k={k} y={M.altura / 2 + 20} tamanho={24} espaco={7}>{ASSINATURA}</Texto>
          </>
        ) : null}
        {p.marca ? <Texto k={k} y={M.altura - M.margem / 2 - 8} tamanho={15} espaco={4} cor="#96928c">{ASSINATURA}</Texto> : null}
      </div>
      <div className="flex items-center justify-between gap-2" style={{ width: (dupla ? 2 : 1) * largPag }}>
        <span className="text-[11px] tracking-wide text-stone-500">{rotulo}</span>
        {p.tipo === "fotos" && modelos?.length > 1 ? (
          <select
            value={p.modelo || ""}
            onChange={(e) => onModelo(p, e.target.value)}
            title="Trocar o modelo desta página"
            className="max-w-[60%] truncate rounded-md border border-stone-300 bg-white px-1.5 py-0.5 text-[11px] text-stone-700"
          >
            {!p.modelo ? <option value="">modelo…</option> : null}
            {modelos.map((m) => <option key={m} value={m}>{MODELOS[m].nome}</option>)}
          </select>
        ) : null}
      </div>
    </div>
  );
}

export default function CarrosselAlbumPanel() {
  const [arquivos, setArquivos] = useState([]); // tudo o que veio da pasta (fotos, vídeos, música)
  const [fotos, setFotos] = useState([]);
  const [lendo, setLendo] = useState("");
  const [modo, setModo] = useState("carrossel");
  const [cliente, setCliente] = useState("");
  const [tipo, setTipo] = useState("");
  const [nPaginas, setNPaginas] = useState(10);
  const [comCapa, setComCapa] = useState(true);
  const [projeto, setProjeto] = useState(null);
  const [sel, setSel] = useState(null);
  const [trocando, setTrocando] = useState(false);
  const [gerando, setGerando] = useState("");
  const [aviso, setAviso] = useState("");
  const [, redesenhar] = useReducer((n) => n + 1, 0);
  const [largPag, setLargPag] = useState(300);
  const areaRef = useRef(null);

  useEffect(() => () => liberarFotos(fotos), [fotos]);

  // tamanho das páginas acompanha a largura da tela (celular também)
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return undefined;
    const obs = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      setLargPag(projeto?.modo === "capa" ? Math.min(440, w) : w < 520 ? Math.floor((w - 16) / 2) : 300);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [projeto]);

  async function escolher(lista, nomePasta) {
    const todos = [...lista];
    setArquivos(todos);
    setProjeto(null);
    setSel(null);
    setLendo("Lendo fotos…");
    const lidas = await lerFotos(todos, (i, n) => setLendo(`Lendo fotos… ${i}/${n}`));
    setFotos(lidas);
    setLendo("");
    if (!cliente && nomePasta) setCliente(nomePasta);
    if (!lidas.length) setAviso("Não achei fotos JPG, PNG ou TIFF aí.");
  }

  function montar() {
    if (!fotos.length) return setAviso("Escolha primeiro as fotos do trabalho.");
    const opcoes = { cliente: cliente.trim(), tipo: tipo.trim(), nPaginas, comCapa };
    setProjeto(modo === "capa" ? criarProjetoCapa(fotos, opcoes) : criarProjeto(fotos, opcoes));
    setSel(null);
    setAviso("Pronto! Revise e clique em Baixar.");
  }

  async function gerar() {
    setGerando("Gerando páginas…");
    try {
      const saida = await renderizar(projeto, fotos, (n) => setGerando(`Gerando página ${n}…`));
      const base = nomeArquivo(projeto.cliente);
      await baixarZip(saida, `${projeto.modo === "capa" ? "capa" : "carrossel"}-${base}.zip`);
      const paginas = saida.filter((a) => a.nome.startsWith("carrossel/")).length;
      setAviso(projeto.modo === "capa" ? "Baixado: capa.jpg (post) e capa-reels.jpg (capa do vídeo)." : `Baixado: ${paginas} páginas, a foto única e a capa do Reels (arquivo .zip).`);
    } catch (erro) {
      setAviso(`Não consegui gerar: ${erro.message || erro}`);
    } finally {
      setGerando("");
    }
  }

  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(() => setAviso(""), 4500);
    return () => clearTimeout(t);
  }, [aviso]);

  const porNome = new Map(fotos.map((f) => [f.nome, f]));
  const usadas = new Set(projeto ? projeto.paginas.flatMap((p) => p.slots.map((s) => s.foto)) : []);
  const nVideos = arquivos.filter((f) => EXT_VIDEO.test(f.name)).length;
  const nMusicas = arquivos.filter((f) => EXT_MUSICA.test(f.name)).length;
  const fotoSel = sel ? porNome.get(sel.foto) : null;

  let numero = 1;
  const rotulos = projeto
    ? projeto.paginas.map((p) => {
        const dupla = p.tipo === "panoramica";
        const r = (dupla ? `${numero}–${numero + 1}` : String(numero)) + (NOMES_PAGINA[p.tipo] ? ` · ${NOMES_PAGINA[p.tipo]}` : "");
        numero += dupla ? 2 : 1;
        return r;
      })
    : [];

  if (!projeto) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="text-center">
          <p className="text-3xl" style={{ fontFamily: SERIFA }}>Carrossel Álbum</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-stone-500">Emerson Honorato Retratos</p>
        </div>
        <div className="space-y-5 rounded-2xl border border-stone-200 bg-[#f7f5f1] p-5 sm:p-6">
          <div className="flex rounded-xl bg-stone-200/70 p-1">
            {[["carrossel", "Carrossel completo"], ["capa", "Só a capa"]].map(([v, l]) => (
              <button key={v} type="button" onClick={() => setModo(v)} className={`flex-1 rounded-lg py-2 text-sm ${modo === v ? "bg-white font-medium shadow-sm" : "text-stone-500"}`}>{l}</button>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-xs text-stone-500">Fotos exportadas do trabalho</p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm hover:border-stone-400">
                <FolderOpen className="h-4 w-4" />Escolher pasta…
                <input
                  type="file"
                  className="hidden"
                  webkitdirectory=""
                  directory=""
                  multiple
                  onChange={(e) => {
                    const lista = [...(e.target.files || [])];
                    const pasta = lista[0]?.webkitRelativePath?.split("/")[0] || "";
                    if (lista.length) escolher(lista, pasta);
                    e.target.value = "";
                  }}
                />
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm hover:border-stone-400">
                <Images className="h-4 w-4" />ou escolher as fotos
                <input type="file" className="hidden" multiple accept="image/*,video/*,audio/*" onChange={(e) => { if (e.target.files?.length) escolher(e.target.files, ""); e.target.value = ""; }} />
              </label>
            </div>
            <p className="text-sm text-stone-600">
              {lendo || (fotos.length ? `${fotos.length} fotos${nVideos ? ` • ${nVideos} vídeos` : ""}${nMusicas ? " • com música" : ""}` : "Nenhuma pasta escolhida")}
            </p>
            <p className="text-xs text-stone-400">As fotos ficam só no seu computador: nada sobe para a internet.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs text-stone-500">Nome do cliente
              <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Ex.: Ana & Pedro" className="block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900" />
            </label>
            <label className="space-y-1.5 text-xs text-stone-500">Tipo de trabalho
              <input value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder="Ex.: Casamento" className="block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900" />
            </label>
          </div>

          {modo === "carrossel" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-xs text-stone-500">Páginas do carrossel
                <div className="flex items-center gap-3">
                  <input type="range" min={10} max={20} value={nPaginas} onChange={(e) => setNPaginas(+e.target.value)} className="flex-1 accent-[#2f5d50]" />
                  <b className="w-6 text-right text-sm text-stone-900">{nPaginas}</b>
                </div>
              </label>
              <label className="flex items-center gap-2 self-end pb-1 text-sm">
                <input type="checkbox" checked={comCapa} onChange={(e) => setComCapa(e.target.checked)} className="h-4 w-4 accent-[#2f5d50]" />
                Com capa (foto + nome do cliente)
              </label>
            </div>
          ) : null}

          <Button className="w-full rounded-xl bg-[#2f5d50] py-5 text-base hover:bg-[#264d42]" disabled={Boolean(lendo)} onClick={montar}>
            <Sparkles className="mr-2 h-4 w-4" />{modo === "capa" ? "Montar capa" : "Montar carrossel"}
          </Button>
        </div>
        {aviso ? <p className="text-center text-sm text-red-700">{aviso}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-32">
      <div className="sticky top-0 z-20 -mx-2 flex flex-wrap items-center gap-2 border-b border-stone-200 bg-[#f7f5f1]/95 px-3 py-2 backdrop-blur">
        <input value={projeto.cliente} onChange={(e) => { projeto.cliente = e.target.value; redesenhar(); }} placeholder="Cliente" className="w-40 rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm" />
        <input value={projeto.tipo} onChange={(e) => { projeto.tipo = e.target.value; redesenhar(); }} placeholder="Trabalho" className="w-32 rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm" />
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => { setProjeto(null); setSel(null); }}><RotateCcw className="mr-2 h-4 w-4" />Início</Button>
          <Button variant="outline" className="rounded-xl" onClick={montar} title="Monta de novo com outra escolha automática">Remontar</Button>
          <Button className="rounded-xl bg-[#2f5d50] hover:bg-[#264d42]" disabled={Boolean(gerando)} onClick={gerar}>
            <Download className="mr-2 h-4 w-4" />{gerando || (projeto.modo === "capa" ? "Baixar capa" : "Baixar carrossel")}
          </Button>
        </div>
      </div>

      <p className="text-sm text-stone-500">Clique numa foto para selecionar. Arraste para enquadrar, use a rodinha do mouse (ou o controle embaixo) para o zoom e "Trocar foto" para escolher outra.</p>

      <div ref={areaRef}>
        <h3 className="mb-3 text-xs uppercase tracking-[0.16em] text-stone-500">{projeto.modo === "capa" ? "Capa" : "Carrossel"}</h3>
        <div className="flex flex-wrap items-start gap-x-4 gap-y-5">
          {projeto.paginas.map((p, i) => (
            <Pagina
              key={i}
              p={p}
              projeto={projeto}
              porNome={porNome}
              largPag={largPag}
              rotulo={rotulos[i]}
              sel={sel}
              setSel={setSel}
              onMudou={redesenhar}
              modelos={p.tipo === "fotos" ? modelosPossiveis(p, fotos, usadas) : null}
              onModelo={(pagina, modelo) => {
                if (mudarModelo(pagina, modelo, fotos, usadas)) {
                  setSel(null);
                  redesenhar();
                }
              }}
            />
          ))}
        </div>
        {projeto.paginas[0]?.tipo === "capa" ? (
          <>
            <h3 className="mb-1 mt-8 text-xs uppercase tracking-[0.16em] text-stone-500">Capa do Reels (vídeo)</h3>
            <p className="mb-3 max-w-xl text-xs text-stone-500">
              Use esta imagem como capa do vídeo no Instagram. A parte de cima e de baixo some na grade do perfil: o que fica entre as linhas é exatamente a capa acima, na mesma proporção dos carrosséis.
            </p>
            <div className="relative overflow-hidden bg-[#f7f5f1] shadow-sm" style={{ width: largPag * 0.75, height: ALTURA_REELS * (largPag * 0.75) / projeto.medidas.largura }}>
              <div className="absolute inset-x-0" style={{ top: ((ALTURA_REELS - projeto.medidas.altura) / 2) * (largPag * 0.75) / projeto.medidas.largura }}>
                <Pagina p={projeto.paginas[0]} projeto={projeto} porNome={porNome} largPag={largPag * 0.75} rotulo="" sel={sel} setSel={setSel} onMudou={redesenhar} />
              </div>
              {[0, 1].map((i) => (
                <div key={i} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-rose-400/70" style={{ top: (((ALTURA_REELS - projeto.medidas.altura) / 2) + i * projeto.medidas.altura) * (largPag * 0.75) / projeto.medidas.largura }} />
              ))}
            </div>
          </>
        ) : null}
        {projeto.unica ? (
          <>
            <h3 className="mb-3 mt-8 text-xs uppercase tracking-[0.16em] text-stone-500">Foto única</h3>
            <Pagina p={{ tipo: "unica", slots: [projeto.unica] }} projeto={projeto} porNome={porNome} largPag={largPag} rotulo="post de uma foto" sel={sel} setSel={setSel} onMudou={redesenhar} />
          </>
        ) : null}
      </div>

      {sel ? (
        <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-3">
          <div className="flex max-w-full flex-wrap items-center justify-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-2.5 shadow-xl">
            <span className="max-w-[160px] truncate text-xs text-stone-500">{sel.foto}</span>
            <label className="flex items-center gap-2 text-xs text-stone-500">Zoom
              <input type="range" min={1} max={4} step={0.01} value={sel.zoom} onChange={(e) => { sel.zoom = +e.target.value; redesenhar(); }} className="w-36 accent-[#2f5d50]" />
            </label>
            <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setTrocando(true)}>Trocar foto</Button>
            <Button variant="outline" size="sm" className="rounded-lg" onClick={() => { Object.assign(sel, { zoom: 1, ox: 0.5, oy: 0.5 }); redesenhar(); }}>Centralizar</Button>
            <Button size="sm" className="rounded-lg" onClick={() => setSel(null)}>Pronto</Button>
          </div>
        </div>
      ) : null}

      {trocando && sel ? (
        <div className="fixed inset-0 z-50 overflow-auto bg-black/55 p-4" onClick={() => setTrocando(false)}>
          <div className="mx-auto max-w-5xl rounded-2xl bg-[#f7f5f1] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-[0.16em] text-stone-500">Escolha a foto</h3>
              <button type="button" onClick={() => setTrocando(false)} className="rounded-full p-1.5 hover:bg-stone-200" aria-label="Fechar"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2.5">
              {fotos.map((f) => (
                <button
                  key={f.nome}
                  type="button"
                  className={`relative text-left ${f === fotoSel ? "outline outline-[3px] outline-[#2f5d50]" : "hover:outline hover:outline-2 hover:outline-[#2f5d50]"}`}
                  onClick={() => { trocarFoto(sel, f); setTrocando(false); redesenhar(); }}
                >
                  <img src={f.mini} alt="" loading="lazy" className="block h-36 w-full rounded bg-stone-300 object-contain" />
                  {usadas.has(f.nome) ? <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">no carrossel</span> : null}
                  <span className="mt-0.5 block truncate text-[11px] text-stone-500">{f.nome}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {aviso ? <div className="fixed right-4 top-20 z-40 max-w-sm rounded-lg bg-stone-900 px-4 py-2.5 text-sm text-white shadow-lg">{aviso}</div> : null}
    </div>
  );
}
