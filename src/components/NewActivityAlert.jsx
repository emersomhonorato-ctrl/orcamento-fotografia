import { useCallback, useEffect, useState } from "react";
import { Bell, CalendarCheck, FileText, X } from "lucide-react";
import { supabase } from "@/supabase";
import { BOOKING_CAMPAIGN_ID, localDateKey, localTime, dayMonthLabel } from "@/lib/bookings";

const SEEN_KEY = "eh-avisos-visto-ate";
const POLL_MS = 60 * 1000;

function readSeen() {
  try {
    const value = window.localStorage.getItem(SEEN_KEY);
    if (value) return value;
  } catch {
    /* navegador sem armazenamento */
  }
  // Primeira vez: mostra o que chegou nos últimos 3 dias
  return new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
}

function writeSeen(value) {
  try {
    window.localStorage.setItem(SEEN_KEY, value);
  } catch {
    /* ignora */
  }
}

function timeAgo(iso) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return `há ${days} dia${days > 1 ? "s" : ""}`;
}

// Aviso no topo do app: pedidos de orçamento e agendamentos que chegaram desde a última vez que você viu.
export default function NewActivityAlert({ enabled, onOpenRequests, onOpenBookings, onRequestsData, onBookingsData, onSharesData }) {
  const [seenAt, setSeenAt] = useState(readSeen);
  const [requests, setRequests] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [campaignTitle, setCampaignTitle] = useState("");
  const [shares, setShares] = useState([]);

  const poll = useCallback(async () => {
    const [requestRes, bookingRes, campaignRes, shareRes] = await Promise.all([
      supabase
        .from("budget_requests")
        .select("id, created_at, status, name, whatsapp, email, service, event_date, location, how_found")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("bookings").select("*").eq("campaign_id", BOOKING_CAMPAIGN_ID).order("created_at", { ascending: false }).limit(50),
      supabase.from("booking_campaigns").select("*").eq("id", BOOKING_CAMPAIGN_ID).maybeSingle(),
      supabase
        .from("budget_shares")
        .select("id, slug, event_id, status, views, last_viewed_at, responded_at, approved_name, approved_cpf, response_note, created_at, expires_at, snapshot->>clientName, snapshot->>eventType")
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);
    if (!shareRes.error && shareRes.data) {
      setShares(shareRes.data);
      onSharesData?.(shareRes.data);
    }
    if (!requestRes.error && requestRes.data) {
      setRequests(requestRes.data);
      onRequestsData?.(requestRes.data);
    }
    if (!bookingRes.error && bookingRes.data) {
      setBookings(bookingRes.data);
      onBookingsData?.(bookingRes.data, campaignRes.data || null);
    }
    if (!campaignRes.error && campaignRes.data) setCampaignTitle(campaignRes.data.title || "");
  }, [onRequestsData, onBookingsData, onSharesData]);

  useEffect(() => {
    if (!enabled) return undefined;
    const first = setTimeout(poll, 1500);
    const timer = setInterval(poll, POLL_MS);
    const onFocus = () => poll();
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, poll]);

  const newRequests = requests.filter((item) => item.created_at > seenAt);
  const newBookings = bookings.filter((item) => item.created_at > seenAt && item.status !== "cancelado");
  const newResponses = shares.filter((item) => item.responded_at && item.responded_at > seenAt);
  const total = newRequests.length + newBookings.length + newResponses.length;

  useEffect(() => {
    const base = "Emerson Honorato Retratos";
    document.title = total ? `(${total}) Novidades — ${base}` : base;
  }, [total]);

  if (!enabled || !total) return null;

  const markSeen = () => {
    const now = new Date().toISOString();
    writeSeen(now);
    setSeenAt(now);
  };

  const items = [
    ...newRequests.map((item) => ({
      id: `r-${item.id}`,
      kind: "request",
      createdAt: item.created_at,
      title: item.name || "Novo pedido",
      detail: [item.service, item.event_date ? `evento ${dayMonthLabel(item.event_date)}` : ""].filter(Boolean).join(" • "),
    })),
    ...newBookings.map((item) => ({
      id: `b-${item.id}`,
      kind: "booking",
      createdAt: item.created_at,
      title: item.name || "Novo agendamento",
      detail: `${campaignTitle || "Ensaio"} • ${dayMonthLabel(localDateKey(item.starts_at))} às ${localTime(item.starts_at)} • ${item.package_photos} fotos${item.status === "aguardando_sinal" ? " • aguardando sinal" : ""}`,
    })),
    ...newResponses.map((item) => ({
      id: `s-${item.id}`,
      kind: item.status === "aprovado" ? "approved" : "declined",
      createdAt: item.responded_at,
      title: item.clientName || item.approved_name || "Cliente",
      detail: `${item.eventType || "Orçamento"} • ${item.status === "aprovado" ? "aprovou pelo link e já virou agendamento ✅" : `recusou${item.response_note ? `: ${item.response_note}` : ""}`}`,
    })),
  ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <div className="mb-6 overflow-hidden rounded-[28px] border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-amber-50 shadow-[0_18px_50px_rgba(180,120,20,0.12)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-amber-100 px-5 py-3">
        <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-amber-500 text-white">
          <Bell className="h-4 w-4" />
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold">{total}</span>
        </span>
        <p className="flex-1 text-sm font-semibold text-slate-900">
          {[
            newRequests.length ? `${newRequests.length} pedido${newRequests.length > 1 ? "s" : ""} de orçamento` : "",
            newBookings.length ? `${newBookings.length} agendamento${newBookings.length > 1 ? "s" : ""} novo${newBookings.length > 1 ? "s" : ""}` : "",
            newResponses.length ? `${newResponses.length} resposta${newResponses.length > 1 ? "s" : ""} de orçamento` : "",
          ].filter(Boolean).join(" e ")}
        </p>
        {newRequests.length ? (
          <button type="button" className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-amber-100" onClick={() => { onOpenRequests?.(); markSeen(); }}>
            <FileText className="h-3.5 w-3.5" />Ver pedidos
          </button>
        ) : null}
        {newBookings.length ? (
          <button type="button" className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-amber-100" onClick={() => { onOpenBookings?.(); markSeen(); }}>
            <CalendarCheck className="h-3.5 w-3.5" />Ver agendamentos
          </button>
        ) : null}
        <button type="button" title="Marcar como visto" className="rounded-full p-1.5 text-slate-500 hover:bg-amber-100" onClick={markSeen}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <ul className="divide-y divide-amber-100/70">
        {items.slice(0, 5).map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-5 py-2 text-sm">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.kind === "request" ? "bg-sky-100 text-sky-800" : item.kind === "declined" ? "bg-slate-100 text-slate-700" : item.kind === "approved" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
              {item.kind === "request" ? "Pedido" : item.kind === "approved" ? "Aprovado" : item.kind === "declined" ? "Recusado" : "Agendamento"}
            </span>
            <span className="font-medium text-slate-900">{item.title}</span>
            <span className="hidden truncate text-slate-500 sm:inline">{item.detail}</span>
            <span className="ml-auto shrink-0 text-xs text-slate-400">{timeAgo(item.createdAt)}</span>
          </li>
        ))}
        {items.length > 5 ? <li className="px-5 py-2 text-xs text-slate-500">e mais {items.length - 5}…</li> : null}
      </ul>
    </div>
  );
}
