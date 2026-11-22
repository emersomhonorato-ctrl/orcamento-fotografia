import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { ArrowDown, ArrowUp, BookOpen, Check, Copy, Link2, MessageCircle, Plus, RefreshCw, Save, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/supabase";
import { makeDeliverySlug } from "@/lib/delivery";
import { openExternal } from "@/lib/openExternal";
import { buildWhatsAppLink } from "@/utils/whatsappMessages";
import { LAYOUTS, SIZES, diagramar, mudarLayout, pageH, quantas } from "@/lib/album/layout";
import { albumThumb, listDrivePhotosWithSize } from "@/lib/album/drive";

// Aceita o link da pasta do Drive, o link da entrega (/entrega/…) ou da seleção (/selecao/…)
async function resolverPasta(link) {
  const entrega = link.match(/\/entrega\/([a-z0-9-]{4,80})/i);
  if (entrega) {
    const { data } = await supabase.from("photo_deliveries").select("drive_url").eq("slug", entrega[1].toLowerCase()).maybeSingle();
    if (!data?.drive_url) throw new Error("Não achei essa entrega. Confira o link.");
    return data.drive_url;
  }
  const selecao = link.match(/\/selecao\/([a-z0-9-]{4,80})/i);
  if (selecao) {
    const { data } = await supabase.from("photo_selections").select("drive_url, final_drive_url").eq("slug", selecao[1].toLowerCase()).maybeSingle();
    const url = data?.final_drive_url || data?.drive_url;
    if (!url) throw new Error("Não achei essa seleção. Confira o link.");
    return url;
  }
  return link;
}
import ClientPicker from "@/components/ClientPicker";
import AlbumSpread from "@/components/album/AlbumSpread";

// Diagramação de álbuns: monta as lâminas com as fotos tratadas do Drive e manda para o cliente aprovar
const PUBLIC_BASE = "https://orcamento.emersonhonoratoretratos.com.br/album/";
const STATUS = {
  rascunho: ["Rascunho", "bg-stone-100 text-stone-700"],
  enviado: ["Com o cliente", "bg-sky-50 text-sky-800"],
  ajustes: ["Pediu ajustes", "bg-amber-50 text-amber-800"],
  aprovado: ["Aprovado", "bg-emerald-50 text-emerald-800"],
};

function Novo({ clients, onCriado, onCancel }) {
  const [clientId, setClientId] = useState("");
  const [nome, setNome] = useState("");
  const [titulo, setTitulo] = useState("");
  const [drive, setDrive] = useState("");
  const [size, setSize] = useState("30x30");
  const [laminas, setLaminas] = useState(15);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const cliente = clients.find((c) => c.id === clientId);

  // Entregas do cliente escolhido: dá para montar o álbum com as fotos já entregues, sem procurar o link do Drive
  const [entregas, setEntregas] = useState([]);
  useEffect(() => {
    const alvo = (cliente?.name || "").trim();
    if (!alvo) return;
    let vivo = true;
    supabase
      .from("photo_deliveries")
      .select("slug, title, client_name, drive_url, created_at")
      .ilike("client_name", `%${alvo.split(/\s+/)[0]}%`)
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data }) => { if (vivo) setEntregas((data || []).filter((e) => e.drive_url)); });
    return () => { vivo = false; };
  }, [cliente?.name]);

  async function criar() {
    const clientName = (cliente?.name || nome).trim();
    if (!clientName) return setMsg("Escolha o cliente ou escreva o nome.");
    if (!drive.trim()) return setMsg("Cole o link da pasta do Drive com as fotos tratadas.");
    setBusy(true);
    setMsg("Lendo as fotos da pasta…");
    try {
      const { data: cfg } = await supabase.from("studio_settings").select("google_api_key").eq("id", 1).maybeSingle();
      const pasta = await resolverPasta(drive.trim());
      const fotos = await listDrivePhotosWithSize(pasta, cfg?.google_api_key || "");
      if (!fotos.length) throw new Error("Não achei fotos nessa pasta.");
      setMsg(`Montando ${laminas} lâminas com ${fotos.length} fotos…`);
      const { data, error } = await supabase
        .from("photo_albums")
        .insert({
          slug: makeDeliverySlug(clientName),
          title: titulo.trim() || `Álbum ${clientName}`,
          client_name: clientName,
          client_whatsapp: cliente?.whatsapp || cliente?.phone || null,
          drive_url: pasta,
          photos: fotos,
          size,
          spreads: diagramar(fotos, laminas, size),
        })
        .select()
        .single();
      if (error) throw error;
      onCriado(data);
    } catch (erro) {
      setMsg(erro.message || "Não consegui criar o álbum.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-stone-900">Novo álbum</h3>
        <button type="button" onClick={onCancel} className="rounded-full p-1.5 hover:bg-stone-100" aria-label="Fechar"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5 text-xs text-stone-500">Cliente
          <ClientPicker clients={clients} value={clientId} onChange={setClientId} />
          {!clientId ? <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ou escreva o nome" className="mt-1.5 block h-10 w-full rounded-2xl border border-stone-300 px-3 text-sm text-stone-900" /> : null}
        </label>
        <label className="space-y-1.5 text-xs text-stone-500">Título (aparece para o cliente)
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Álbum do casamento Ana & Juan" className="block h-10 w-full rounded-2xl border border-stone-300 px-3 text-sm text-stone-900" />
        </label>
        <label className="space-y-1.5 text-xs text-stone-500 md:col-span-2">Fotos tratadas — link da pasta do Drive ou da entrega do cliente
          <input value={drive} onChange={(e) => setDrive(e.target.value)} placeholder="Link da pasta do Drive, da entrega (/entrega/…) ou da seleção (/selecao/…)" className="block h-10 w-full rounded-2xl border border-stone-300 px-3 text-sm text-stone-900" />
          {clientId && entregas.length ? (
            <span className="flex flex-wrap items-center gap-1.5 pt-1">
              <span>Usar as fotos de:</span>
              {entregas.map((e) => (
                <button key={e.slug} type="button" onClick={() => setDrive(e.drive_url)} className={`rounded-full border px-2.5 py-1 text-xs ${drive === e.drive_url ? "border-[#7f274f] bg-[#7f274f] text-white" : "border-stone-300 text-stone-700 hover:bg-stone-50"}`}>
                  📦 {e.title || e.client_name}
                </button>
              ))}
            </span>
          ) : null}
        </label>
        <label className="space-y-1.5 text-xs text-stone-500">Formato
          <select value={size} onChange={(e) => setSize(e.target.value)} className="block h-10 w-full rounded-2xl border border-stone-300 bg-white px-3 text-sm text-stone-900">
            {Object.entries(SIZES).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
          </select>
        </label>
        <label className="space-y-1.5 text-xs text-stone-500">Lâminas
          <div className="flex items-center gap-3">
            <input type="range" min={5} max={40} value={laminas} onChange={(e) => setLaminas(+e.target.value)} className="flex-1 accent-[#7f274f]" />
            <b className="w-8 text-right text-sm text-stone-900">{laminas}</b>
          </div>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button className="rounded-2xl bg-[#7f274f] hover:bg-[#692040]" disabled={busy} onClick={criar}><BookOpen className="mr-2 h-4 w-4" />Montar álbum</Button>
        {msg ? <span className="text-sm text-stone-600">{msg}</span> : null}
      </div>
    </div>
  );
}

function Editor({ album: inicial, onVoltar, onSalvo }) {
  const [album] = useState(() => structuredClone(inicial));
  const [, redesenhar] = useReducer((n) => n + 1, 0);
  const [alterado, setAlterado] = useState(false);
  const [escolha, setEscolha] = useState(null); // { lamina, slot }
  const [busy, setBusy] = useState("");
  const [aviso, setAviso] = useState("");
  const [largura, setLargura] = useState(640);
  const fotosPorId = useMemo(() => new Map((album.photos || []).map((f) => [f.id, f])), [album.photos]);
  const usadas = new Set(album.spreads.flatMap((l) => l.slots.map((s) => s.photo)));
  const link = `${PUBLIC_BASE}${album.slug}`;
  const H = pageH(album.size);

  useEffect(() => {
    const ajustar = () => setLargura(Math.min(760, Math.max(300, window.innerWidth - (window.innerWidth >= 768 ? 360 : 48))));
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, []);

  const mudou = useCallback(() => {
    setAlterado(true);
    redesenhar();
  }, []);

  async function salvar(extra = {}) {
    setBusy("Salvando…");
    const { data, error } = await supabase
      .from("photo_albums")
      .update({ spreads: album.spreads, title: album.title, message: album.message, updated_at: new Date().toISOString(), ...extra })
      .eq("id", album.id)
      .select()
      .single();
    setBusy("");
    if (error) {
      setAviso(`Não salvou: ${error.message}`);
      return null;
    }
    Object.assign(album, data);
    setAlterado(false);
    onSalvo?.(data);
    return data;
  }

  async function enviar() {
    // ao reenviar: mantém as lâminas aprovadas e limpa os pedidos de troca (que já foram ajustados)
    const feedback = Object.fromEntries(Object.entries(album.feedback || {}).filter(([, v]) => v?.ok === true));
    const reenviando = album.status !== "rascunho";
    const salvo = await salvar({ status: "enviado", sent_at: new Date().toISOString(), feedback, version: reenviando ? (album.version || 1) + 1 : album.version || 1 });
    if (!salvo) return;
    const primeiro = String(album.client_name || "").split(" ")[0];
    const texto = reenviando
      ? `Oi${primeiro ? `, ${primeiro}` : ""}! Fiz os ajustes que você pediu no seu álbum 📖✨\nDá uma olhada na nova versão e me diz se ficou do jeito que você queria:\n${link}`
      : `Oi${primeiro ? `, ${primeiro}` : ""}! Seu álbum está diagramado 📖✨\nVeja lâmina por lâmina e aprove ou me diga o que quer trocar:\n${link}\n\nDica: toque e segure em cada lâmina para ver nítido.`;
    openExternal(album.client_whatsapp ? buildWhatsAppLink(album.client_whatsapp, texto) : `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`);
    setAviso("Enviado! O cliente já pode ver e aprovar.");
  }

  function editar(fn) {
    fn(album);
    mudou();
  }

  function mover(i, d) {
    const j = i + d;
    if (j < 0 || j >= album.spreads.length) return;
    editar((a) => {
      const lista = a.spreads;
      const tmp = lista[i];
      lista[i] = lista[j];
      lista[j] = tmp;
    });
  }

  const fb = album.feedback || {};
  const pedidos = Object.values(fb).filter((v) => v?.ok === false).length;
  const ok = Object.values(fb).filter((v) => v?.ok === true).length;

  return (
    <div className="space-y-5 pb-24">
      <div className="sticky top-0 z-20 -mx-2 flex flex-wrap items-center gap-2 border-b border-stone-200 bg-[#f6f4ef]/95 px-3 py-2 backdrop-blur">
        <Button variant="outline" className="rounded-xl" onClick={() => (!alterado || confirm("Sair sem salvar?")) && onVoltar()}>← Álbuns</Button>
        <input value={album.title} onChange={(e) => editar((a) => { a.title = e.target.value; })} className="h-9 min-w-[12rem] flex-1 rounded-lg border border-stone-300 bg-white px-2 text-sm" />
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[album.status]?.[1]}`}>{STATUS[album.status]?.[0]}{album.version > 1 ? ` • v${album.version}` : ""}</span>
        <Button variant="outline" className="rounded-xl" disabled={Boolean(busy)} onClick={() => salvar()}><Save className="mr-2 h-4 w-4" />{busy || (alterado ? "Salvar •" : "Salvar")}</Button>
        <Button className="rounded-xl bg-[#7f274f] hover:bg-[#692040]" disabled={Boolean(busy)} onClick={enviar}><Send className="mr-2 h-4 w-4" />{album.status === "rascunho" ? "Enviar ao cliente" : "Reenviar"}</Button>
        {album.status !== "rascunho" ? (
          <Button variant="outline" className="rounded-xl" onClick={() => navigator.clipboard?.writeText(link).then(() => setAviso("Link copiado."))}><Copy className="mr-2 h-4 w-4" />Link</Button>
        ) : null}
      </div>

      {album.status !== "rascunho" ? (
        <p className="text-sm text-stone-600">
          {ok} de {album.spreads.length} lâminas aprovadas{pedidos ? ` • ${pedidos} com pedido de troca` : ""}{album.approved_at ? " • álbum aprovado ✅" : ""}
        </p>
      ) : (
        <p className="text-sm text-stone-500">Arraste a foto para enquadrar, clique para trocar, mude o modelo da lâmina e a ordem pelas setas. Depois clique em <b>Enviar ao cliente</b>.</p>
      )}

      <label className="block max-w-2xl space-y-1 text-xs text-stone-500">Recado para o cliente (aparece no topo da página)
        <textarea value={album.message || ""} onChange={(e) => editar((a) => { a.message = e.target.value; })} rows={2} className="block w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900" placeholder="Ex.: Escolhi as fotos que contam melhor a história do dia. Qualquer troca é só pedir!" />
      </label>

      <div className="space-y-6">
        {album.spreads.map((lamina, i) => {
          const f = fb[i];
          return (
            <div key={i} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <b className="text-stone-800">Lâmina {i + 1}</b>
                <select
                  value={lamina.layout}
                  onChange={(e) => editar((a) => { a.spreads[i] = mudarLayout(lamina, e.target.value, a.size); })}
                  className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs"
                >
                  {Object.entries(LAYOUTS).map(([v, l]) => <option key={v} value={v}>{l.nome} ({quantas(v, H)})</option>)}
                </select>
                <button type="button" title="Subir" onClick={() => mover(i, -1)} className="rounded-md p-1 hover:bg-stone-200"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" title="Descer" onClick={() => mover(i, 1)} className="rounded-md p-1 hover:bg-stone-200"><ArrowDown className="h-4 w-4" /></button>
                <button type="button" title="Apagar lâmina" onClick={() => { if (confirm(`Apagar a lâmina ${i + 1}?`)) editar((a) => { a.spreads.splice(i, 1); }); }} className="rounded-md p-1 text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                {f?.ok === true ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800"><Check className="mr-1 inline h-3 w-3" />aprovada</span> : null}
                {f?.ok === false ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">pediu troca</span> : null}
              </div>
              {f?.ok === false && f?.note ? <p className="max-w-3xl rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">💬 “{f.note}”</p> : null}
              <AlbumSpread
                lamina={lamina}
                size={album.size}
                fotosPorId={fotosPorId}
                largura={largura}
                editavel
                selecionado={escolha?.lamina === i ? escolha.slot : null}
                onSlotClick={(slot) => setEscolha({ lamina: i, slot })}
                onMudou={mudou}
              />
            </div>
          );
        })}
        <Button
          variant="outline"
          className="rounded-2xl"
          onClick={() => editar((a) => { a.spreads.push({ layout: "uma|uma", slots: [{ photo: "", ox: 0.5, oy: 0.5 }, { photo: "", ox: 0.5, oy: 0.5 }] }); })}
        >
          <Plus className="mr-2 h-4 w-4" />Nova lâmina
        </Button>
      </div>

      {escolha ? (
        <div className="fixed inset-0 z-50 overflow-auto bg-black/55 p-4" onClick={() => setEscolha(null)}>
          <div className="mx-auto max-w-5xl rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Escolha a foto (lâmina {escolha.lamina + 1})</h3>
              <div className="flex items-center gap-2">
                <button type="button" className="text-xs text-red-700 underline" onClick={() => { const { lamina: l, slot: sl } = escolha; setEscolha(null); editar((a) => { a.spreads[l].slots[sl] = { photo: "", ox: 0.5, oy: 0.5 }; }); }}>Deixar vazio</button>
                <button type="button" onClick={() => setEscolha(null)} className="rounded-full p-1.5 hover:bg-stone-100" aria-label="Fechar"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
              {album.photos.map((foto) => (
                <button
                  key={foto.id}
                  type="button"
                  className="relative text-left hover:outline hover:outline-2 hover:outline-[#7f274f]"
                  onClick={() => {
                    const { lamina: l, slot: sl } = escolha;
                    setEscolha(null);
                    editar((a) => { a.spreads[l].slots[sl] = { photo: foto.id, ox: 0.5, oy: 0.5 }; });
                  }}
                >
                  <img src={albumThumb(foto.id, 300)} alt="" loading="lazy" referrerPolicy="no-referrer" className="block h-32 w-full rounded bg-stone-200 object-cover" />
                  {usadas.has(foto.id) ? <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">no álbum</span> : null}
                  <span className="block truncate text-[11px] text-stone-500">{foto.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {aviso ? (
        <button type="button" onClick={() => setAviso("")} className="fixed right-4 top-20 z-40 max-w-sm rounded-lg bg-stone-900 px-4 py-2.5 text-left text-sm text-white shadow-lg">{aviso}</button>
      ) : null}
    </div>
  );
}

export default function AlbumsPanel({ clients = [] }) {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [novo, setNovo] = useState(false);
  const [aberto, setAberto] = useState(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase.from("photo_albums").select("*").order("updated_at", { ascending: false });
    setCarregando(false);
    if (error) setErro(/relation|does not exist/i.test(error.message) ? "A tabela de álbuns ainda não foi criada no banco." : error.message);
    else setLista(data || []);
  }, []);

  useEffect(() => {
    let ativo = true;
    supabase
      .from("photo_albums")
      .select("*")
      .order("updated_at", { ascending: false })
      .then(({ data, error }) => {
        if (!ativo) return;
        setCarregando(false);
        if (error) setErro(/relation|does not exist/i.test(error.message) ? "A tabela de álbuns ainda não foi criada no banco." : error.message);
        else setLista(data || []);
      });
    return () => {
      ativo = false;
    };
  }, []);

  if (aberto) {
    return <Editor album={aberto} onVoltar={() => { setAberto(null); carregar(); }} onSalvo={(a) => setLista((l) => l.map((x) => (x.id === a.id ? a : x)))} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h2 className="text-xl font-semibold text-stone-900">Álbuns</h2>
          <p className="text-sm text-stone-500">Diagrame com as fotos tratadas e mande o link para o cliente aprovar lâmina por lâmina.</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" className="rounded-2xl" onClick={carregar}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
          <Button className="rounded-2xl bg-[#7f274f] hover:bg-[#692040]" onClick={() => setNovo(true)}><Plus className="mr-2 h-4 w-4" />Novo álbum</Button>
        </div>
      </div>
      {novo ? <Novo clients={clients} onCancel={() => setNovo(false)} onCriado={(a) => { setNovo(false); setLista((l) => [a, ...l]); setAberto(a); }} /> : null}
      {erro ? <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">{erro}</p> : null}
      {carregando ? <p className="text-sm text-stone-500">Carregando…</p> : null}
      {!carregando && !lista.length && !erro ? <p className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">Nenhum álbum ainda. Clique em <b>Novo álbum</b>.</p> : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {lista.map((a) => {
          const fb = a.feedback || {};
          const ok = Object.values(fb).filter((v) => v?.ok === true).length;
          const pedidos = Object.values(fb).filter((v) => v?.ok === false).length;
          const capa = a.spreads?.[0]?.slots?.find((s) => s.photo)?.photo;
          return (
            <button key={a.id} type="button" onClick={() => setAberto(a)} className="overflow-hidden rounded-2xl border border-stone-200 bg-white text-left transition hover:shadow-md">
              <div className="aspect-[2/1] bg-stone-200">
                {capa ? <img src={albumThumb(capa, 600)} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="space-y-1.5 p-3">
                <div className="flex items-center gap-2">
                  <b className="min-w-0 flex-1 truncate text-sm text-stone-900">{a.title}</b>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[a.status]?.[1]}`}>{STATUS[a.status]?.[0]}</span>
                </div>
                <p className="text-xs text-stone-500">
                  {a.client_name} • {a.spreads?.length || 0} lâminas • {a.size}
                  {a.status !== "rascunho" ? ` • ${ok} aprovadas${pedidos ? `, ${pedidos} trocas` : ""}` : ""}
                </p>
                {a.status !== "rascunho" ? (
                  <span className="inline-flex gap-3 text-xs text-stone-500">
                    <span><Link2 className="mr-1 inline h-3 w-3" />/album/{a.slug}</span>
                    {a.views ? <span><MessageCircle className="mr-1 inline h-3 w-3" />{a.views} visitas</span> : null}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
