import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, Copy, Download, FileSpreadsheet, Link2, Lock, Pencil, Plus, RefreshCw, Save, Search, Trash2, Unlock, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/supabase";
import { formatDateBR } from "@/lib/delivery";
import templateUrl from "@/assets/am-modelo.xlsx?url";
import { buildReportWorkbook, itemCosts, nextTitle, reportFileName, reportTotals, sortItems } from "@/lib/amReport";

// Planilhas da AM Formaturas: lança os trabalhos do mês (com KM e despesas) e gera a planilha de pagamento.

const DEFAULT_TYPES = ["Fotoconvite", "Ensaio Fotoconvite", "Family Day", "Pré-evento", "Formatura", "AM - Missa"];

const emptyItem = { id: null, work_date: "", contract: "", place: "", event_type: "", amount: "", km: "", toll: "", food: "", event_id: null, event_label: null, note: "" };

function normalize(text) {
  return String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function num(value) {
  if (value === null || value === undefined) return 0;
  const text = String(value).trim().replace(/\s|R\$/g, "");
  if (!text) return 0;
  const clean = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  const n = Number(clean);
  return Number.isFinite(n) ? n : 0;
}

function brl(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function plain(value) {
  if (value === null || value === undefined || value === "" || Number(value) === 0) return "";
  return String(value).replace(".", ",");
}

function pad(n) {
  return String(n).padStart(3, "0");
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isAmEvent(event) {
  return /am formatura/.test(normalize(event?.clientName)) || /formatura am/.test(normalize(event?.eventType));
}

function eventText(event) {
  return [event.eventDate ? formatDateBR(event.eventDate) : "Sem data", event.eventType || "Trabalho", event.location].filter(Boolean).join(" · ");
}

function fromEvent(event) {
  return {
    work_date: event.eventDate || "",
    event_type: event.eventType || "",
    place: event.location || "",
    amount: plain(event.amount),
    event_id: String(event.id),
    event_label: eventText(event),
  };
}

function AgendaPicker({ events, value, label, onPick }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const q = normalize(query.trim());
    return events.filter((event) => !q || normalize(eventText(event)).includes(q)).slice(0, 10);
  }, [events, query]);

  if (value) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
        <Link2 className="h-4 w-4 shrink-0" />
        <span className="flex-1">{label || "Trabalho da agenda"}</span>
        <button type="button" className="text-xs font-semibold text-red-700 underline" onClick={() => onPick(null)}>Tirar</button>
      </div>
    );
  }
  if (!events.length) return <p className="text-xs text-slate-500">Nenhum trabalho da AM formaturas na agenda. Pode lançar direto.</p>;
  return (
    <div className="grid gap-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input className="pl-9" value={query} placeholder="Buscar na agenda da AM (data ou tipo)" onFocus={() => setOpen(true)} onChange={(e) => { setQuery(e.target.value); setOpen(true); }} />
      </div>
      {open ? (
        <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200">
          {matches.map((event) => (
            <button key={event.id} type="button" className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-slate-50" onClick={() => { onPick(event); setQuery(""); setOpen(false); }}>
              {eventText(event)}
            </button>
          ))}
          {!matches.length ? <p className="px-3 py-2 text-sm text-slate-500">Nada encontrado.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function ItemDialog({ value, onChange, onSave, onClose, saving, events, report, suggestions }) {
  const costs = itemCosts({ amount: num(value.amount), km: num(value.km), toll: num(value.toll), food: num(value.food) }, report);
  const field = (key) => ({ value: value[key] ?? "", onChange: (e) => onChange({ [key]: e.target.value }) });
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-3" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">{value.id ? "Editar trabalho" : "Lançar trabalho"}</h3>
          <button type="button" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Fechar"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Trabalho na agenda (opcional)</Label>
            <AgendaPicker
              events={events}
              value={value.event_id}
              label={value.event_label}
              onPick={(event) => onChange(event ? fromEvent(event) : { event_id: null, event_label: null })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label htmlFor="am-date">Data *</Label><Input id="am-date" type="date" {...field("work_date")} /></div>
            <div className="grid gap-1.5">
              <Label htmlFor="am-contract">Contrato</Label>
              <Input
                id="am-contract"
                list="am-contracts"
                placeholder="Ex.: 2683/2026"
                {...field("contract")}
                onBlur={() => {
                  const known = suggestions.byContract.get(String(value.contract || "").trim());
                  if (known && !value.place) onChange({ place: known });
                }}
              />
            </div>
          </div>
          <div className="grid gap-1.5"><Label htmlFor="am-place">Local</Label><Input id="am-place" list="am-places" placeholder="Ex.: MASTER. HALL" {...field("place")} /></div>
          <div className="grid gap-1.5">
            <Label htmlFor="am-type">Tipo de evento *</Label>
            <Input
              id="am-type"
              list="am-types"
              placeholder="Ex.: Fotoconvite"
              {...field("event_type")}
              onBlur={() => {
                const known = suggestions.amountByType.get(normalize(value.event_type));
                if (known && !num(value.amount)) onChange({ amount: plain(known) });
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label htmlFor="am-amount">Valor (R$) *</Label><Input id="am-amount" inputMode="decimal" placeholder="350" {...field("amount")} /></div>
            <div className="grid gap-1.5"><Label htmlFor="am-km">KM rodado</Label><Input id="am-km" inputMode="decimal" placeholder="0" {...field("km")} /></div>
            <div className="grid gap-1.5"><Label htmlFor="am-toll">Pedágio (R$)</Label><Input id="am-toll" inputMode="decimal" placeholder="0" {...field("toll")} /></div>
            <div className="grid gap-1.5"><Label htmlFor="am-food">Alimentação (R$)</Label><Input id="am-food" inputMode="decimal" placeholder="0" {...field("food")} /></div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
            <div className="flex justify-between"><span>Combustível</span><span>{brl(costs.fuel)}</span></div>
            <div className="flex justify-between"><span>Desgaste</span><span>{brl(costs.wear)}</span></div>
            <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 text-base font-semibold text-slate-900"><span>Total da linha</span><span>{brl(costs.total)}</span></div>
          </div>
          <div className="grid gap-1.5"><Label htmlFor="am-note">Observação (só para você, não vai na planilha)</Label><Input id="am-note" {...field("note")} /></div>
        </div>
        <datalist id="am-types">{suggestions.types.map((t) => <option key={t} value={t} />)}</datalist>
        <datalist id="am-places">{suggestions.places.map((t) => <option key={t} value={t} />)}</datalist>
        <datalist id="am-contracts">{suggestions.contracts.map((t) => <option key={t} value={t} />)}</datalist>
        <div className="mt-5 flex gap-2">
          <Button className="flex-1 rounded-2xl" onClick={onSave} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Salvando…" : "Salvar"}</Button>
          <Button variant="ghost" className="rounded-2xl" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </div>
  );
}

function ReportDialog({ value, onChange, onSave, onClose, saving }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">Relatório {pad(value.number)}</h3>
          <button type="button" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Fechar"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label htmlFor="am-title">Mês (título da planilha)</Label><Input id="am-title" value={value.title} onChange={(e) => onChange({ title: e.target.value.toUpperCase() })} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div className="grid gap-1.5"><Label htmlFor="am-fuel">Combustível R$/litro</Label><Input id="am-fuel" inputMode="decimal" value={value.fuel_price} onChange={(e) => onChange({ fuel_price: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label htmlFor="am-kml">KM por litro</Label><Input id="am-kml" inputMode="decimal" value={value.km_per_liter} onChange={(e) => onChange({ km_per_liter: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label htmlFor="am-wear">Desgaste R$/KM</Label><Input id="am-wear" inputMode="decimal" value={value.wear_per_km} onChange={(e) => onChange({ wear_per_km: e.target.value })} /></div>
          </div>
          <p className="text-xs text-slate-500">Combustível = KM ÷ KM por litro × preço do litro. Desgaste = KM × valor por KM.</p>
        </div>
        <div className="mt-5 flex gap-2">
          <Button className="flex-1 rounded-2xl" onClick={onSave} disabled={saving}><Save className="mr-2 h-4 w-4" />Salvar</Button>
          <Button variant="ghost" className="rounded-2xl" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </div>
  );
}

export default function AmReportsPanel({ events = [] }) {
  const [reports, setReports] = useState([]);
  const [items, setItems] = useState([]);
  const [linkedIds, setLinkedIds] = useState(new Set());
  const [allTypes, setAllTypes] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [state, setState] = useState("loading");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(null);
  const [reportForm, setReportForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [payment, setPayment] = useState("");
  const [paymentDraft, setPaymentDraft] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const amEvents = useMemo(
    () => events.filter((event) => isAmEvent(event) && !/cancel/i.test(event.status || "")).sort((a, b) => String(b.eventDate || "").localeCompare(String(a.eventDate || ""))),
    [events],
  );

  const loadItems = useCallback(async (reportId) => {
    if (!reportId) return setItems([]);
    const { data, error } = await supabase.from("am_items").select("*").eq("report_id", reportId);
    if (error) return setMessage(`Erro ao carregar: ${error.message}`);
    setItems(sortItems(data || []));
  }, []);

  const load = useCallback(async (keepId) => {
    const [repRes, linkRes, settingsRes] = await Promise.all([
      supabase.from("am_reports").select("*").order("number", { ascending: false }),
      supabase.from("am_items").select("event_id, event_type, amount, place, contract, created_at").order("created_at", { ascending: true }).limit(3000),
      supabase.from("studio_settings").select("am_payment_info").eq("id", 1).maybeSingle(),
    ]);
    if (repRes.error) {
      setState(/am_reports/.test(repRes.error.message) ? "missing" : "error");
      setMessage(repRes.error.message);
      return;
    }
    const list = repRes.data || [];
    setReports(list);
    setLinkedIds(new Set((linkRes.data || []).map((row) => row.event_id).filter(Boolean)));
    setAllTypes(linkRes.data || []);
    setPayment(settingsRes.data?.am_payment_info || "");
    const pick = (keepId && list.find((r) => r.id === keepId)) || list.find((r) => r.status === "aberto") || list[0];
    setSelectedId(pick?.id || "");
    await loadItems(pick?.id);
    setState("ok");
  }, [loadItems]);

  useEffect(() => {
    load();
  }, [load]);

  const report = reports.find((r) => r.id === selectedId) || null;
  const isOpen = report?.status === "aberto";
  const totals = useMemo(() => reportTotals(items, report), [items, report]);

  const suggestions = useMemo(() => {
    const types = new Map(DEFAULT_TYPES.map((t) => [normalize(t), t]));
    const amountByType = new Map();
    const places = new Map();
    const byContract = new Map();
    for (const row of allTypes) {
      if (row.event_type) {
        types.set(normalize(row.event_type), row.event_type);
        if (Number(row.amount)) amountByType.set(normalize(row.event_type), Number(row.amount));
      }
      if (row.place) places.set(normalize(row.place), row.place);
      if (row.contract && row.place) byContract.set(String(row.contract).trim(), row.place);
    }
    return {
      types: [...types.values()].sort((a, b) => a.localeCompare(b, "pt-BR")),
      places: [...places.values()].sort((a, b) => a.localeCompare(b, "pt-BR")),
      contracts: [...byContract.keys()].sort(),
      amountByType,
      byContract,
    };
  }, [allTypes]);

  const pendingAgenda = useMemo(() => {
    const today = todayKey();
    return amEvents.filter((event) => event.eventDate && event.eventDate <= today && !linkedIds.has(String(event.id))).slice(0, 12);
  }, [amEvents, linkedIds]);

  function openNew(extra = {}) {
    setMessage("");
    setForm({ ...emptyItem, work_date: todayKey(), ...extra });
  }

  function openEdit(item) {
    setForm({ ...emptyItem, ...item, amount: plain(item.amount), km: plain(item.km), toll: plain(item.toll), food: plain(item.food), note: item.note || "" });
  }

  function duplicate(item) {
    setForm({ ...emptyItem, ...item, id: null, event_id: null, event_label: null, amount: plain(item.amount), km: "", toll: "", food: "", note: "" });
  }

  async function saveItem() {
    if (!form || !report) return;
    if (!form.work_date) return setMessage("Informe a data do trabalho.");
    if (!String(form.event_type || "").trim()) return setMessage("Informe o tipo de evento.");
    setSaving(true);
    const payload = {
      report_id: report.id,
      work_date: form.work_date,
      contract: String(form.contract || "").trim() || null,
      place: String(form.place || "").trim().toUpperCase() || null,
      event_type: String(form.event_type || "").trim(),
      amount: num(form.amount),
      km: num(form.km),
      toll: num(form.toll),
      food: num(form.food),
      event_id: form.event_id || null,
      event_label: form.event_label || null,
      note: String(form.note || "").trim() || null,
      updated_at: new Date().toISOString(),
    };
    const res = form.id
      ? await supabase.from("am_items").update(payload).eq("id", form.id)
      : await supabase.from("am_items").insert(payload);
    setSaving(false);
    if (res.error) return setMessage(`Erro ao salvar: ${res.error.message}`);
    setForm(null);
    setMessage(form.id ? "Trabalho atualizado." : "Trabalho lançado.");
    await load(report.id);
  }

  async function removeItem(item) {
    if (!window.confirm(`Apagar ${item.event_type} de ${formatDateBR(item.work_date)} da planilha?`)) return;
    const { error } = await supabase.from("am_items").delete().eq("id", item.id);
    if (error) return setMessage(`Erro ao apagar: ${error.message}`);
    await load(report.id);
  }

  async function saveReport() {
    if (!reportForm) return;
    setSaving(true);
    const { error } = await supabase.from("am_reports").update({
      title: String(reportForm.title || "").trim() || report.title,
      fuel_price: num(reportForm.fuel_price) || 6.3,
      km_per_liter: num(reportForm.km_per_liter) || 10,
      wear_per_km: num(reportForm.wear_per_km),
    }).eq("id", reportForm.id);
    setSaving(false);
    if (error) return setMessage(`Erro ao salvar: ${error.message}`);
    setReportForm(null);
    await load(reportForm.id);
  }

  async function download() {
    if (!report) return;
    setDownloading(true);
    try {
      const [{ default: ExcelJS }, template] = await Promise.all([
        import("exceljs"),
        fetch(templateUrl).then((res) => {
          if (!res.ok) throw new Error("modelo da planilha não encontrado");
          return res.arrayBuffer();
        }),
      ]);
      const wb = await buildReportWorkbook(ExcelJS, report, items, payment, template);
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = reportFileName(report);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (error) {
      setMessage(`Não consegui gerar a planilha: ${error.message}`);
    }
    setDownloading(false);
  }

  async function closeReport() {
    if (!report) return;
    const next = (Math.max(...reports.map((r) => r.number)) || report.number) + 1;
    const title = nextTitle(report.title);
    if (!window.confirm(`Fechar o relatório ${pad(report.number)} - ${report.title}?\n\nEle fica guardado (dá para baixar e reabrir depois) e abre o ${pad(next)} - ${title} para os próximos trabalhos.`)) return;
    setSaving(true);
    const closeRes = await supabase.from("am_reports").update({ status: "fechado", closed_at: new Date().toISOString() }).eq("id", report.id);
    if (closeRes.error) {
      setSaving(false);
      return setMessage(`Erro ao fechar: ${closeRes.error.message}`);
    }
    const hasOpen = reports.some((r) => r.status === "aberto" && r.id !== report.id);
    let newId = null;
    if (!hasOpen) {
      const ins = await supabase.from("am_reports").insert({ number: next, title, fuel_price: report.fuel_price, km_per_liter: report.km_per_liter, wear_per_km: report.wear_per_km }).select("id").single();
      if (ins.error) setMessage(`Fechado, mas não consegui abrir o próximo: ${ins.error.message}`);
      newId = ins.data?.id || null;
    }
    setSaving(false);
    setMessage(`Relatório ${pad(report.number)} fechado.${newId ? ` Agora os trabalhos entram no ${pad(next)} - ${title}.` : ""}`);
    await load(newId || report.id);
  }

  async function reopenReport() {
    if (!report || !window.confirm(`Reabrir o relatório ${pad(report.number)} para corrigir?`)) return;
    const { error } = await supabase.from("am_reports").update({ status: "aberto", closed_at: null }).eq("id", report.id);
    if (error) return setMessage(`Erro: ${error.message}`);
    await load(report.id);
  }

  async function newReport() {
    const next = (reports.length ? Math.max(...reports.map((r) => r.number)) : 0) + 1;
    const title = reports.length ? nextTitle(reports[0].title) : nextTitle("");
    const { data, error } = await supabase.from("am_reports").insert({ number: next, title }).select("id").single();
    if (error) return setMessage(`Erro: ${error.message}`);
    await load(data.id);
  }

  async function savePayment() {
    const value = String(paymentDraft || "").trim();
    const { error } = await supabase.from("studio_settings").upsert({ id: 1, am_payment_info: value || null, updated_at: new Date().toISOString() });
    if (error) return setMessage(`Erro ao salvar: ${error.message}`);
    setPayment(value);
    setPaymentDraft(null);
    setMessage("Dados de pagamento salvos.");
  }

  if (state === "loading") return <p className="p-6 text-sm text-slate-500">Carregando planilhas da AM…</p>;
  if (state === "missing") return <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">Falta atualizar o banco (supabase/am-planilhas.sql).</p>;
  if (state === "error") return <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">Erro ao carregar: {message}</p>;

  return (
    <div className="space-y-4">
      <Card className="studio-panel rounded-3xl border-0 bg-white/90 shadow-sm">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold"><FileSpreadsheet className="h-5 w-5" />Planilhas AM Formaturas</h2>
              <p className="text-sm text-slate-500">Lance cada trabalho; no fim do período, baixe a planilha de pagamento e feche o relatório.</p>
            </div>
            <div className="flex items-center gap-2">
              <select aria-label="Relatório" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold" value={selectedId} onChange={async (e) => { setSelectedId(e.target.value); setMessage(""); await loadItems(e.target.value); }}>
                {reports.map((r) => <option key={r.id} value={r.id}>{pad(r.number)} - {r.title}{r.status === "fechado" ? " (fechado)" : ""}</option>)}
              </select>
              <button type="button" className="rounded-full p-2 text-slate-500 hover:bg-slate-100" title="Atualizar" aria-label="Atualizar" onClick={() => load(selectedId)}><RefreshCw className="h-4 w-4" /></button>
            </div>
          </div>

          {!report ? (
            <Button className="rounded-2xl" onClick={newReport}><Plus className="mr-2 h-4 w-4" />Começar o primeiro relatório</Button>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isOpen ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-800"}`}>{isOpen ? "Aberto: recebendo trabalhos" : `Fechado em ${formatDateBR(String(report.closed_at || "").slice(0, 10))}`}</span>
                <span className="text-xs text-slate-500">Combustível {brl(report.fuel_price)}/L · {String(report.km_per_liter).replace(".", ",")} km/L · desgaste {brl(report.wear_per_km)}/km</span>
                {isOpen ? <button type="button" className="text-xs font-semibold text-slate-700 underline" onClick={() => setReportForm({ ...report, fuel_price: plain(report.fuel_price), km_per_liter: plain(report.km_per_liter), wear_per_km: plain(report.wear_per_km) })}><Pencil className="mr-1 inline h-3 w-3" />Editar mês e valores</button> : null}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Trabalhos</p><p className="text-xl font-semibold">{totals.count}</p></div>
                <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Valores</p><p className="text-xl font-semibold">{brl(totals.amount)}</p></div>
                <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs text-slate-500">KM + alimentação</p><p className="text-xl font-semibold">{brl(totals.travel + totals.food)}</p><p className="text-[11px] text-slate-500">{totals.km.toLocaleString("pt-BR")} km rodados</p></div>
                <div className="rounded-2xl bg-[#1b1610] p-3 text-white"><p className="text-xs text-white/70">Total geral</p><p className="text-xl font-semibold">{brl(totals.total)}</p></div>
              </div>

              <div className="flex flex-wrap gap-2">
                {isOpen ? <Button className="rounded-2xl" onClick={() => openNew()}><Plus className="mr-2 h-4 w-4" />Lançar trabalho</Button> : null}
                <Button variant="outline" className="rounded-2xl" onClick={download} disabled={downloading || !items.length}><Download className="mr-2 h-4 w-4" />{downloading ? "Gerando…" : "Baixar planilha (.xlsx)"}</Button>
                {isOpen ? (
                  <Button variant="outline" className="rounded-2xl" onClick={closeReport} disabled={saving || !items.length}><Lock className="mr-2 h-4 w-4" />Fechar relatório</Button>
                ) : (
                  <Button variant="outline" className="rounded-2xl" onClick={reopenReport}><Unlock className="mr-2 h-4 w-4" />Reabrir</Button>
                )}
              </div>
            </>
          )}
          {message ? <p className="rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-700">{message}</p> : null}
        </CardContent>
      </Card>

      {isOpen && pendingAgenda.length ? (
        <Card className="rounded-3xl border border-amber-200 bg-amber-50/70 shadow-none">
          <CardContent className="space-y-2 pt-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-950"><CalendarCheck className="h-4 w-4" />Na agenda da AM e ainda não lançados</p>
            <div className="flex flex-wrap gap-2">
              {pendingAgenda.map((event) => (
                <button key={event.id} type="button" className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-left text-sm hover:bg-amber-100" onClick={() => openNew(fromEvent(event))}>
                  {eventText(event)} <span className="font-semibold text-amber-900">· Lançar</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {report ? (
        <Card className="studio-panel rounded-3xl border-0 bg-white/90 shadow-sm">
          <CardContent className="pt-6">
            {!items.length ? (
              <p className="py-6 text-center text-sm text-slate-500">Nenhum trabalho lançado neste relatório ainda.</p>
            ) : (
              <>
                <div className="space-y-2 sm:hidden">
                  {items.map((item) => {
                    const c = itemCosts(item, report);
                    return (
                      <div key={item.id} className="rounded-2xl border border-slate-200 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">{item.event_type}</p>
                            <p className="text-xs text-slate-500">{formatDateBR(item.work_date)} · {item.place || "—"}{item.contract ? ` · ${item.contract}` : ""}</p>
                          </div>
                          <p className="font-semibold">{brl(c.total)}</p>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">Valor {brl(item.amount)}{Number(item.km) ? ` · ${item.km} km (${brl(c.fuel + c.wear)})` : ""}{Number(item.toll) ? ` · pedágio ${brl(item.toll)}` : ""}{Number(item.food) ? ` · alim. ${brl(item.food)}` : ""}</p>
                        {item.event_id ? <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700"><Link2 className="h-3 w-3" />Ligado à agenda</p> : null}
                        {isOpen ? (
                          <div className="mt-2 flex gap-3 text-xs font-semibold">
                            <button type="button" className="text-slate-700 underline" onClick={() => openEdit(item)}>Editar</button>
                            <button type="button" className="text-slate-700 underline" onClick={() => duplicate(item)}>Duplicar</button>
                            <button type="button" className="text-red-700 underline" onClick={() => removeItem(item)}>Apagar</button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="py-2 pr-2">Data</th><th className="pr-2">Contrato</th><th className="pr-2">Local</th><th className="pr-2">Tipo</th>
                        <th className="pr-2 text-right">Valor</th><th className="pr-2 text-right">KM</th><th className="pr-2 text-right">Pedágio</th><th className="pr-2 text-right">Combust.</th><th className="pr-2 text-right">Desgaste</th><th className="pr-2 text-right">Alim.</th><th className="pr-2 text-right">Total</th><th />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const c = itemCosts(item, report);
                        return (
                          <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                            <td className="py-2 pr-2 whitespace-nowrap">{formatDateBR(item.work_date)}</td>
                            <td className="pr-2 font-semibold">{item.contract || "—"}</td>
                            <td className="pr-2">{item.place || "—"}</td>
                            <td className="pr-2 font-medium">{item.event_type}{item.event_id ? <Link2 className="ml-1 inline h-3 w-3 text-emerald-700" aria-label="Ligado à agenda" /> : null}</td>
                            <td className="pr-2 text-right whitespace-nowrap">{brl(item.amount)}</td>
                            <td className="pr-2 text-right">{Number(item.km) || "—"}</td>
                            <td className="pr-2 text-right whitespace-nowrap">{Number(item.toll) ? brl(item.toll) : "—"}</td>
                            <td className="pr-2 text-right whitespace-nowrap">{c.fuel ? brl(c.fuel) : "—"}</td>
                            <td className="pr-2 text-right whitespace-nowrap">{c.wear ? brl(c.wear) : "—"}</td>
                            <td className="pr-2 text-right whitespace-nowrap">{Number(item.food) ? brl(item.food) : "—"}</td>
                            <td className="pr-2 text-right font-semibold whitespace-nowrap">{brl(c.total)}</td>
                            <td className="whitespace-nowrap text-right">
                              {isOpen ? (
                                <>
                                  <button type="button" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" title="Editar" aria-label="Editar" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></button>
                                  <button type="button" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" title="Duplicar (mesmo dia/contrato)" aria-label="Duplicar" onClick={() => duplicate(item)}><Copy className="h-4 w-4" /></button>
                                  <button type="button" className="rounded-full p-1.5 text-red-600 hover:bg-red-50" title="Apagar" aria-label="Apagar" onClick={() => removeItem(item)}><Trash2 className="h-4 w-4" /></button>
                                </>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 font-semibold">
                        <td colSpan={4} className="py-2">Total geral</td>
                        <td className="pr-2 text-right">{brl(totals.amount)}</td>
                        <td className="pr-2 text-right">{totals.km.toLocaleString("pt-BR")}</td>
                        <td colSpan={4} className="pr-2 text-right text-slate-500">desp. {brl(totals.travel + totals.food)}</td>
                        <td className="pr-2 text-right">{brl(totals.total)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card className="studio-panel rounded-3xl border-0 bg-white/90 shadow-sm">
        <CardContent className="space-y-3 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold">Dados para pagamento (rodapé da planilha)</h3>
              <p className="text-sm text-slate-500">Uma informação por linha, no formato <em>Rótulo -&gt; valor</em> (ex.: Banco -&gt; …).</p>
            </div>
            {paymentDraft === null ? <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setPaymentDraft(payment)}><Pencil className="mr-2 h-4 w-4" />Editar</Button> : null}
          </div>
          {paymentDraft !== null ? (
            <div className="space-y-2">
              <Textarea className="min-h-[140px] rounded-2xl font-mono text-sm" value={paymentDraft} placeholder={"Nome do Titular -> \nBanco -> \nConta -> \nAgência -> \nCPF do Titular -> \nPIX -> "} onChange={(e) => setPaymentDraft(e.target.value)} />
              <div className="flex gap-2">
                <Button className="rounded-2xl" onClick={savePayment}><Save className="mr-2 h-4 w-4" />Salvar</Button>
                <Button variant="ghost" className="rounded-2xl" onClick={() => setPaymentDraft(null)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">{payment ? `${payment.split(/\r?\n/).filter(Boolean).length} linha(s) preenchida(s).` : "Ainda não preenchido: a planilha sai sem os dados bancários."}</p>
          )}
        </CardContent>
      </Card>

      {form ? (
        <ItemDialog
          value={form}
          onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
          onSave={saveItem}
          onClose={() => setForm(null)}
          saving={saving}
          events={amEvents}
          report={report}
          suggestions={suggestions}
        />
      ) : null}
      {reportForm ? (
        <ReportDialog value={reportForm} onChange={(patch) => setReportForm((current) => ({ ...current, ...patch }))} onSave={saveReport} onClose={() => setReportForm(null)} saving={saving} />
      ) : null}
    </div>
  );
}
