import { useState } from "react";
import { AlarmClock, CalendarCheck, Clock3, Trash2 } from "lucide-react";
import { supabase } from "@/supabase";
import { dayMonthLabel, formatBRL, localDateKey, localTime } from "@/lib/bookings";

// Reserva aguardando sinal cujo prazo de pagamento já venceu (o app não exclui sozinho: você decide)
export function paymentDeadline(booking, campaign) {
  const hours = Number(campaign?.payment_hold_hours ?? 24);
  if (!(hours > 0)) return null;
  const base = new Date(booking.hold_extended_at || booking.created_at).getTime();
  return Number.isFinite(base) ? new Date(base + hours * 3600000) : null;
}

export function overdueBookings(bookings = [], campaign = null, now = Date.now()) {
  return bookings.filter((booking) => {
    if (booking.status !== "aguardando_sinal") return false;
    const deadline = paymentDeadline(booking, campaign);
    return deadline && deadline.getTime() <= now && new Date(booking.starts_at).getTime() > now - 86400000;
  });
}

export default function OverdueBookingsAlert({ bookings = [], campaign = null, onChanged, onOpenBookings }) {
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  // eslint-disable-next-line react-hooks/purity -- comparação com a hora atual a cada atualização da lista
  const overdue = overdueBookings(bookings, campaign, Date.now());
  if (!overdue.length) return null;
  const hours = Number(campaign?.payment_hold_hours ?? 24);

  async function extend(booking) {
    setBusyId(booking.id);
    setMessage("");
    const { error } = await supabase.from("bookings").update({ hold_extended_at: new Date().toISOString() }).eq("id", booking.id);
    setBusyId("");
    if (error) return setMessage(`Não foi possível dar mais prazo: ${error.message}`);
    setMessage(`${booking.name}: mais ${hours} horas para pagar o sinal.`);
    onChanged?.();
  }

  async function remove(booking) {
    if (!window.confirm(`Excluir o agendamento de ${booking.name} (${dayMonthLabel(localDateKey(booking.starts_at))} às ${localTime(booking.starts_at)})?\n\nO sinal não foi pago e o horário volta a ficar livre para outra pessoa.`)) return;
    setBusyId(booking.id);
    setMessage("");
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelado", canceled_at: new Date().toISOString(), canceled_reason: "Sinal não pago — excluído pelo estúdio" })
      .eq("id", booking.id)
      .eq("status", "aguardando_sinal");
    if (!error) {
      await supabase.from("booking_slots").update({ status: "livre" }).in("id", [booking.slot_id, booking.is_double ? booking.second_slot_id : null].filter(Boolean));
    }
    setBusyId("");
    if (error) return setMessage(`Não foi possível excluir: ${error.message}`);
    setMessage(`Agendamento de ${booking.name} excluído e horário liberado.`);
    onChanged?.();
  }

  return (
    <div className="mb-6 overflow-hidden rounded-[28px] border border-red-200 bg-red-50/70 shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-red-100 px-5 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white"><AlarmClock className="h-4 w-4" /></span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-900">{overdue.length === 1 ? "1 agendamento com o prazo do sinal vencido" : `${overdue.length} agendamentos com o prazo do sinal vencido`}</p>
          <p className="text-xs text-red-800">O horário continua reservado até você decidir: cobrar, dar mais prazo ou excluir.</p>
        </div>
        {onOpenBookings ? (
          <button type="button" className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-red-100" onClick={onOpenBookings}>
            <CalendarCheck className="h-3.5 w-3.5" />Abrir Ensaios (cobrar sinal)
          </button>
        ) : null}
      </div>
      <ul className="divide-y divide-red-100">
        {overdue.map((booking) => {
          const deadline = paymentDeadline(booking, campaign);
          return (
            <li key={booking.id} className="flex flex-wrap items-center gap-2 px-5 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">{booking.name}{booking.is_double ? " • 1 hora" : ""}</p>
                <p className="text-xs text-slate-600">
                  {dayMonthLabel(localDateKey(booking.starts_at))} às {localTime(booking.starts_at)} • sinal {formatBRL(booking.deposit_amount)} • {booking.whatsapp}
                  {deadline ? ` • venceu ${deadline.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}
                </p>
              </div>
              <button type="button" disabled={busyId === booking.id} onClick={() => extend(booking)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50">
                <Clock3 className="h-3.5 w-3.5" />Dar mais {hours}h
              </button>
              <button type="button" disabled={busyId === booking.id} onClick={() => remove(booking)} className="inline-flex items-center gap-1 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                <Trash2 className="h-3.5 w-3.5" />Excluir agendamento
              </button>
            </li>
          );
        })}
      </ul>
      {message ? <p className="border-t border-red-100 px-5 py-2 text-xs text-slate-700">{message}</p> : null}
    </div>
  );
}
