import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, BadgeCheck, CalendarPlus, Copy, ExternalLink, FileText, FileUp, Pencil, Plus, RefreshCw, RotateCcw, Save, Send, Trash2, Undo2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/supabase";
import {
  BOOKING_CAMPAIGN_ID,
  buildSlotTimes,
  capitalize,
  dayMonthLabel,
  formatBRL,
  fullDateLabel,
  groupSlotsByDay,
  localDateKey,
  localTime,
  weekdayLabel,
  fetchAllRows,
  themeEmoji,
  bookingTotal,
} from "@/lib/bookings";
import { buildWhatsAppLink, buildWhatsAppShareLink } from "@/utils/whatsappMessages";
import { buildPixPayload } from "@/lib/pix";

export const CHRISTMAS_PUBLIC_URL = "https://orcamento.emersonhonoratoretratos.com.br/ensaio";
const PDF_BUCKET = "ensaios";


const WEEKDAYS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

export default function ChristmasBookingAdmin({ onBookingsLoaded, onBookingCanceled }) {
  const [campaign, setCampaign] = useState(null);
  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [state, setState] = useState("loading");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pixForm, setPixForm] = useState(null);
  const [infoForm, setInfoForm] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [generator, setGenerator] = useState({
    startDate: "2026-11-01",
    endDate: "2026-12-23",
    weekdays: [6],
    startTime: "09:00",
    endTime: "18:00",
    breakStart: "12:00",
    breakEnd: "13:30",
  });

  const load = useCallback(async () => {
    const [campaignRes, slotRes, bookingRes] = await Promise.all([
      supabase.from("booking_campaigns").select("*").eq("id", BOOKING_CAMPAIGN_ID).maybeSingle(),
      fetchAllRows(() => supabase.from("booking_slots").select("id, starts_at, status").eq("campaign_id", BOOKING_CAMPAIGN_ID).order("starts_at")),
      fetchAllRows(() => supabase.from("bookings").select("*").eq("campaign_id", BOOKING_CAMPAIGN_ID).order("starts_at")),
    ]);
    const missing = [campaignRes, slotRes, bookingRes].some((res) => res.error && /could not find|does not exist|PGRST205|42P01/i.test(`${res.error.code} ${res.error.message}`));
    if (missing) {
      setState("missing");
      return;
    }
    if (campaignRes.error || slotRes.error || bookingRes.error) {
      setState("error");
      return;
    }
    setCampaign(campaignRes.data);
    setSlots(slotRes.data || []);
    setBookings(bookingRes.data || []);
    setState("ready");
    onBookingsLoaded?.(bookingRes.data || [], campaignRes.data);
  }, [onBookingsLoaded]);

  useEffect(() => {
    // carrega ao abrir a aba
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const bookingBySlot = useMemo(() => {
    const map = new Map();
    bookings.filter((booking) => booking.status !== "cancelado").forEach((booking) => map.set(booking.slot_id, booking));
    return map;
  }, [bookings]);

  const days = useMemo(() => Array.from(groupSlotsByDay(slots).entries()), [slots]);
  const totals = useMemo(() => {
    const confirmed = bookings.filter((booking) => booking.status === "confirmado");
    const awaiting = bookings.filter((booking) => booking.status === "aguardando_sinal");
    return {
      free: slots.filter((slot) => slot.status === "livre").length,
      booked: confirmed.length,
      awaiting: awaiting.length,
      revenue: confirmed.reduce((sum, booking) => sum + bookingTotal(booking), 0),
      deposits: confirmed.reduce((sum, booking) => sum + Number(booking.deposit_amount || 0), 0),
    };
  }, [slots, bookings]);

  const previewCount = useMemo(
    () => buildSlotTimes({ ...generator, slotMinutes: campaign?.slot_minutes || 30 }).length,
    [generator, campaign],
  );

  async function generateSlots() {
    const times = buildSlotTimes({ ...generator, slotMinutes: campaign?.slot_minutes || 30 });
    if (!times.length) {
      setMessage("Nenhum horário gerado. Confira os dias da semana e os horários.");
      return;
    }
    setBusy(true);
    setMessage("");
    const rows = times.map((startsAt) => ({ campaign_id: BOOKING_CAMPAIGN_ID, starts_at: startsAt }));
    let created = 0;
    for (let index = 0; index < rows.length; index += 300) {
      const chunk = rows.slice(index, index + 300);
      const { data, error } = await supabase
        .from("booking_slots")
        .upsert(chunk, { onConflict: "campaign_id,starts_at", ignoreDuplicates: true })
        .select("id");
      if (error) {
        setBusy(false);
        setMessage(`Erro ao criar horários: ${error.message}`);
        return;
      }
      created += data?.length || 0;
    }
    setBusy(false);
    setMessage(`${created} horário(s) novo(s) criado(s). Os que já existiam foram mantidos.`);
    load();
  }

  async function setSlotStatus(slot, status) {
    setBusy(true);
    await supabase.from("booking_slots").update({ status }).eq("id", slot.id);
    setBusy(false);
    load();
  }

  async function removeFreeSlotsOfDay(daySlots) {
    const ids = daySlots.filter((slot) => slot.status !== "reservado").map((slot) => slot.id);
    if (!ids.length) return;
    if (!window.confirm(`Remover ${ids.length} horário(s) livre(s)/bloqueado(s) deste dia? Reservas não são afetadas.`)) return;
    setBusy(true);
    await supabase.from("booking_slots").delete().in("id", ids);
    setBusy(false);
    load();
  }

  async function cancelBooking(booking) {
    if (!window.confirm(`Cancelar a reserva de ${booking.name}? O horário volta a ficar livre.`)) return;
    setBusy(true);
    await supabase.from("bookings").update({ status: "cancelado" }).eq("id", booking.id);
    await supabase.from("booking_slots").update({ status: "livre" }).eq("id", booking.slot_id);
    setBusy(false);
    onBookingCanceled?.(booking);
    load();
  }

  async function markDepositReceived(booking) {
    if (!window.confirm(`Confirmar que o ${booking.payment_choice === "total" ? "pagamento" : "sinal"} de ${formatBRL(booking.deposit_amount)} de ${booking.name} foi recebido?`)) return;
    setBusy(true);
    await supabase.from("bookings").update({ status: "confirmado", paid_at: new Date().toISOString() }).eq("id", booking.id);
    setBusy(false);
    load();
  }

  function pixFor(booking) {
    if (!campaign?.pix_key || !Number(booking.deposit_amount)) return "";
    return buildPixPayload({
      key: campaign.pix_key,
      name: campaign.pix_name || "Emerson Honorato Retratos",
      city: campaign.pix_city || "Sideropolis",
      amount: Number(booking.deposit_amount),
      txid: `NATAL${String(booking.id).replace(/-/g, "").slice(0, 12)}`,
    });
  }

  async function savePix() {
    if (!pixForm) return;
    setBusy(true);
    const { error } = await supabase
      .from("booking_campaigns")
      .update({
        pix_key: pixForm.pix_key.trim(),
        pix_name: pixForm.pix_name.trim(),
        pix_city: pixForm.pix_city.trim(),
        deposit_percent: Math.min(100, Math.max(0, Number(pixForm.deposit_percent || 0))),
      })
      .eq("id", BOOKING_CAMPAIGN_ID);
    setBusy(false);
    setMessage(error ? `Erro ao salvar Pix: ${error.message}` : "Dados do Pix salvos. Valem para as próximas reservas.");
    setPixForm(null);
    load();
  }

  function startEditInfo() {
    setInfoForm({
      title: campaign?.title || "",
      subtitle: campaign?.subtitle || "",
      location: campaign?.location || "",
      studio_whatsapp: campaign?.studio_whatsapp || "",
      slot_minutes: String(campaign?.slot_minutes ?? 30),
      extra_photo_price: String(campaign?.extra_photo_price ?? 0),
      extra_person_price: String(campaign?.extra_person_price ?? 0),
      max_extra_people: String(campaign?.max_extra_people ?? 5),
      allow_full_payment: campaign?.allow_full_payment !== false,
      start_date: campaign?.start_date || "",
      end_date: campaign?.end_date || "",
      packages: (Array.isArray(campaign?.packages) ? campaign.packages : []).map((item) => ({
        name: item.name || "",
        photos: String(item.photos ?? ""),
        price: String(item.price ?? ""),
      })),
    });
  }

  function updatePackage(index, field, value) {
    setInfoForm((current) => ({
      ...current,
      packages: current.packages.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }));
  }

  async function saveInfo() {
    if (!infoForm) return;
    const toNumber = (value) => Number(String(value).replace(",", ".")) || 0;
    const packages = infoForm.packages
      .map((item) => ({ photos: toNumber(item.photos), price: toNumber(item.price), name: String(item.name).trim() }))
      .filter((item) => item.price > 0)
      .map((item) => ({ ...item, name: item.name || `${item.photos} fotos` }));
    if (!infoForm.title.trim()) {
      setMessage("Dê um nome ao ensaio.");
      return;
    }
    if (!packages.length) {
      setMessage("Cadastre pelo menos um pacote com valor.");
      return;
    }
    if (new Set(packages.map((item) => item.name.toLowerCase())).size !== packages.length) {
      setMessage("Cada pacote precisa ter um nome diferente.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("booking_campaigns")
      .update({
        title: infoForm.title.trim(),
        subtitle: infoForm.subtitle.trim(),
        location: infoForm.location.trim(),
        studio_whatsapp: infoForm.studio_whatsapp.replace(/\D/g, ""),
        slot_minutes: Math.max(5, toNumber(infoForm.slot_minutes) || 30),
        extra_photo_price: toNumber(infoForm.extra_photo_price),
        extra_person_price: toNumber(infoForm.extra_person_price),
        max_extra_people: Math.max(0, Math.round(toNumber(infoForm.max_extra_people))),
        allow_full_payment: Boolean(infoForm.allow_full_payment),
        start_date: infoForm.start_date || null,
        end_date: infoForm.end_date || null,
        packages,
      })
      .eq("id", BOOKING_CAMPAIGN_ID);
    setBusy(false);
    if (error) {
      setMessage(`Erro ao salvar: ${error.message}`);
      return;
    }
    if (infoForm.start_date && infoForm.end_date) {
      setGenerator((current) => ({ ...current, startDate: infoForm.start_date, endDate: infoForm.end_date }));
    }
    setMessage("Dados do ensaio salvos. Os novos valores valem para as próximas reservas.");
    setInfoForm(null);
    load();
  }

  async function uploadPdf(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      setMessage("Escolha um arquivo PDF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessage("O PDF pode ter no máximo 10 MB.");
      return;
    }
    setUploading(true);
    const path = `${BOOKING_CAMPAIGN_ID}/instrucoes-${Date.now()}.pdf`;
    const { error } = await supabase.storage.from(PDF_BUCKET).upload(path, file, { contentType: "application/pdf", upsert: true });
    if (error) {
      setUploading(false);
      setMessage(`Erro ao enviar o PDF: ${error.message}`);
      return;
    }
    const { data } = supabase.storage.from(PDF_BUCKET).getPublicUrl(path);
    const oldPath = campaign?.instructions_pdf_path;
    const { error: updateError } = await supabase
      .from("booking_campaigns")
      .update({ instructions_pdf_url: data.publicUrl, instructions_pdf_path: path, instructions_pdf_name: file.name })
      .eq("id", BOOKING_CAMPAIGN_ID);
    if (!updateError && oldPath && oldPath !== path) await supabase.storage.from(PDF_BUCKET).remove([oldPath]);
    setUploading(false);
    setMessage(updateError ? `Erro ao salvar o PDF: ${updateError.message}` : "PDF de instruções enviado. O cliente já consegue baixar na página.");
    load();
  }

  async function removePdf() {
    if (!campaign?.instructions_pdf_url || !window.confirm("Remover o PDF de instruções?")) return;
    setUploading(true);
    if (campaign.instructions_pdf_path) await supabase.storage.from(PDF_BUCKET).remove([campaign.instructions_pdf_path]);
    await supabase
      .from("booking_campaigns")
      .update({ instructions_pdf_url: null, instructions_pdf_path: null, instructions_pdf_name: null })
      .eq("id", BOOKING_CAMPAIGN_ID);
    setUploading(false);
    load();
  }

  async function toggleCampaign() {
    if (!campaign) return;
    setBusy(true);
    await supabase.from("booking_campaigns").update({ active: !campaign.active }).eq("id", campaign.id);
    setBusy(false);
    load();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(CHRISTMAS_PUBLIC_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copie o link:", CHRISTMAS_PUBLIC_URL);
    }
  }

  function shareLink() {
    const text = [
      `${themeEmoji(campaign?.title)} *${campaign?.title || "Ensaios"}* — Emerson Honorato Retratos`,
      "",
      "As vagas estão abertas! Escolha o pacote e o horário direto pelo link:",
      CHRISTMAS_PUBLIC_URL,
      "",
      ...(Array.isArray(campaign?.packages) ? campaign.packages.map((item) => `• ${item.photos} fotos — ${formatBRL(item.price)}`) : []),
      Number(campaign?.extra_photo_price) ? `• Foto extra: ${formatBRL(campaign.extra_photo_price)}` : "",
      Number(campaign?.extra_person_price) ? `• Pessoa extra: ${formatBRL(campaign.extra_person_price)}` : "",
    ].filter((line) => line !== null).join("\n");
    window.open(buildWhatsAppShareLink(text), "_blank", "noopener");
  }

  function confirmOnWhatsApp(booking) {
    const date = fullDateLabel(localDateKey(booking.starts_at));
    const awaiting = booking.status === "aguardando_sinal";
    const pix = awaiting ? pixFor(booking) : "";
    const lines = [
      "🤖 _Mensagem automática do sistema de agendamentos — Emerson Honorato Retratos_",
      "",
      awaiting
        ? `Olá, ${String(booking.name).split(" ")[0]}! Seu horário do ensaio (${campaign?.title || "ensaio"}) está pré-reservado ${themeEmoji(campaign?.title)}`
        : `Olá, ${String(booking.name).split(" ")[0]}! Seu ensaio (${campaign?.title || "ensaio"}) está confirmado ${themeEmoji(campaign?.title)}`,
      "",
      `📅 *Data:* ${date}`,
      `⏰ *Horário:* ${localTime(booking.starts_at)}`,
      `📸 *Pacote:* ${booking.package_photos} fotos — ${formatBRL(booking.package_price)}`,
      Number(booking.extra_people) ? `👥 *Pessoas extras:* ${booking.extra_people} — ${formatBRL(booking.extra_people_amount)}` : "",
      `💵 *Total:* ${formatBRL(bookingTotal(booking))}`,
      awaiting
        ? `💰 *${booking.payment_choice === "total" ? "Valor para confirmar" : "Sinal para confirmar"}:* ${formatBRL(booking.deposit_amount)}`
        : Number(booking.deposit_amount || 0) >= bookingTotal(booking)
          ? `✅ *Pagamento recebido:* ${formatBRL(booking.deposit_amount)} — tudo pago!`
          : `✅ *Sinal recebido:* ${formatBRL(booking.deposit_amount)} • restante no dia: ${formatBRL(bookingTotal(booking) - Number(booking.deposit_amount || 0))}`,
    ].filter((line) => line !== "");
    if (campaign?.instructions_pdf_url) lines.push("", "📄 Instruções para o ensaio:", campaign.instructions_pdf_url);
    if (pix) lines.push("", "Pix copia e cola (já com o valor):", pix, "", "Depois de pagar, me envie o comprovante por aqui. 🙏");
    else lines.push("", "Qualquer dúvida, é só responder esta mensagem.");
    const text = lines.join("\n");
    window.open(buildWhatsAppLink(booking.whatsapp, text), "_blank", "noopener");
  }

  const toggleWeekday = (value) =>
    setGenerator((current) => ({
      ...current,
      weekdays: current.weekdays.includes(value) ? current.weekdays.filter((item) => item !== value) : [...current.weekdays, value],
    }));

  if (state === "loading") return <p className="p-6 text-slate-500">Carregando agenda de ensaios…</p>;
  if (state === "missing") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Falta criar as tabelas da agenda no Supabase (arquivo <code>supabase/natal-2026.sql</code>).
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Não foi possível carregar a agenda de ensaios. <button type="button" className="underline" onClick={load}>Tentar de novo</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[32px] border border-red-200/70 bg-gradient-to-r from-[#fff4f2] via-white to-[#fff7f0] p-5 shadow-[0_22px_60px_rgba(122,23,18,0.08)]">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-red-200 bg-white px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7a1712]">Ensaio temático</span>
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${campaign?.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
            {campaign?.active ? "Reservas abertas" : "Reservas fechadas"}
          </span>
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">{themeEmoji(campaign?.title)} {campaign?.title || "Ensaio temático"}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {Array.isArray(campaign?.packages) ? campaign.packages.map((item) => `${item.photos} fotos ${formatBRL(item.price)}`).join(" • ") : ""}
              {Number(campaign?.extra_photo_price) ? ` • extra ${formatBRL(campaign.extra_photo_price)}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={shareLink}><Send className="mr-2 h-4 w-4" />Divulgar no WhatsApp</Button>
            <Button variant="outline" className="rounded-2xl" onClick={copyLink}><Copy className="mr-2 h-4 w-4" />{copied ? "Copiado!" : "Copiar link"}</Button>
            <Button variant="outline" className="rounded-2xl" onClick={() => window.open(`${window.location.origin}/ensaio`, "_blank", "noopener")}><ExternalLink className="mr-2 h-4 w-4" />Ver página</Button>
            <Button variant="outline" className="rounded-2xl" disabled={busy} onClick={toggleCampaign}>{campaign?.active ? "Fechar reservas" : "Abrir reservas"}</Button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          {[
            ["Livres", totals.free],
            ["Aguardando sinal", totals.awaiting],
            ["Confirmados", totals.booked],
            ["Recebido via Pix", formatBRL(totals.deposits)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white bg-white/80 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {message ? <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">{message}</p> : null}

      <Card className="studio-panel rounded-3xl border-0 bg-white/90 shadow-sm">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold">Dados do ensaio</h3>
              <p className="text-sm text-slate-500">Mude o nome e os valores para usar em outros ensaios (ex.: Dia das Mães 2027).</p>
            </div>
            {!infoForm ? (
              <Button variant="outline" size="sm" className="rounded-xl" onClick={startEditInfo}><Pencil className="mr-2 h-4 w-4" />Editar</Button>
            ) : null}
          </div>
          {infoForm ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1"><Label>Nome do ensaio</Label><Input className="rounded-2xl" placeholder="Ex.: Ensaios de Dia das Mães 2027" value={infoForm.title} onChange={(e) => setInfoForm({ ...infoForm, title: e.target.value })} /></div>
                <div className="space-y-1"><Label>Frase da página</Label><Input className="rounded-2xl" value={infoForm.subtitle} onChange={(e) => setInfoForm({ ...infoForm, subtitle: e.target.value })} /></div>
                <div className="space-y-1"><Label>Local</Label><Input className="rounded-2xl" placeholder="Ex.: Estúdio — Siderópolis" value={infoForm.location} onChange={(e) => setInfoForm({ ...infoForm, location: e.target.value })} /></div>
                <div className="space-y-1"><Label>Seu WhatsApp (recebe os comprovantes)</Label><Input className="rounded-2xl" value={infoForm.studio_whatsapp} onChange={(e) => setInfoForm({ ...infoForm, studio_whatsapp: e.target.value })} /></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="space-y-1"><Label>Início</Label><Input type="date" className="rounded-2xl" value={infoForm.start_date} onChange={(e) => setInfoForm({ ...infoForm, start_date: e.target.value })} /></div>
                <div className="space-y-1"><Label>Fim</Label><Input type="date" className="rounded-2xl" value={infoForm.end_date} onChange={(e) => setInfoForm({ ...infoForm, end_date: e.target.value })} /></div>
                <div className="space-y-1"><Label>Duração (min)</Label><Input type="number" min="5" className="rounded-2xl" value={infoForm.slot_minutes} onChange={(e) => setInfoForm({ ...infoForm, slot_minutes: e.target.value })} /></div>
                <div className="space-y-1"><Label>Foto extra (R$)</Label><Input inputMode="decimal" className="rounded-2xl" value={infoForm.extra_photo_price} onChange={(e) => setInfoForm({ ...infoForm, extra_photo_price: e.target.value })} /></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1"><Label>Pessoa extra (R$ por pessoa)</Label><Input inputMode="decimal" className="rounded-2xl" placeholder="0 = sem opção" value={infoForm.extra_person_price} onChange={(e) => setInfoForm({ ...infoForm, extra_person_price: e.target.value })} /></div>
                <div className="space-y-1"><Label>Máximo de pessoas extras</Label><Input type="number" min="0" className="rounded-2xl" value={infoForm.max_extra_people} onChange={(e) => setInfoForm({ ...infoForm, max_extra_people: e.target.value })} /></div>
                <label className="flex items-center gap-2 self-end rounded-2xl border border-slate-200 px-3 py-2.5 text-sm">
                  <input type="checkbox" checked={infoForm.allow_full_payment} onChange={(e) => setInfoForm({ ...infoForm, allow_full_payment: e.target.checked })} />
                  Cliente pode pagar o valor total
                </label>
              </div>
              <div className="space-y-2">
                <Label>Pacotes</Label>
                {infoForm.packages.map((item, index) => (
                  <div key={index} className="grid grid-cols-[1fr_90px_110px_40px] items-center gap-2">
                    <Input className="rounded-2xl" placeholder="Nome (ex.: 15 fotos)" value={item.name} onChange={(e) => updatePackage(index, "name", e.target.value)} />
                    <Input type="number" min="0" className="rounded-2xl" placeholder="Fotos" value={item.photos} onChange={(e) => updatePackage(index, "photos", e.target.value)} />
                    <Input inputMode="decimal" className="rounded-2xl" placeholder="R$" value={item.price} onChange={(e) => updatePackage(index, "price", e.target.value)} />
                    <button type="button" className="text-red-600" title="Remover pacote" onClick={() => setInfoForm({ ...infoForm, packages: infoForm.packages.filter((_, i) => i !== index) })}><Trash2 className="mx-auto h-4 w-4" /></button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setInfoForm({ ...infoForm, packages: [...infoForm.packages, { name: "", photos: "", price: "" }] })}><Plus className="mr-2 h-4 w-4" />Adicionar pacote</Button>
              </div>
              <div className="flex gap-2">
                <Button className="rounded-2xl" disabled={busy} onClick={saveInfo}><Save className="mr-2 h-4 w-4" />Salvar</Button>
                <Button variant="ghost" className="rounded-2xl" onClick={() => setInfoForm(null)}>Cancelar</Button>
              </div>
              <p className="text-xs text-slate-500">Dica: para um ensaio novo, troque o nome e os valores aqui, remova os horários antigos que sobraram e crie os novos logo abaixo. As reservas já feitas continuam com os valores da época.</p>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              {campaign?.title} • {Number(campaign?.slot_minutes || 30)} min
              {Number(campaign?.extra_person_price) ? ` • pessoa extra ${formatBRL(campaign.extra_person_price)} (até ${campaign?.max_extra_people ?? 5})` : " • sem pessoa extra"}
              {campaign?.allow_full_payment !== false ? " • aceita pagamento total" : ""}
              {campaign?.location ? ` • ${campaign.location}` : ""}
              {campaign?.start_date && campaign?.end_date ? ` • ${dayMonthLabel(campaign.start_date)} a ${dayMonthLabel(campaign.end_date)}` : ""}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-3">
            <FileText className="h-5 w-5 text-[#7a1712]" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900">PDF de instruções para o ensaio</p>
              <p className="truncate text-xs text-slate-500">
                {campaign?.instructions_pdf_url ? (campaign.instructions_pdf_name || "instrucoes.pdf") : "Nenhum PDF enviado. O cliente baixa na página e recebe o link na confirmação."}
              </p>
            </div>
            {campaign?.instructions_pdf_url ? (
              <>
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => window.open(campaign.instructions_pdf_url, "_blank", "noopener")}><ExternalLink className="mr-2 h-4 w-4" />Ver</Button>
                <Button variant="ghost" size="sm" className="rounded-xl text-red-600" disabled={uploading} onClick={removePdf}><Trash2 className="h-4 w-4" /></Button>
              </>
            ) : null}
            <label className={`inline-flex cursor-pointer items-center rounded-xl bg-[#7a1712] px-3 py-2 text-sm font-medium text-white hover:bg-[#62120e] ${uploading ? "pointer-events-none opacity-60" : ""}`}>
              <FileUp className="mr-2 h-4 w-4" />
              {uploading ? "Enviando…" : campaign?.instructions_pdf_url ? "Trocar PDF" : "Subir PDF"}
              <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={uploadPdf} />
            </label>
          </div>
        </CardContent>
      </Card>

      <Card className="studio-panel rounded-3xl border-0 bg-white/90 shadow-sm">
        <CardContent className="space-y-3 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">Pix do sinal</h3>
            {!pixForm ? (
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setPixForm({
                pix_key: campaign?.pix_key || "",
                pix_name: campaign?.pix_name || "",
                pix_city: campaign?.pix_city || "",
                deposit_percent: String(campaign?.deposit_percent ?? 50),
              })}>Editar</Button>
            ) : null}
          </div>
          {pixForm ? (
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1"><Label>Chave Pix</Label><Input className="rounded-2xl" value={pixForm.pix_key} onChange={(e) => setPixForm({ ...pixForm, pix_key: e.target.value })} /></div>
              <div className="space-y-1"><Label>Nome do recebedor</Label><Input className="rounded-2xl" value={pixForm.pix_name} onChange={(e) => setPixForm({ ...pixForm, pix_name: e.target.value })} /></div>
              <div className="space-y-1"><Label>Cidade</Label><Input className="rounded-2xl" value={pixForm.pix_city} onChange={(e) => setPixForm({ ...pixForm, pix_city: e.target.value })} /></div>
              <div className="space-y-1"><Label>Sinal (%)</Label><Input type="number" min="0" max="100" className="rounded-2xl" value={pixForm.deposit_percent} onChange={(e) => setPixForm({ ...pixForm, deposit_percent: e.target.value })} /></div>
              <div className="flex gap-2 md:col-span-4">
                <Button className="rounded-2xl" disabled={busy} onClick={savePix}><Save className="mr-2 h-4 w-4" />Salvar</Button>
                <Button variant="ghost" className="rounded-2xl" onClick={() => setPixForm(null)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              Chave {campaign?.pix_key || "não cadastrada"} • {campaign?.pix_name || "-"} • {campaign?.pix_city || "-"} • sinal de {campaign?.deposit_percent ?? 50}%
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="studio-panel rounded-3xl border-0 bg-white/90 shadow-sm">
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-[#7a1712]" />
            <h3 className="text-lg font-semibold">Criar horários</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1"><Label>De</Label><Input type="date" className="rounded-2xl" value={generator.startDate} onChange={(e) => setGenerator({ ...generator, startDate: e.target.value })} /></div>
            <div className="space-y-1"><Label>Até</Label><Input type="date" className="rounded-2xl" value={generator.endDate} onChange={(e) => setGenerator({ ...generator, endDate: e.target.value })} /></div>
            <div className="space-y-1"><Label>Primeiro horário</Label><Input type="time" className="rounded-2xl" value={generator.startTime} onChange={(e) => setGenerator({ ...generator, startTime: e.target.value })} /></div>
            <div className="space-y-1"><Label>Termina às</Label><Input type="time" className="rounded-2xl" value={generator.endTime} onChange={(e) => setGenerator({ ...generator, endTime: e.target.value })} /></div>
            <div className="space-y-1"><Label>Pausa de</Label><Input type="time" className="rounded-2xl" value={generator.breakStart} onChange={(e) => setGenerator({ ...generator, breakStart: e.target.value })} /></div>
            <div className="space-y-1"><Label>Pausa até</Label><Input type="time" className="rounded-2xl" value={generator.breakEnd} onChange={(e) => setGenerator({ ...generator, breakEnd: e.target.value })} /></div>
            <div className="space-y-1 md:col-span-2">
              <Label>Dias da semana</Label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleWeekday(day.value)}
                    className={`rounded-full border px-3 py-1.5 text-sm ${generator.weekdays.includes(day.value) ? "border-[#7a1712] bg-[#7a1712] text-white" : "border-slate-200 bg-white text-slate-700"}`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button className="rounded-2xl bg-[#7a1712] text-white hover:bg-[#5c0f0b]" disabled={busy || !previewCount} onClick={generateSlots}>
              <CalendarPlus className="mr-2 h-4 w-4" />Criar {previewCount} horário{previewCount === 1 ? "" : "s"} de {campaign?.slot_minutes || 30} min
            </Button>
            <span className="text-xs text-slate-500">Para a pausa não ser usada, apague os campos "Pausa". Horários repetidos não são duplicados.</span>
          </div>
          {message ? <p className="rounded-2xl bg-slate-50 px-4 py-2 text-sm text-slate-700">{message}</p> : null}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Dias e horários</h3>
        <Button variant="ghost" size="sm" className="rounded-xl" onClick={load}><RefreshCw className="mr-1.5 h-4 w-4" />Atualizar</Button>
      </div>

      {days.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 p-8 text-center text-slate-500">
          Nenhum horário criado ainda. Use "Criar horários" acima.
        </div>
      ) : (
        <div className="space-y-4">
          {days.map(([dayKey, daySlots]) => (
            <div key={dayKey} className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-slate-900">
                  {capitalize(weekdayLabel(dayKey))} • {dayMonthLabel(dayKey)}
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    {daySlots.filter((slot) => slot.status === "reservado").length}/{daySlots.length} reservados
                  </span>
                </p>
                <button type="button" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-700" onClick={() => removeFreeSlotsOfDay(daySlots)}>
                  <Trash2 className="h-3.5 w-3.5" /> Remover horários livres do dia
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {daySlots.map((slot) => {
                  const booking = bookingBySlot.get(slot.id);
                  return (
                    <div
                      key={slot.id}
                      className={`rounded-2xl border p-3 text-sm ${
                        booking ? "border-[#e8b4ae] bg-[#fff5f3]" : slot.status === "bloqueado" ? "border-slate-200 bg-slate-50 text-slate-400" : "border-emerald-100 bg-emerald-50/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{localTime(slot.starts_at)}</span>
                        <span className="text-[11px] uppercase tracking-wide">{booking ? (booking.status === "aguardando_sinal" ? "aguardando" : "confirmado") : slot.status}</span>
                      </div>
                      {booking ? (
                        <div className="mt-1 space-y-1">
                          <p className="font-medium text-slate-900">{booking.name}</p>
                          <p className="text-xs text-slate-600">{booking.package_photos} fotos{Number(booking.extra_people) ? ` + ${booking.extra_people} pessoa${booking.extra_people > 1 ? "s" : ""}` : ""} • {formatBRL(bookingTotal(booking))} • {booking.whatsapp}</p>
                          {booking.status === "aguardando_sinal" ? (
                            <p className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">{booking.payment_choice === "total" ? "Aguardando pagamento total" : "Aguardando sinal"} {formatBRL(booking.deposit_amount)}</p>
                          ) : (
                            <p className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">{Number(booking.deposit_amount || 0) >= bookingTotal(booking) ? "Pago completo" : "Sinal recebido"} {formatBRL(booking.deposit_amount)}</p>
                          )}
                          {booking.notes ? <p className="text-xs text-slate-500">“{booking.notes}”</p> : null}
                          <div className="flex flex-wrap gap-2 pt-1">
                            {booking.status === "aguardando_sinal" ? (
                              <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700" disabled={busy} onClick={() => markDepositReceived(booking)}><BadgeCheck className="h-3.5 w-3.5" />{booking.payment_choice === "total" ? "Pagamento recebido" : "Sinal recebido"}</button>
                            ) : null}
                            <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-sky-700" onClick={() => confirmOnWhatsApp(booking)}><Send className="h-3.5 w-3.5" />{booking.status === "aguardando_sinal" ? "Cobrar sinal" : "Confirmar"}</button>
                            <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-red-700" onClick={() => cancelBooking(booking)}><Undo2 className="h-3.5 w-3.5" />Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1">
                          {slot.status === "bloqueado" ? (
                            <button type="button" className="inline-flex items-center gap-1 text-xs text-emerald-700" disabled={busy} onClick={() => setSlotStatus(slot, "livre")}><RotateCcw className="h-3.5 w-3.5" />Liberar</button>
                          ) : (
                            <button type="button" className="inline-flex items-center gap-1 text-xs text-slate-500" disabled={busy} onClick={() => setSlotStatus(slot, "bloqueado")}><Ban className="h-3.5 w-3.5" />Bloquear</button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
