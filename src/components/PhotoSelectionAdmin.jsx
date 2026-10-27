import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Download, Eye, Heart, KeyRound, Link2, Pencil, Plus, RefreshCw, RotateCcw, Save, Send, Trash2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/supabase";
import { buildWhatsAppLink } from "@/utils/whatsappMessages";
import { formatDateBR, makeDeliverySlug, slugify } from "@/lib/delivery";
import { listDriveImages } from "@/lib/driveList";
import { baseFileName, buildLightroomCollection, downloadTextFile } from "@/lib/lightroom";

export const SELECTION_PUBLIC_BASE = "https://orcamento.emersonhonoratoretratos.com.br/selecao/";

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const brl = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const EMPTY = {
  id: null,
  title: "",
  client_name: "",
  client_whatsapp: "",
  event_id: "",
  event_date: "",
  drive_url: "",
  included_count: "",
  extra_price: "",
  max_count: "",
  pin: "",
  expires_at: "",
  message: "",
};

export default function PhotoSelectionAdmin({ records = [] }) {
  const [items, setItems] = useState([]);
  const [state, setState] = useState("loading");
  const [apiKey, setApiKey] = useState("");
  const [keyDraft, setKeyDraft] = useState(null);
  const [showKeyHelp, setShowKeyHelp] = useState(false);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    const [{ data, error }, settingsRes] = await Promise.all([
      supabase.from("photo_selections").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("studio_settings").select("google_api_key").eq("id", 1).maybeSingle(),
    ]);
    if (error) {
      setState(/does not exist|PGRST205|42P01/i.test(`${error.code} ${error.message}`) ? "missing" : "error");
      return;
    }
    setItems(data || []);
    if (!settingsRes.error) setApiKey(settingsRes.data?.google_api_key || "");
    setState("ready");
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const agendaOptions = useMemo(
    () =>
      (records || [])
        .filter((item) => item.eventDate && item.status !== "Cancelado" && item.recordType !== "orcamento")
        .sort((a, b) => String(b.eventDate).localeCompare(String(a.eventDate)))
        .slice(0, 80),
    [records],
  );

  async function saveKey() {
    const key = String(keyDraft || "").trim();
    const { error } = await supabase.from("studio_settings").upsert({ id: 1, google_api_key: key || null, updated_at: new Date().toISOString() });
    if (error) return setMessage(`Erro ao salvar a chave: ${error.message}`);
    setApiKey(key);
    setKeyDraft(null);
    setMessage(key ? "Chave do Google salva." : "Chave removida.");
  }

  function startNew() {
    setMessage("");
    setForm({ ...EMPTY, expires_at: addDays(15) });
  }

  function startEdit(item) {
    setMessage("");
    setForm({
      ...EMPTY,
      ...Object.fromEntries(Object.entries(item).map(([k, v]) => [k, v ?? ""])),
      included_count: String(item.included_count ?? ""),
      extra_price: String(item.extra_price ?? ""),
      max_count: item.max_count ? String(item.max_count) : "",
    });
  }

  function fillFromEvent(eventId) {
    const record = agendaOptions.find((item) => String(item.id) === String(eventId));
    if (!record) return;
    setForm((current) => ({
      ...current,
      event_id: String(record.id),
      client_name: record.clientName || current.client_name,
      client_whatsapp: record.whatsapp || record.phone || current.client_whatsapp,
      event_date: record.eventDate || current.event_date,
      title: current.title || record.eventType || "Escolha das fotos",
      included_count: current.included_count || String(record.editedPhotosCount || ""),
    }));
  }

  async function save() {
    if (!form) return;
    const clean = (v) => String(v ?? "").trim();
    const num = (v) => Number(String(v ?? "").replace(",", ".")) || 0;
    if (!clean(form.client_name)) return setMessage("Informe o nome do cliente.");
    if (!clean(form.title)) return setMessage("Dê um título (ex.: Casamento Ana e Juan).");
    if (!clean(form.drive_url)) return setMessage("Cole o link da pasta do Drive com as fotos em baixa.");
    setBusy(true);
    setMessage("Lendo as fotos do Drive…");
    let photos;
    try {
      const previous = form.id ? items.find((item) => item.id === form.id) : null;
      photos = previous && previous.drive_url === clean(form.drive_url) && Array.isArray(previous.photos) && previous.photos.length
        ? previous.photos
        : await listDriveImages(clean(form.drive_url), apiKey);
    } catch (error) {
      setBusy(false);
      return setMessage(error.message);
    }
    if (!photos.length) {
      setBusy(false);
      return setMessage("Não achei fotos nessa pasta. Confira se as fotos estão direto na pasta (não em subpastas) e se ela está compartilhada.");
    }
    const payload = {
      title: clean(form.title),
      client_name: clean(form.client_name),
      client_whatsapp: clean(form.client_whatsapp) || null,
      event_id: clean(form.event_id) || null,
      event_date: form.event_date || null,
      drive_url: clean(form.drive_url),
      photos,
      included_count: Math.max(0, Math.round(num(form.included_count))),
      extra_price: Math.max(0, num(form.extra_price)),
      max_count: num(form.max_count) > 0 ? Math.round(num(form.max_count)) : null,
      pin: clean(form.pin) || null,
      expires_at: form.expires_at || null,
      message: clean(form.message) || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = form.id
      ? await supabase.from("photo_selections").update(payload).eq("id", form.id)
      : await supabase.from("photo_selections").insert({ ...payload, slug: makeDeliverySlug(payload.client_name) });
    setBusy(false);
    if (error) return setMessage(`Erro ao salvar: ${error.message}`);
    setForm(null);
    setMessage(`Seleção salva com ${photos.length} fotos. Agora é só enviar o link para o cliente.`);
    load();
  }

  async function refreshPhotos(item) {
    setBusy(true);
    setMessage("Atualizando as fotos do Drive…");
    try {
      const photos = await listDriveImages(item.drive_url, apiKey);
      const names = new Set(photos.map((p) => p.name));
      const selected = (item.selected || []).filter((name) => names.has(name));
      const { error } = await supabase.from("photo_selections").update({ photos, selected, updated_at: new Date().toISOString() }).eq("id", item.id);
      setMessage(error ? `Erro: ${error.message}` : `Galeria atualizada: ${photos.length} fotos.`);
    } catch (error) {
      setMessage(error.message);
    }
    setBusy(false);
    load();
  }

  async function reopen(item) {
    if (!window.confirm(`Liberar ${item.client_name} para mudar a escolha? As fotos já marcadas continuam marcadas.`)) return;
    await supabase.from("photo_selections").update({ status: "aberta", updated_at: new Date().toISOString() }).eq("id", item.id);
    load();
  }

  async function remove(item) {
    if (!window.confirm(`Apagar a seleção de ${item.client_name}? O link para de funcionar (as fotos no Drive continuam lá).`)) return;
    await supabase.from("photo_selections").delete().eq("id", item.id);
    load();
  }

  const linkFor = (item) => `${SELECTION_PUBLIC_BASE}${item.slug}`;

  async function copy(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 1800);
    } catch {
      window.prompt("Copie:", text);
    }
  }

  function sendLink(item) {
    const first = String(item.client_name).trim().split(/\s+/)[0];
    const total = Array.isArray(item.photos) ? item.photos.length : 0;
    const text = [
      `Olá, ${first}! 📸✨`,
      "",
      `As fotos de *${item.title}* estão prontas para você escolher as suas favoritas!`,
      "",
      `São ${total} fotos. ${item.included_count ? `Seu pacote inclui *${item.included_count} fotos*${Number(item.extra_price) ? ` e cada foto a mais custa ${brl(item.extra_price)}` : ""}.` : "Escolha quantas quiser."}`,
      "",
      "É só tocar no coração ♥ das que você mais gostar:",
      linkFor(item),
      item.pin ? `\n🔑 *Senha:* ${item.pin}` : "",
      item.expires_at ? `\n⏳ Escolha até ${formatDateBR(item.expires_at)}. A escolha fica salva sozinha, pode fazer com calma!` : "",
      "",
      "Emerson Honorato Retratos",
    ].filter((line) => line !== "").join("\n").replace(/\n{3,}/g, "\n\n");
    const url = item.client_whatsapp ? buildWhatsAppLink(item.client_whatsapp, text) : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener");
  }

  function chargeExtras(item, extras) {
    const first = String(item.client_name).trim().split(/\s+/)[0];
    const text = `Oi, ${first}! Recebi sua escolha 💛 Você escolheu ${(item.selected || []).length} fotos — ${item.included_count} do pacote + ${extras} extra${extras > 1 ? "s" : ""} (${extras} × ${brl(item.extra_price)} = *${brl(extras * Number(item.extra_price))}*). Posso te mandar o Pix?`;
    const url = item.client_whatsapp ? buildWhatsAppLink(item.client_whatsapp, text) : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener");
  }

  function downloadLightroom(item) {
    const names = (item.selected || []).slice().sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
    if (!names.length) return setMessage("Essa seleção ainda não tem fotos escolhidas.");
    const content = buildLightroomCollection(item.client_name, names);
    downloadTextFile(`selecao-${slugify(item.client_name) || "cliente"}.lrsmcol`, content);
  }

  const today = new Date().toISOString().slice(0, 10);

  if (state === "loading") return <p className="p-6 text-slate-500">Carregando seleções…</p>;
  if (state === "missing") return <p className="p-6 text-amber-700">Falta criar a tabela no Supabase (arquivo supabase/selecao.sql).</p>;
  if (state === "error") return <p className="p-6 text-red-700">Não foi possível carregar. <button type="button" className="underline" onClick={load}>Tentar de novo</button></p>;

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] bg-[#1b1610] p-6 text-white shadow-[0_22px_60px_rgba(27,22,16,0.25)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#e9c77b]">Seleção de fotos</span>
            <h2 className="mt-2 text-2xl font-semibold">O cliente escolhe as favoritas</h2>
            <p className="mt-1 max-w-xl text-sm text-white/70">
              Coloque as fotos em baixa numa pasta do Drive (compartilhada como “Qualquer pessoa com o link”), cole o link aqui e envie para o cliente. Quando ele terminar, baixe o arquivo do Lightroom com as escolhidas.
            </p>
          </div>
          <Button className="rounded-2xl bg-[#e9c77b] text-[#1b1610] hover:bg-[#f3d692]" onClick={startNew}><Plus className="mr-2 h-4 w-4" />Nova seleção</Button>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <KeyRound className="h-4 w-4 text-[#e9c77b]" />
          <span className="text-sm font-medium">Chave do Google</span>
          {keyDraft !== null ? (
            <>
              <Input className="h-9 min-w-[240px] flex-1 rounded-xl border-white/20 bg-black/20 text-white" value={keyDraft} placeholder="AIza…" onChange={(e) => setKeyDraft(e.target.value)} />
              <Button size="sm" className="rounded-xl bg-[#e9c77b] text-[#1b1610] hover:bg-[#f3d692]" onClick={saveKey}><Save className="mr-1.5 h-3.5 w-3.5" />Salvar</Button>
              <Button size="sm" variant="ghost" className="rounded-xl text-white hover:bg-white/10" onClick={() => setKeyDraft(null)}>Cancelar</Button>
            </>
          ) : (
            <>
              <span className={`min-w-0 flex-1 truncate text-xs ${apiKey ? "text-emerald-300" : "text-amber-300"}`}>{apiKey ? `Cadastrada (…${apiKey.slice(-4)})` : "Ainda não cadastrada — precisa para ler as pastas do Drive"}</span>
              <Button size="sm" variant="ghost" className="rounded-xl text-white hover:bg-white/10" onClick={() => setShowKeyHelp((v) => !v)}>Como criar</Button>
              <Button size="sm" variant="ghost" className="rounded-xl text-white hover:bg-white/10" onClick={() => setKeyDraft(apiKey)}><Pencil className="mr-1.5 h-3.5 w-3.5" />{apiKey ? "Trocar" : "Cadastrar"}</Button>
            </>
          )}
        </div>
        {showKeyHelp ? (
          <ol className="mt-3 list-decimal space-y-1.5 rounded-2xl bg-white/[0.04] p-4 pl-8 text-sm text-white/80">
            <li>Abra <strong>console.cloud.google.com</strong> com a sua conta Google e crie um projeto (ex.: “EH Estúdio”).</li>
            <li>No menu, vá em <strong>APIs e serviços → Biblioteca</strong>, procure <strong>Google Drive API</strong> e clique em <strong>Ativar</strong>.</li>
            <li>Vá em <strong>APIs e serviços → Credenciais → Criar credenciais → Chave de API</strong>.</li>
            <li>Copie a chave (começa com “AIza”) e cole aqui em <strong>Cadastrar</strong>. É grátis.</li>
          </ol>
        ) : null}
      </div>

      {message ? <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">{message}</p> : null}

      {form ? (
        <Card className="studio-panel rounded-3xl border-0 bg-white/95 shadow-sm">
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{form.id ? "Editar seleção" : "Nova seleção"}</h3>
              <button type="button" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setForm(null)}><X className="h-4 w-4" /></button>
            </div>
            {!form.id && agendaOptions.length ? (
              <div className="space-y-1">
                <Label>Puxar dados da agenda (opcional)</Label>
                <select className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm" value={form.event_id} onChange={(e) => fillFromEvent(e.target.value)}>
                  <option value="">Escolha um evento…</option>
                  {agendaOptions.map((item) => (
                    <option key={item.id} value={item.id}>{formatDateBR(item.eventDate)} — {item.clientName || "Sem nome"} — {item.eventType || "Evento"}</option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1"><Label>Nome do cliente * (vira o nome da coleção no Lightroom)</Label><Input className="rounded-2xl" placeholder="Ex.: Ana e Juan" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></div>
              <div className="space-y-1"><Label>Título *</Label><Input className="rounded-2xl" placeholder="Ex.: Casamento Ana e Juan" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="space-y-1"><Label>WhatsApp do cliente</Label><Input className="rounded-2xl" value={form.client_whatsapp} onChange={(e) => setForm({ ...form, client_whatsapp: e.target.value })} /></div>
              <div className="space-y-1"><Label>Data do evento</Label><Input type="date" className="rounded-2xl" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /></div>
            </div>
            <div className="space-y-1">
              <Label>Link da pasta do Drive com as fotos em baixa *</Label>
              <div className="flex items-center gap-2"><Link2 className="h-4 w-4 shrink-0 text-slate-400" /><Input className="rounded-2xl" placeholder="https://drive.google.com/drive/folders/..." value={form.drive_url} onChange={(e) => setForm({ ...form, drive_url: e.target.value })} /></div>
              <p className="text-xs text-slate-500">Use os mesmos nomes de arquivo do Lightroom (ex.: EME_1158.jpg). Fotos em baixa (lado maior ~1600 px) carregam rápido no celular.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1"><Label>Fotos inclusas</Label><Input type="number" min="0" className="rounded-2xl" placeholder="0 = sem limite" value={form.included_count} onChange={(e) => setForm({ ...form, included_count: e.target.value })} /></div>
              <div className="space-y-1"><Label>Foto extra (R$)</Label><Input inputMode="decimal" className="rounded-2xl" placeholder="Ex.: 12" value={form.extra_price} onChange={(e) => setForm({ ...form, extra_price: e.target.value })} /></div>
              <div className="space-y-1"><Label>Máximo (opcional)</Label><Input type="number" min="0" className="rounded-2xl" placeholder="sem máximo" value={form.max_count} onChange={(e) => setForm({ ...form, max_count: e.target.value })} /></div>
              <div className="space-y-1"><Label>Escolher até</Label><Input type="date" className="rounded-2xl" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} /></div>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <div className="space-y-1"><Label>Mensagem para o cliente</Label><Textarea className="min-h-[80px] rounded-2xl" placeholder="Ex.: Escolha as fotos que mais emocionaram vocês…" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
              <div className="space-y-1">
                <Label>Senha (opcional)</Label>
                <div className="flex gap-2">
                  <Input className="rounded-2xl" placeholder="Sem senha" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\s/g, "").slice(0, 12) })} />
                  <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setForm({ ...form, pin: String(Math.floor(1000 + Math.random() * 9000)) })}><KeyRound className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="rounded-2xl" disabled={busy} onClick={save}>{busy ? "Lendo o Drive…" : "Salvar seleção"}</Button>
              <Button variant="ghost" className="rounded-2xl" onClick={() => setForm(null)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {items.length === 0 && !form ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-10 text-center text-slate-500">Nenhuma seleção ainda. Clique em <strong>Nova seleção</strong>.</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const total = Array.isArray(item.photos) ? item.photos.length : 0;
          const count = Array.isArray(item.selected) ? item.selected.length : 0;
          const extras = item.included_count > 0 ? Math.max(0, count - item.included_count) : 0;
          const cover = Array.isArray(item.photos) && item.photos.length ? item.photos[Math.floor(item.photos.length / 3)] : null;
          const sent = item.status === "enviada";
          const expired = !sent && item.expires_at && item.expires_at < today;
          const [label, tone] = sent
            ? ["Escolha enviada ✓", "bg-emerald-100 text-emerald-800"]
            : expired
              ? ["Prazo vencido", "bg-amber-100 text-amber-800"]
              : count > 0
                ? ["Escolhendo…", "bg-sky-100 text-sky-800"]
                : item.views > 0
                  ? [`Abriu ${item.views}x`, "bg-slate-100 text-slate-700"]
                  : ["Ainda não abriu", "bg-slate-100 text-slate-600"];
          return (
            <div key={item.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="relative h-36 bg-[#1b1610]">
                {cover ? <img src={`https://drive.google.com/thumbnail?id=${cover.id}&sz=w600`} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover opacity-80" /> : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                <span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{label}</span>
                <div className="absolute bottom-3 left-4 right-4 text-white">
                  <p className="truncate text-lg font-semibold">{item.client_name}</p>
                  <p className="truncate text-xs text-white/80">{item.title}{item.event_date ? ` • ${formatDateBR(item.event_date)}` : ""}</p>
                </div>
              </div>
              <div className="space-y-3 p-4">
                <div className="flex items-center gap-2 text-sm">
                  <Heart className="h-4 w-4 text-rose-500" />
                  <span className="font-semibold">{count}</span>
                  <span className="text-slate-500">de {total} fotos{item.included_count ? ` • ${item.included_count} inclusas` : ""}</span>
                </div>
                {extras > 0 ? <p className="text-xs font-medium text-amber-700">{extras} extra{extras > 1 ? "s" : ""}{Number(item.extra_price) ? ` = ${brl(extras * Number(item.extra_price))}` : ""}</p> : null}
                {item.client_note ? <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">“{item.client_note}”</p> : null}
                <p className="text-[11px] text-slate-500">{item.pin ? `🔑 ${item.pin} • ` : ""}{item.expires_at ? `até ${formatDateBR(item.expires_at)}` : "sem prazo"}{item.submitted_at ? ` • enviada em ${new Date(item.submitted_at).toLocaleString("pt-BR")}` : ""}</p>
                <div className="flex flex-wrap gap-2">
                  {sent ? (
                    <Button size="sm" className="rounded-xl bg-[#1b1610] text-white hover:bg-[#2c241a]" onClick={() => downloadLightroom(item)}><Download className="mr-1.5 h-3.5 w-3.5" />Lightroom</Button>
                  ) : (
                    <Button size="sm" className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => sendLink(item)}><Send className="mr-1.5 h-3.5 w-3.5" />Enviar</Button>
                  )}
                  {sent && extras > 0 && Number(item.extra_price) ? (
                    <Button size="sm" variant="outline" className="rounded-xl border-amber-200 text-amber-800" onClick={() => chargeExtras(item, extras)}>Cobrar extras</Button>
                  ) : null}
                  {!sent && count > 0 ? (
                    <Button size="sm" variant="outline" className="rounded-xl" title="Baixar o que já foi escolhido até agora" onClick={() => downloadLightroom(item)}><Download className="mr-1.5 h-3.5 w-3.5" />Parcial</Button>
                  ) : null}
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => copy(linkFor(item), `l-${item.id}`)}><Copy className="mr-1.5 h-3.5 w-3.5" />{copied === `l-${item.id}` ? "Copiado!" : "Link"}</Button>
                  {count > 0 ? (
                    <Button size="sm" variant="outline" className="rounded-xl" title="Copia os nomes separados por vírgula (para colar na busca do Lightroom ou do computador)" onClick={() => copy((item.selected || []).map(baseFileName).join(", "), `n-${item.id}`)}>{copied === `n-${item.id}` ? "Copiado!" : "Nomes"}</Button>
                  ) : null}
                  <Button size="sm" variant="ghost" className="rounded-xl" title="Ver como o cliente vê" onClick={() => window.open(`${window.location.origin}/selecao/${item.slug}`, "_blank", "noopener")}><Eye className="h-3.5 w-3.5" /></Button>
                  {sent ? <Button size="sm" variant="ghost" className="rounded-xl" title="Liberar para o cliente mudar" onClick={() => reopen(item)}><RotateCcw className="h-3.5 w-3.5" /></Button> : null}
                  <Button size="sm" variant="ghost" className="rounded-xl" title="Atualizar fotos do Drive" disabled={busy} onClick={() => refreshPhotos(item)}><RefreshCw className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => startEdit(item)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="rounded-xl text-red-600" onClick={() => remove(item)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 text-sm text-slate-600">
        <p className="font-semibold text-slate-900">Como usar o arquivo no Lightroom Classic</p>
        <p className="mt-1">No módulo <strong>Biblioteca</strong>, no painel <strong>Coleções</strong>, clique no <strong>+</strong> → <strong>Importar predefinição de coleção inteligente…</strong> e escolha o arquivo baixado. A coleção aparece com o nome do cliente e as fotos escolhidas.</p>
      </div>
    </div>
  );
}
