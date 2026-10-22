import { useEffect, useMemo, useState } from "react";
import qrcode from "qrcode-generator";
import { supabase } from "@/supabase";
import { buildPixPayload, formatPixKey } from "@/lib/pix";
import {
  BOOKING_CAMPAIGN_ID,
  addMinutesToTime,
  dayMonthLabel,
  formatBRL,
  fullDateLabel,
  groupSlotsByDay,
  localTime,
  weekdayLabel,
  fetchAllRows,
} from "@/lib/bookings";

// Página pública: o cliente escolhe pacote, dia e horário do ensaio de Natal e reserva.

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#b3261e] focus:ring-4 focus:ring-[#b3261e]/10";

function formatPhoneInput(value) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function StepTitle({ number, children }) {
  return (
    <h2 className="flex items-center gap-3 text-lg font-semibold text-slate-900">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7a1712] text-sm font-bold text-white">{number}</span>
      {children}
    </h2>
  );
}

export default function PublicChristmasBooking() {
  const [campaign, setCampaign] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [packageName, setPackageName] = useState("");
  const [dayKey, setDayKey] = useState("");
  const [slotId, setSlotId] = useState("");
  const [form, setForm] = useState({ name: "", whatsapp: "", email: "", notes: "", website: "" });
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState(null);
  const [pixCopied, setPixCopied] = useState(false);

  async function loadData() {
    const [{ data: campaignData, error: campaignError }, { data: slotData, error: slotError }] = await Promise.all([
      supabase.from("booking_campaigns").select("*").eq("id", BOOKING_CAMPAIGN_ID).maybeSingle(),
      fetchAllRows(() =>
        supabase
          .from("booking_slots")
          .select("id, starts_at, status")
          .eq("campaign_id", BOOKING_CAMPAIGN_ID)
          .gte("starts_at", new Date().toISOString())
          .order("starts_at", { ascending: true }),
      ),
    ]);
    if (campaignError || slotError) {
      setLoadState("error");
      return;
    }
    if (!campaignData) {
      setLoadState("closed");
      return;
    }
    setCampaign(campaignData);
    setSlots(slotData || []);
    setLoadState("ready");
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from("booking_campaigns").select("*").eq("id", BOOKING_CAMPAIGN_ID).maybeSingle(),
      fetchAllRows(() =>
        supabase
          .from("booking_slots")
          .select("id, starts_at, status")
          .eq("campaign_id", BOOKING_CAMPAIGN_ID)
          .gte("starts_at", new Date().toISOString())
          .order("starts_at", { ascending: true }),
      ),
    ]).then(([{ data: campaignData, error: campaignError }, { data: slotData, error: slotError }]) => {
      if (!active) return;
      if (campaignError || slotError) {
        setLoadState("error");
        return;
      }
      if (!campaignData) {
        setLoadState("closed");
        return;
      }
      setCampaign(campaignData);
      setSlots(slotData || []);
      setLoadState("ready");
    });
    return () => {
      active = false;
    };
  }, []);

  const packages = useMemo(() => (Array.isArray(campaign?.packages) ? campaign.packages : []), [campaign]);
  const selectedPackage = packages.find((item) => item.name === packageName) || null;
  const days = useMemo(() => {
    const grouped = groupSlotsByDay(slots);
    return Array.from(grouped.entries()).map(([key, daySlots]) => ({
      key,
      slots: daySlots,
      free: daySlots.filter((slot) => slot.status === "livre").length,
    }));
  }, [slots]);
  const selectedDay = days.find((day) => day.key === dayKey) || null;
  const selectedSlot = slots.find((slot) => slot.id === slotId) || null;
  const slotMinutes = Number(campaign?.slot_minutes || 30);

  const update = (field) => (event) => {
    const value = field === "whatsapp" ? formatPhoneInput(event.target.value) : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    if (form.website) {
      setStatus("done");
      return;
    }
    if (!selectedPackage) return setErrorMessage("Escolha um pacote.");
    if (!selectedSlot) return setErrorMessage("Escolha o dia e o horário.");
    if (form.name.trim().split(/\s+/).filter((part) => part.length >= 2).length < 2) return setErrorMessage("Informe nome e sobrenome.");
    if (form.whatsapp.replace(/\D/g, "").length < 10) return setErrorMessage("Informe um WhatsApp com DDD.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) return setErrorMessage("Informe um e-mail válido.");

    setStatus("sending");
    const { data, error } = await supabase.rpc("book_slot", {
      p_slot_id: selectedSlot.id,
      p_package: selectedPackage.name,
      p_name: form.name.trim(),
      p_whatsapp: form.whatsapp.trim(),
      p_email: form.email.trim(),
      p_notes: form.notes.trim() || null,
    });
    if (error) {
      setStatus("idle");
      setErrorMessage(error.message || "Não foi possível reservar agora. Tente novamente.");
      if (/reservado|passou/i.test(error.message || "")) {
        setSlotId("");
        loadData();
      }
      return;
    }
    setResult(data);
    setStatus("done");
  }

  const depositPercent = Number(campaign?.deposit_percent || 50);
  const depositAmount = result ? Number(result.deposit || 0) : 0;
  const pixPayload = useMemo(() => {
    if (!result || !campaign?.pix_key || !depositAmount) return "";
    return buildPixPayload({
      key: campaign.pix_key,
      name: campaign.pix_name || "Emerson Honorato Retratos",
      city: campaign.pix_city || "Sideropolis",
      amount: depositAmount,
      txid: `NATAL${String(result.id || "").replace(/-/g, "").slice(0, 12)}`,
    });
  }, [result, campaign, depositAmount]);
  const pixQrDataUrl = useMemo(() => {
    if (!pixPayload) return "";
    const qr = qrcode(0, "M");
    qr.addData(pixPayload);
    qr.make();
    return qr.createDataURL(6, 2);
  }, [pixPayload]);

  async function copyPix() {
    try {
      await navigator.clipboard.writeText(pixPayload);
      setPixCopied(true);
      setTimeout(() => setPixCopied(false), 2500);
    } catch {
      window.prompt("Copie o código Pix:", pixPayload);
    }
  }

  const whatsappToStudio = (() => {
    if (!campaign?.studio_whatsapp || !result) return "";
    const digits = String(campaign.studio_whatsapp).replace(/\D/g, "");
    const number = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
    const dateKey = selectedDay?.key;
    const text = [
      `Olá! Acabei de reservar meu ensaio de Natal 🎄`,
      ``,
      `*Nome:* ${form.name.trim()}`,
      `*Data:* ${dateKey ? fullDateLabel(dateKey) : ""}`,
      `*Horário:* ${selectedSlot ? localTime(selectedSlot.starts_at) : ""}`,
      `*Pacote:* ${result.photos} fotos — ${formatBRL(result.price)}`,
      depositAmount ? `*Sinal (${depositPercent}%):* ${formatBRL(depositAmount)}` : "",
      ``,
      `Segue o comprovante do Pix do sinal 👇`,
    ].filter((line, index, list) => line !== "" || list[index - 1] !== "").join("\n");
    return `https://api.whatsapp.com/send?phone=${number}&text=${encodeURIComponent(text)}`;
  })();

  return (
    <div className="min-h-screen bg-[#fbf7f2] text-slate-900">
      <header className="relative overflow-hidden bg-gradient-to-b from-[#5c0f0b] via-[#7a1712] to-[#8f1d16] px-5 pb-20 pt-10 text-center text-white">
        <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #fff 1px, transparent 1.5px), radial-gradient(circle at 70% 60%, #fff 1px, transparent 1.5px)", backgroundSize: "60px 60px, 90px 90px" }} />
        <img src="/Emerson%20Honorato%20Retratos%20Logo.png" alt="Emerson Honorato Retratos" className="relative mx-auto h-20 w-20 object-contain" />
        <p className="relative mt-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#f3d27a]">Emerson Honorato Retratos</p>
        <h1 className="relative mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{campaign?.title || "Ensaios de Natal"}</h1>
        <p className="relative mx-auto mt-2 max-w-md text-sm text-white/80">{campaign?.subtitle || "Reserve o seu horário."}</p>
      </header>

      <main className="relative mx-auto -mt-12 max-w-2xl px-4 pb-16">
        <div className="rounded-[28px] bg-white p-6 shadow-[0_20px_50px_rgba(92,15,11,0.12)] sm:p-8">
          {loadState === "loading" ? <p className="py-10 text-center text-slate-500">Carregando agenda…</p> : null}
          {loadState === "error" ? <p className="py-10 text-center text-red-700">Não foi possível carregar a agenda agora. Tente novamente em instantes.</p> : null}
          {loadState === "closed" ? <p className="py-10 text-center text-slate-600">As reservas para esta agenda estão encerradas.</p> : null}

          {loadState === "ready" && status === "done" ? (
            <div className="py-2 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-3xl">🎄</div>
              <h2 className="mt-4 text-2xl font-semibold">Horário pré-reservado!</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">
                Para <strong>confirmar</strong>, pague o sinal de {depositPercent}% pelo Pix e envie o comprovante pelo WhatsApp.
              </p>
              {result ? (
                <div className="mx-auto mt-5 max-w-sm rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left text-sm leading-7 text-slate-700">
                  <p><strong>Data:</strong> {selectedDay ? fullDateLabel(selectedDay.key) : ""}</p>
                  <p><strong>Horário:</strong> {selectedSlot ? `${localTime(selectedSlot.starts_at)} às ${addMinutesToTime(localTime(selectedSlot.starts_at), slotMinutes)}` : ""}</p>
                  <p><strong>Pacote:</strong> {result.photos} fotos — {formatBRL(result.price)}</p>
                  {depositAmount ? <p><strong>Restante no dia:</strong> {formatBRL(Number(result.price || 0) - depositAmount)}</p> : null}
                </div>
              ) : null}

              {pixPayload ? (
                <div className="mx-auto mt-5 max-w-sm rounded-[24px] border-2 border-emerald-200 bg-emerald-50/50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">1. Pague o sinal pelo Pix</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{formatBRL(depositAmount)}</p>
                  {pixQrDataUrl ? <img src={pixQrDataUrl} alt="QR Code Pix" className="mx-auto mt-3 h-48 w-48 rounded-xl bg-white p-2" /> : null}
                  <p className="mt-3 text-xs text-slate-500">Escaneie o QR Code ou use o Pix copia e cola:</p>
                  <div className="mt-2 break-all rounded-xl bg-white p-3 text-left font-mono text-[11px] leading-4 text-slate-600">{pixPayload}</div>
                  <button type="button" onClick={copyPix} className="mt-3 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800">
                    {pixCopied ? "Código copiado! ✓" : "Copiar código Pix"}
                  </button>
                  <p className="mt-3 text-xs text-slate-500">
                    Chave Pix (CNPJ): {formatPixKey(campaign.pix_key)}<br />{campaign.pix_name}
                  </p>
                </div>
              ) : null}

              {whatsappToStudio ? (
                <div className="mx-auto mt-4 max-w-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">2. Envie o comprovante</p>
                  <a href={whatsappToStudio} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex w-full justify-center rounded-2xl bg-emerald-600 px-5 py-3.5 font-semibold text-white shadow hover:bg-emerald-700">
                    Enviar comprovante pelo WhatsApp
                  </a>
                </div>
              ) : null}
              <p className="mx-auto mt-5 max-w-sm text-xs leading-5 text-slate-500">
                Obrigado, {form.name.trim().split(" ")[0]}! Assim que eu conferir o pagamento, sua reserva fica confirmada. Sem o sinal, o horário pode ser liberado para outra pessoa.
              </p>
            </div>
          ) : null}

          {loadState === "ready" && status !== "done" ? (
            <form onSubmit={handleSubmit} className="space-y-8" noValidate>
              <section className="space-y-4">
                <StepTitle number="1">Escolha o pacote</StepTitle>
                <div className="grid gap-3 sm:grid-cols-3">
                  {packages.map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => setPackageName(item.name)}
                      className={`rounded-2xl border-2 p-4 text-left transition ${
                        packageName === item.name ? "border-[#7a1712] bg-[#fff5f3]" : "border-slate-200 hover:border-[#c2483d]"
                      }`}
                    >
                      <p className="text-2xl font-bold text-[#7a1712]">{item.photos}</p>
                      <p className="text-sm text-slate-500">fotos tratadas</p>
                      <p className="mt-3 text-lg font-semibold text-slate-900">{formatBRL(item.price)}</p>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500">
                  Ensaio de {slotMinutes} minutos. Reserva confirmada com sinal de {Number(campaign?.deposit_percent || 50)}% via Pix.
                  {Number(campaign?.extra_photo_price) ? ` Fotos extras: ${formatBRL(campaign.extra_photo_price)} cada.` : ""}
                </p>
              </section>

              <section className="space-y-4">
                <StepTitle number="2">Escolha o dia</StepTitle>
                {days.length === 0 ? (
                  <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">Os horários ainda não foram abertos. Volte em breve! 🎄</p>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {days.map((day) => (
                      <button
                        key={day.key}
                        type="button"
                        disabled={day.free === 0}
                        onClick={() => {
                          setDayKey(day.key);
                          setSlotId("");
                        }}
                        className={`min-w-[76px] shrink-0 rounded-2xl border-2 px-3 py-2 text-center transition disabled:cursor-not-allowed disabled:opacity-40 ${
                          dayKey === day.key ? "border-[#7a1712] bg-[#7a1712] text-white" : "border-slate-200 bg-white hover:border-[#c2483d]"
                        }`}
                      >
                        <span className="block text-[11px] uppercase tracking-wide opacity-80">{weekdayLabel(day.key, "short").replace(".", "")}</span>
                        <span className="block text-base font-semibold">{dayMonthLabel(day.key)}</span>
                        <span className="block text-[10px] opacity-70">{day.free ? `${day.free} livre${day.free > 1 ? "s" : ""}` : "lotado"}</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {selectedDay ? (
                <section className="space-y-4">
                  <StepTitle number="3">Escolha o horário</StepTitle>
                  <p className="text-sm text-slate-500">{fullDateLabel(selectedDay.key)}</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {selectedDay.slots.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        disabled={slot.status !== "livre"}
                        onClick={() => setSlotId(slot.id)}
                        className={`rounded-xl border-2 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-300 disabled:line-through ${
                          slotId === slot.id ? "border-[#7a1712] bg-[#7a1712] text-white" : "border-slate-200 hover:border-[#c2483d]"
                        }`}
                      >
                        {localTime(slot.starts_at)}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="space-y-4">
                <StepTitle number={selectedDay ? "4" : "3"}>Seus dados</StepTitle>
                <label className="block">
                  <span className="text-sm font-medium">Nome e sobrenome <span className="text-[#b3261e]">*</span></span>
                  <input className={`${inputClass} mt-1.5`} value={form.name} onChange={update("name")} autoComplete="name" placeholder="Nome e sobrenome" />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium">WhatsApp <span className="text-[#b3261e]">*</span></span>
                    <input className={`${inputClass} mt-1.5`} value={form.whatsapp} onChange={update("whatsapp")} inputMode="tel" autoComplete="tel" placeholder="(48) 99999-9999" />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium">E-mail <span className="text-[#b3261e]">*</span></span>
                    <input className={`${inputClass} mt-1.5`} value={form.email} onChange={update("email")} type="email" autoComplete="email" placeholder="seuemail@exemplo.com" />
                  </label>
                </div>
                <label className="block">
                  <span className="text-sm font-medium">Observações</span>
                  <span className="block text-xs text-slate-500">Quantas pessoas, crianças, pets, alguma ideia especial…</span>
                  <textarea className={`${inputClass} mt-1.5 min-h-[90px]`} value={form.notes} onChange={update("notes")} maxLength={1000} />
                </label>
                <input tabIndex={-1} autoComplete="off" value={form.website} onChange={update("website")} className="absolute left-[-9999px] h-0 w-0 opacity-0" aria-hidden="true" />
              </section>

              {selectedPackage && selectedSlot ? (
                <div className="rounded-2xl border border-[#f1d3cf] bg-[#fff8f6] p-4 text-sm leading-6 text-slate-700">
                  <p className="font-semibold text-[#7a1712]">Resumo</p>
                  <p>{fullDateLabel(selectedDay.key)} • {localTime(selectedSlot.starts_at)} às {addMinutesToTime(localTime(selectedSlot.starts_at), slotMinutes)}</p>
                  <p>{selectedPackage.photos} fotos tratadas • {formatBRL(selectedPackage.price)}</p>
                </div>
              ) : null}

              {errorMessage ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p> : null}

              <button
                type="submit"
                disabled={status === "sending"}
                className="w-full rounded-2xl bg-[#7a1712] px-5 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-[#5c0f0b] disabled:opacity-60"
              >
                {status === "sending" ? "Reservando…" : "Reservar meu horário"}
              </button>
              <p className="text-center text-xs text-slate-400">Seus dados são usados apenas para este agendamento.</p>
            </form>
          ) : null}
        </div>
      </main>
    </div>
  );
}
