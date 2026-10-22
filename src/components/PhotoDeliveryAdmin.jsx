import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Eye, EyeOff, ImagePlus, KeyRound, Link2, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/supabase";
import { buildWhatsAppLink } from "@/utils/whatsappMessages";
import {
  COVER_BUCKET,
  DELIVERY_PUBLIC_BASE,
  compressImage,
  driveFolderId,
  formatDateBR,
  isDriveFolder,
  makeDeliverySlug,
} from "@/lib/delivery";

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const EMPTY_FORM = {
  id: null,
  slug: "",
  title: "",
  client_name: "",
  client_whatsapp: "",
  client_email: "",
  event_id: "",
  event_date: "",
  drive_url: "",
  cover_url: "",
  cover_path: "",
  message: "",
  pin: "",
  expires_at: "",
  active: true,
};

export default function PhotoDeliveryAdmin({ records = [] }) {
  const [deliveries, setDeliveries] = useState([]);
  const [state, setState] = useState("loading");
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [copiedId, setCopiedId] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("photo_deliveries").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) {
      setState(/does not exist|PGRST205|42P01/i.test(`${error.code} ${error.message}`) ? "missing" : "error");
      return;
    }
    setDeliveries(data || []);
    setState("ready");
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Eventos da agenda (mais recentes primeiro) para preencher rápido
  const agendaOptions = useMemo(
    () =>
      (records || [])
        .filter((item) => item.eventDate && item.status !== "Cancelado")
        .sort((a, b) => String(b.eventDate).localeCompare(String(a.eventDate)))
        .slice(0, 80),
    [records],
  );

  const deliveredEventIds = useMemo(() => new Set(deliveries.map((item) => item.event_id).filter(Boolean)), [deliveries]);

  function startNew() {
    setMessage("");
    setForm({ ...EMPTY_FORM, expires_at: addDays(90) });
  }

  function startEdit(item) {
    setMessage("");
    setForm({
      ...EMPTY_FORM,
      ...Object.fromEntries(Object.entries(item).map(([key, value]) => [key, value ?? ""])),
      active: item.active !== false,
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
      client_email: record.email || current.client_email,
      event_date: record.eventDate || current.event_date,
      title: current.title || record.eventType || "Suas fotos",
    }));
  }

  async function uploadCover(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      setMessage("Escolha uma imagem (JPG ou PNG).");
      return;
    }
    setUploading(true);
    try {
      const blob = await compressImage(file);
      const path = `capas/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error } = await supabase.storage.from(COVER_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      const { data } = supabase.storage.from(COVER_BUCKET).getPublicUrl(path);
      setForm((current) => ({ ...current, cover_url: data.publicUrl, cover_path: path }));
    } catch (error) {
      setMessage(`Erro ao enviar a capa: ${error.message || error}`);
    }
    setUploading(false);
  }

  async function save() {
    if (!form) return;
    const clean = (value) => String(value || "").trim();
    if (!clean(form.client_name)) return setMessage("Informe o nome do cliente.");
    if (!clean(form.title)) return setMessage("Dê um título para a entrega (ex.: Ensaio Gestante).");
    if (!/^https:\/\/(drive|docs)\.google\.com\//.test(clean(form.drive_url)) || !driveFolderId(form.drive_url)) {
      return setMessage("Cole o link de compartilhamento da pasta do Google Drive.");
    }
    setBusy(true);
    const payload = {
      title: clean(form.title),
      client_name: clean(form.client_name),
      client_whatsapp: clean(form.client_whatsapp) || null,
      client_email: clean(form.client_email).toLowerCase() || null,
      event_id: clean(form.event_id) || null,
      event_date: form.event_date || null,
      drive_url: clean(form.drive_url),
      cover_url: form.cover_url || null,
      cover_path: form.cover_path || null,
      message: clean(form.message) || null,
      pin: clean(form.pin) || null,
      expires_at: form.expires_at || null,
      active: Boolean(form.active),
      updated_at: new Date().toISOString(),
    };
    const previous = form.id ? deliveries.find((item) => item.id === form.id) : null;
    const { error } = form.id
      ? await supabase.from("photo_deliveries").update(payload).eq("id", form.id)
      : await supabase.from("photo_deliveries").insert({ ...payload, slug: makeDeliverySlug(payload.client_name) });
    setBusy(false);
    if (error) return setMessage(`Erro ao salvar: ${error.message}`);
    if (previous?.cover_path && previous.cover_path !== payload.cover_path) {
      await supabase.storage.from(COVER_BUCKET).remove([previous.cover_path]);
    }
    setForm(null);
    setMessage(form.id ? "Entrega atualizada." : "Entrega criada! Agora é só enviar o link para o cliente.");
    load();
  }

  async function remove(item) {
    if (!window.confirm(`Apagar a entrega de ${item.client_name}? O link deixa de funcionar (as fotos no Drive continuam lá).`)) return;
    setBusy(true);
    await supabase.from("photo_deliveries").delete().eq("id", item.id);
    if (item.cover_path) await supabase.storage.from(COVER_BUCKET).remove([item.cover_path]);
    setBusy(false);
    load();
  }

  async function toggleActive(item) {
    await supabase.from("photo_deliveries").update({ active: !item.active, updated_at: new Date().toISOString() }).eq("id", item.id);
    load();
  }

  const linkFor = (item) => `${DELIVERY_PUBLIC_BASE}${item.slug}`;

  async function copyLink(item) {
    const link = linkFor(item);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(""), 1800);
    } catch {
      window.prompt("Copie o link:", link);
    }
  }

  function sendWhatsApp(item) {
    const first = String(item.client_name).trim().split(/\s+/)[0];
    const text = [
      `Olá, ${first}! 📸✨`,
      "",
      `Suas fotos (*${item.title}*) estão prontas!`,
      "",
      "Acesse sua galeria aqui:",
      linkFor(item),
      item.pin ? `\n🔑 *Senha:* ${item.pin}` : "",
      item.expires_at ? `\n⏳ Disponível para download até ${formatDateBR(item.expires_at)}. Baixe e guarde uma cópia!` : "",
      "",
      "Espero que você ame! Qualquer coisa é só me chamar. 💛",
      "Emerson Honorato Retratos",
    ].filter((line) => line !== "").join("\n").replace(/\n{3,}/g, "\n\n");
    const url = item.client_whatsapp ? buildWhatsAppLink(item.client_whatsapp, text) : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener");
  }

  const today = new Date().toISOString().slice(0, 10);
  const statusOf = (item) => {
    if (!item.active) return ["Desativada", "bg-slate-100 text-slate-600"];
    if (item.expires_at && item.expires_at < today) return ["Expirada", "bg-amber-100 text-amber-800"];
    if (item.views > 0) return [`Visto ${item.views}x`, "bg-emerald-100 text-emerald-800"];
    return ["Ainda não abriu", "bg-sky-100 text-sky-800"];
  };

  if (state === "loading") return <p className="p-6 text-slate-500">Carregando entregas…</p>;
  if (state === "missing") return <p className="p-6 text-amber-700">Falta criar a tabela no Supabase (arquivo supabase/entregas.sql).</p>;
  if (state === "error") return <p className="p-6 text-red-700">Não foi possível carregar as entregas. <button type="button" className="underline" onClick={load}>Tentar de novo</button></p>;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[32px] bg-[#1b1610] p-6 text-white shadow-[0_22px_60px_rgba(27,22,16,0.25)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#e9c77b]">Entrega de fotos</span>
            <h2 className="mt-2 text-2xl font-semibold">Galerias dos clientes</h2>
            <p className="mt-1 max-w-xl text-sm text-white/70">
              Suba as fotos numa pasta do Google Drive, compartilhe como “Qualquer pessoa com o link” e cole o link aqui. O cliente recebe uma página bonita com a galeria e o botão de baixar.
            </p>
          </div>
          <Button className="rounded-2xl bg-[#e9c77b] text-[#1b1610] hover:bg-[#f3d692]" onClick={startNew}><Plus className="mr-2 h-4 w-4" />Nova entrega</Button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ["Entregas", deliveries.length],
            ["Já abriram", deliveries.filter((item) => item.views > 0).length],
            ["Aguardando", deliveries.filter((item) => item.active && !item.views).length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">{label}</p>
              <p className="mt-1 text-xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {message ? <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">{message}</p> : null}

      {form ? (
        <Card className="studio-panel rounded-3xl border-0 bg-white/95 shadow-sm">
          <CardContent className="space-y-5 pt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{form.id ? "Editar entrega" : "Nova entrega"}</h3>
              <button type="button" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setForm(null)}><X className="h-4 w-4" /></button>
            </div>

            {!form.id && agendaOptions.length ? (
              <div className="space-y-1">
                <Label>Puxar dados da agenda (opcional)</Label>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                  value={form.event_id}
                  onChange={(e) => fillFromEvent(e.target.value)}
                >
                  <option value="">Escolha um evento…</option>
                  {agendaOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {formatDateBR(item.eventDate)} — {item.clientName || "Sem nome"} — {item.eventType || "Evento"}{deliveredEventIds.has(String(item.id)) ? " (já entregue)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1"><Label>Nome do cliente *</Label><Input className="rounded-2xl" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></div>
              <div className="space-y-1"><Label>Título *</Label><Input className="rounded-2xl" placeholder="Ex.: Ensaio Gestante, Casamento Ana & João" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="space-y-1"><Label>WhatsApp do cliente</Label><Input className="rounded-2xl" placeholder="(48) 99999-9999" value={form.client_whatsapp} onChange={(e) => setForm({ ...form, client_whatsapp: e.target.value })} /></div>
              <div className="space-y-1"><Label>Data do evento</Label><Input type="date" className="rounded-2xl" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /></div>
            </div>

            <div className="space-y-1">
              <Label>Link da pasta no Google Drive *</Label>
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 shrink-0 text-slate-400" />
                <Input className="rounded-2xl" placeholder="https://drive.google.com/drive/folders/..." value={form.drive_url} onChange={(e) => setForm({ ...form, drive_url: e.target.value })} />
              </div>
              <p className={`text-xs ${form.drive_url && !isDriveFolder(form.drive_url) ? "text-amber-700" : "text-slate-500"}`}>
                {form.drive_url && !isDriveFolder(form.drive_url)
                  ? "Esse link não parece ser de uma pasta. Funciona, mas a galeria embutida só aparece com link de pasta."
                  : "No Drive: botão direito na pasta → Compartilhar → Acesso geral: “Qualquer pessoa com o link” → Copiar link."}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <div className="space-y-2">
                <Label>Foto de capa</Label>
                <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50">
                  {form.cover_url ? (
                    <>
                      <img src={form.cover_url} alt="Capa" className="h-full w-full object-cover" />
                      <button type="button" title="Remover capa" className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white" onClick={() => setForm({ ...form, cover_url: "", cover_path: "" })}><X className="h-3.5 w-3.5" /></button>
                    </>
                  ) : (
                    <label className="flex h-full cursor-pointer flex-col items-center justify-center gap-2 text-center text-sm text-slate-500 hover:bg-slate-100">
                      <ImagePlus className="h-6 w-6" />
                      {uploading ? "Enviando…" : "Escolher a melhor foto"}
                      <input type="file" accept="image/*" className="hidden" onChange={uploadCover} />
                    </label>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">A foto é reduzida automaticamente para abrir rápido no celular.</p>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Mensagem para o cliente</Label>
                  <Textarea className="min-h-[120px] rounded-2xl" placeholder="Foi um prazer registrar esse momento…" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Senha (opcional)</Label>
                    <div className="flex gap-2">
                      <Input className="rounded-2xl" placeholder="Sem senha" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\s/g, "").slice(0, 12) })} />
                      <Button type="button" variant="outline" className="rounded-2xl" title="Gerar senha" onClick={() => setForm({ ...form, pin: String(Math.floor(1000 + Math.random() * 9000)) })}><KeyRound className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Disponível até</Label>
                    <Input type="date" className="rounded-2xl" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                  Link ativo
                </label>
              </div>
            </div>

            <div className="flex gap-2">
              <Button className="rounded-2xl" disabled={busy || uploading} onClick={save}>{busy ? "Salvando…" : "Salvar entrega"}</Button>
              <Button variant="ghost" className="rounded-2xl" onClick={() => setForm(null)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {deliveries.length === 0 && !form ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-10 text-center text-slate-500">
          Nenhuma entrega ainda. Clique em <strong>Nova entrega</strong> para criar a primeira.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {deliveries.map((item) => {
          const [label, tone] = statusOf(item);
          return (
            <div key={item.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="relative h-40 bg-[#1b1610]">
                {item.cover_url ? <img src={item.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{label}</span>
                <div className="absolute bottom-3 left-4 right-4 text-white">
                  <p className="truncate text-lg font-semibold">{item.client_name}</p>
                  <p className="truncate text-xs text-white/80">{item.title}{item.event_date ? ` • ${formatDateBR(item.event_date)}` : ""}</p>
                </div>
              </div>
              <div className="space-y-3 p-4">
                <p className="text-xs text-slate-500">
                  {item.pin ? `🔑 Senha ${item.pin} • ` : ""}
                  {item.expires_at ? `até ${formatDateBR(item.expires_at)}` : "sem prazo"}
                  {item.last_viewed_at ? ` • última visita ${new Date(item.last_viewed_at).toLocaleDateString("pt-BR")}` : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => sendWhatsApp(item)}><Send className="mr-1.5 h-3.5 w-3.5" />Enviar</Button>
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => copyLink(item)}><Copy className="mr-1.5 h-3.5 w-3.5" />{copiedId === item.id ? "Copiado!" : "Link"}</Button>
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => window.open(linkFor(item).replace(DELIVERY_PUBLIC_BASE, `${window.location.origin}/entrega/`), "_blank", "noopener")}><Eye className="mr-1.5 h-3.5 w-3.5" />Ver</Button>
                  <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => startEdit(item)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="rounded-xl" title={item.active ? "Desativar link" : "Ativar link"} onClick={() => toggleActive(item)}>{item.active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
                  <Button size="sm" variant="ghost" className="rounded-xl text-red-600" disabled={busy} onClick={() => remove(item)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
