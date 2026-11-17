import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/supabase";
import { STUDIO_WHATSAPP } from "@/lib/delivery";
import { MONTHLY_THEME_IDEAS } from "@/lib/sessions";

// Página pública: https://orcamento.emersonhonoratoretratos.com.br/mensal/<codigo>
// O cliente do acompanhamento mensal escolhe o horário da sessão do mês.

const TZ = "America/Sao_Paulo";
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function spParts(value) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(value))
      .map((p) => [p.type, p.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function monthLabel(key) {
  const [y, m] = String(key).split("-").map(Number);
  const name = MONTHS[m - 1] || "";
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${y}`;
}

function weekday(dayKey) {
  return WEEKDAYS[new Date(`${dayKey}T12:00:00`).getDay()];
}

function dayLabel(dayKey) {
  const [, m, d] = dayKey.split("-");
  return `${d}/${m}`;
}

// "2026-12-05T14:00" (já no horário de Brasília) -> "sábado, 05/12 às 14:00"
function localLabel(text) {
  const [day, time] = String(text || "").split("T");
  return day && time ? `${weekday(day)}, ${dayLabel(day)} às ${time}` : "";
}

function addMinutes(time, minutes) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export default function PublicMonthlyBooking({ token }) {
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");
  const [month, setMonth] = useState("");
  const [times, setTimes] = useState(null);
  const [day, setDay] = useState("");
  const [pick, setPick] = useState("");
  const [theme, setTheme] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  const load = useCallback(async () => {
    const { data: info, error: loadError } = await supabase.rpc("get_monthly_booking", { p_token: token });
    if (loadError) return setState("error");
    if (!info) return setState("missing");
    setData(info);
    setState("ok");
    return info;
  }, [token]);

  useEffect(() => {
    let active = true;
    supabase.rpc("get_monthly_booking", { p_token: token }).then(({ data: info, error: loadError }) => {
      if (!active) return;
      if (loadError) return setState("error");
      if (!info) return setState("missing");
      setData(info);
      setState("ok");
    });
    return () => {
      active = false;
    };
  }, [token]);

  const loadTimes = useCallback(async (key) => {
    setTimes(null);
    setDay("");
    setPick("");
    const { data: list, error: timesError } = await supabase.rpc("monthly_free_times", { p_token: token, p_month: key });
    if (timesError) {
      setError("Não consegui carregar os horários. Tente de novo em instantes.");
      setTimes([]);
      return;
    }
    setTimes((list || []).map((row) => row.starts_at || row));
  }, [token]);

  function chooseMonth(key) {
    setMonth(key);
    const planned = data?.months?.find((item) => item.month === key)?.planned_theme;
    setTheme(planned || "");
    setError("");
    loadTimes(key);
  }

  const days = useMemo(() => {
    const map = new Map();
    for (const value of times || []) {
      const { day: key, time } = spParts(value);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({ value, time });
    }
    return [...map.entries()];
  }, [times]);

  const duration = Number(data?.duration_minutes || 120);
  const chosen = days.find(([key]) => key === day)?.[1].find((t) => t.value === pick) || null;

  async function confirm() {
    if (!chosen) return;
    setBusy(true);
    setError("");
    const { data: result, error: bookError } = await supabase.rpc("book_monthly_session", { p_token: token, p_starts_at: chosen.value, p_theme: theme || null, p_notes: notes || null });
    setBusy(false);
    if (bookError || !result?.ok) {
      setError(result?.error === "ocupado" ? "Esse horário acabou de ser ocupado ou o mês já tem sessão marcada. Escolha outro horário." : "Não consegui marcar agora. Tente de novo ou fale comigo no WhatsApp.");
      loadTimes(month);
      return;
    }
    setDone({ day, time: chosen.time, theme });
    setMonth("");
    setTimes(null);
    setTheme("");
    setNotes("");
    load();
  }

  const whatsapp = (text) => `https://wa.me/${STUDIO_WHATSAPP}?text=${encodeURIComponent(text)}`;

  if (state === "loading") return <div className="flex min-h-screen items-center justify-center bg-[#f6efe3] text-[#1b1610]/70">Carregando…</div>;
  if (state !== "ok") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6efe3] p-6 text-center text-[#1b1610]">
        <div className="max-w-sm">
          <p className="text-lg font-semibold">{state === "missing" ? "Link não encontrado" : "Não consegui abrir agora"}</p>
          <p className="mt-2 text-sm text-[#1b1610]/70">{state === "missing" ? "Confira o link que você recebeu ou fale comigo no WhatsApp." : "Tente de novo em instantes."}</p>
          <a href={whatsapp("Olá, Emerson! Quero agendar a sessão mensal.")} className="mt-5 inline-block rounded-2xl bg-[#1b1610] px-5 py-3 text-sm font-semibold text-white">Falar no WhatsApp</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6efe3] pb-16 text-[#1b1610]">
      <header className="bg-[#1b1610] px-5 pb-10 pt-8 text-center text-white">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#e9c77b]">Emerson Honorato Retratos</p>
        <h1 className="mt-3 text-3xl" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>Olá{data.client_name ? `, ${data.client_name}` : ""}!</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/75">Aqui você marca a sessão do acompanhamento mensal. Escolha o mês, o dia e o horário livre. Cada sessão dura {duration >= 60 ? `${duration / 60} hora${duration >= 120 ? "s" : ""}` : `${duration} min`}.</p>
      </header>

      <main className="mx-auto -mt-6 max-w-xl space-y-4 px-4">
        {done ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 shadow-sm">
            <p className="text-lg font-semibold">Sessão marcada! 🎉</p>
            <p className="mt-1 text-sm leading-6"><span className="capitalize">{weekday(done.day)}</span>, {dayLabel(done.day)} das {done.time} às {addMinutes(done.time, duration)}{done.theme ? ` · tema: ${done.theme}` : ""}.</p>
            <a href={whatsapp(`Olá, Emerson! Marquei a sessão mensal para ${weekday(done.day)}, ${dayLabel(done.day)} às ${done.time}.${done.theme ? ` Tema: ${done.theme}.` : ""}`)} className="mt-3 inline-block rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white">Avisar no WhatsApp</a>
          </div>
        ) : null}

        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold">1. Escolha o mês</h2>
          <div className="mt-3 grid gap-2">
            {data.months.map((item) => (
              item.booked_at ? (
                <div key={item.month} className="flex items-center justify-between gap-3 rounded-2xl border border-[#e4dbd0] bg-[#fbf8f4] px-4 py-3">
                  <div>
                    <p className="font-semibold">{monthLabel(item.month)}</p>
                    <p className="text-sm text-[#1b1610]/70">Marcada: {localLabel(item.booked_at)}{item.theme ? ` · ${item.theme}` : ""}</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">Marcada</span>
                </div>
              ) : (
                <button
                  key={item.month}
                  type="button"
                  onClick={() => chooseMonth(item.month)}
                  className={`flex items-center justify-between rounded-2xl border-2 px-4 py-3 text-left transition ${month === item.month ? "border-[#1b1610] bg-[#1b1610] text-white" : "border-[#e4dbd0] bg-white hover:border-[#a8875a]"}`}
                >
                  <span>
                    <span className="block font-semibold">{monthLabel(item.month)}</span>
                    {item.planned_theme ? <span className={`block text-xs ${month === item.month ? "text-white/70" : "text-[#1b1610]/60"}`}>Tema do mês: {item.planned_theme}</span> : null}
                  </span>
                  <span className={`text-sm ${month === item.month ? "text-[#e9c77b]" : "text-[#a8875a]"}`}>Escolher horário</span>
                </button>
              )
            ))}
          </div>
          {data.months.every((item) => item.booked_at) ? <p className="mt-3 text-sm text-[#1b1610]/70">Tudo marcado por enquanto. O próximo mês abre automaticamente.</p> : null}
        </section>

        {month ? (
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">2. Escolha o dia e o horário</h2>
            {times === null ? <p className="mt-3 text-sm text-[#1b1610]/60">Procurando horários livres…</p> : null}
            {times && !days.length ? (
              <div className="mt-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950">
                Não há horários livres em {monthLabel(month).toLowerCase()}.{" "}
                <a className="font-semibold underline" href={whatsapp(`Olá, Emerson! Não achei horário livre para a sessão mensal de ${monthLabel(month).toLowerCase()}. Podemos combinar?`)}>Fale comigo no WhatsApp</a> que a gente combina.
              </div>
            ) : null}
            {days.length ? (
              <>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {days.map(([key, list]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { setDay(key); setPick(""); }}
                      className={`shrink-0 rounded-2xl border-2 px-3 py-2 text-center transition ${day === key ? "border-[#1b1610] bg-[#1b1610] text-white" : "border-[#e4dbd0] hover:border-[#a8875a]"}`}
                    >
                      <span className="block text-xs capitalize opacity-80">{weekday(key).slice(0, 3)}</span>
                      <span className="block text-base font-semibold">{dayLabel(key)}</span>
                      <span className="block text-[10px] opacity-70">{list.length} {list.length === 1 ? "horário" : "horários"}</span>
                    </button>
                  ))}
                </div>
                {day ? (
                  <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {days.find(([key]) => key === day)[1].map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setPick(t.value)}
                        className={`rounded-xl border-2 px-2 py-2.5 text-sm font-semibold transition ${pick === t.value ? "border-[#1b1610] bg-[#1b1610] text-white" : "border-[#e4dbd0] hover:border-[#a8875a]"}`}
                      >
                        {t.time}
                      </button>
                    ))}
                  </div>
                ) : <p className="mt-3 text-sm text-[#1b1610]/60">Toque em um dia para ver os horários.</p>}
              </>
            ) : null}
          </section>
        ) : null}

        {chosen ? (
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">3. Tema e confirmação</h2>
            <label className="mt-3 block text-sm font-medium" htmlFor="mensal-tema">Tema da sessão (opcional)</label>
            <input id="mensal-tema" list="mensal-temas" value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Ex.: Natal, Primeiro banho…" className="mt-1.5 w-full rounded-2xl border border-[#e4dbd0] px-4 py-3 text-base outline-none focus:border-[#a8875a]" />
            <datalist id="mensal-temas">{MONTHLY_THEME_IDEAS.map((t) => <option key={t} value={t} />)}</datalist>
            <label className="mt-3 block text-sm font-medium" htmlFor="mensal-obs">Recado para o fotógrafo (opcional)</label>
            <textarea id="mensal-obs" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1.5 w-full rounded-2xl border border-[#e4dbd0] px-4 py-3 text-base outline-none focus:border-[#a8875a]" />
            <div className="mt-4 rounded-2xl bg-[#fbf8f4] p-4 text-sm leading-6">
              <span className="capitalize">{weekday(day)}</span>, {dayLabel(day)} · das <strong>{chosen.time}</strong> às <strong>{addMinutes(chosen.time, duration)}</strong>
            </div>
            {error ? <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
            <button type="button" disabled={busy} onClick={confirm} className="mt-4 w-full rounded-2xl bg-[#1b1610] px-5 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-[#2c241a] disabled:opacity-60">
              {busy ? "Marcando…" : "Confirmar sessão"}
            </button>
          </section>
        ) : error ? <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

        <p className="pt-2 text-center text-xs text-[#1b1610]/60">
          Precisa mudar uma sessão já marcada? <a className="font-semibold underline" href={whatsapp("Olá, Emerson! Preciso mudar a sessão mensal.")}>Fale comigo no WhatsApp</a>.
        </p>
      </main>
    </div>
  );
}
