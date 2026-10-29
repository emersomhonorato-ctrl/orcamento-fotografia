import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Pencil, Search, Undo2, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { photographerLabel } from "@/lib/team";

const brl = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const METHODS = ["Pix", "Dinheiro", "Cartão de crédito", "Cartão de débito", "Transferência", "Boleto", "Mercado Pago", "Outro"];

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function dateBR(key) {
  if (!key) return "";
  const [y, m, d] = String(key).slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : "";
}

function parseMoney(value) {
  const text = String(value ?? "").trim().replace(/[^\d,.-]/g, "");
  if (!text) return 0;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  return Math.round(Number(normalized) * 100) / 100 || 0;
}

const money = (value) => (Number(value || 0) ? Number(value).toFixed(2).replace(".", ",") : "");

// Situação financeira calculada a partir dos valores (não depende do campo digitado)
export function financeSituation(record, today = todayKey()) {
  const total = Number(record.computedAmount ?? record.amount ?? 0);
  const paid = Number(record.amountPaid || 0);
  const balance = Math.max(total - paid, 0);
  if (total <= 0) return { key: "semvalor", label: "Sem valor", total, paid, balance };
  if (balance <= 0.009) return { key: "pago", label: "Recebido", total, paid, balance: 0 };
  const past = record.eventDate && String(record.eventDate).slice(0, 10) < today;
  if (past || record.paymentStatus === "Atrasado") return { key: "atrasado", label: paid > 0 ? "Saldo em atraso" : "Em atraso", total, paid, balance };
  if (paid > 0) return { key: "parcial", label: "Entrada paga", total, paid, balance };
  return { key: "pendente", label: "A receber", total, paid, balance };
}

const BADGE = {
  pago: "bg-emerald-50 text-emerald-800 border-emerald-200",
  parcial: "bg-sky-50 text-sky-800 border-sky-200",
  pendente: "bg-amber-50 text-amber-800 border-amber-200",
  atrasado: "bg-rose-50 text-rose-800 border-rose-200",
  semvalor: "bg-stone-100 text-stone-600 border-stone-200",
};

// Histórico de recebimentos; se o valor pago foi mudado pela edição, ajusta para bater
function historyOf(record) {
  const paid = Math.round(Number(record.amountPaid || 0) * 100) / 100;
  const list = Array.isArray(record.payments) ? record.payments.filter((item) => Number(item?.amount) > 0) : [];
  const sum = Math.round(list.reduce((total, item) => total + Number(item.amount || 0), 0) * 100) / 100;
  if (list.length && Math.abs(sum - paid) < 0.01) return list;
  if (list.length && paid > sum) return [...list, { id: "ajuste", date: record.receiptDate || "", amount: Math.round((paid - sum) * 100) / 100, method: record.receiptMethod || "", note: "Ajuste feito na edição" }];
  return paid > 0 ? [{ id: "anterior", date: record.receiptDate || "", amount: paid, method: record.receiptMethod || "", note: "Valor já lançado antes" }] : [];
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export default function FinanceAdmin({ records = [], onUpdate, onEdit }) {
  const [view, setView] = useState("abertos");
  const [kind, setKind] = useState("fechados");
  const [period, setPeriod] = useState("todos");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("data");
  const [target, setTarget] = useState(null);
  const [draft, setDraft] = useState({ amount: "", date: todayKey(), method: "Pix", note: "" });
  const today = todayKey();

  const base = useMemo(() => records
    .filter((record) => record && record.status !== "Cancelado")
    .filter((record) => {
      if (kind === "fechados") return record.recordType === "evento" || record.status === "Aprovado";
      if (kind === "orcamentos") return record.recordType === "orcamento" && record.status !== "Aprovado";
      return true;
    })
    .map((record) => ({ ...record, fin: financeSituation(record, today) })), [records, kind, today]);

  const periods = useMemo(() => {
    const set = new Set(base.map((record) => String(record.eventDate || "").slice(0, 7)).filter((value) => /^\d{4}-\d{2}$/.test(value)));
    return [...set].sort().reverse();
  }, [base]);

  const inPeriod = useMemo(() => base.filter((record) => {
    if (period === "todos") return true;
    if (period === "semdata") return !record.eventDate;
    return String(record.eventDate || "").startsWith(period);
  }), [base, period]);

  const totals = useMemo(() => inPeriod.reduce((acc, record) => {
    acc.total += record.fin.total;
    acc.paid += record.fin.paid;
    acc.open += record.fin.balance;
    if (record.fin.key === "atrasado") { acc.late += record.fin.balance; acc.lateCount += 1; }
    if (record.fin.balance > 0) acc.openCount += 1;
    return acc;
  }, { total: 0, paid: 0, open: 0, late: 0, lateCount: 0, openCount: 0 }), [inPeriod]);

  const list = useMemo(() => {
    const text = query.trim().toLowerCase();
    const filtered = inPeriod.filter((record) => {
      if (view === "abertos" && !(record.fin.balance > 0 || record.fin.key === "semvalor")) return false;
      if (view === "atrasados" && record.fin.key !== "atrasado") return false;
      if (view === "pagos" && record.fin.key !== "pago") return false;
      if (!text) return true;
      return [record.clientName, record.eventType, record.location, record.notes].some((value) => String(value || "").toLowerCase().includes(text));
    });
    return filtered.sort((a, b) => {
      if (sort === "valor") return b.fin.balance - a.fin.balance || b.fin.total - a.fin.total;
      if (sort === "nome") return String(a.clientName || "").localeCompare(String(b.clientName || ""), "pt-BR");
      const ad = a.eventDate || "9999-99-99";
      const bd = b.eventDate || "9999-99-99";
      return view === "pagos" ? bd.localeCompare(ad) : ad.localeCompare(bd);
    });
  }, [inPeriod, view, query, sort]);

  function openReceive(record) {
    setTarget(record);
    setDraft({ amount: money(record.fin.balance), date: today, method: record.receiptMethod || "Pix", note: "" });
  }

  function saveReceive() {
    if (!targetFresh) return;
    const current = { ...targetFresh, fin: financeSituation(targetFresh, today) };
    const value = parseMoney(draft.amount);
    if (value <= 0) {
      alert("Informe o valor recebido.");
      return;
    }
    if (current.fin.total > 0 && value > current.fin.balance + 0.009 && !window.confirm(`O valor é maior que o saldo (${brl(current.fin.balance)}). Lançar mesmo assim?`)) return;
    const payments = [...historyOf(current), { id: crypto.randomUUID(), date: draft.date || today, amount: value, method: draft.method, note: draft.note.trim() }];
    applyPayments(current, payments);
    setTarget(null);
  }

  function applyPayments(record, payments) {
    const total = Number(record.fin.total || 0);
    const paid = Math.round(payments.reduce((sum, item) => sum + Number(item.amount || 0), 0) * 100) / 100;
    const last = payments[payments.length - 1];
    onUpdate(record.id, {
      payments,
      amountPaid: total > 0 ? Math.min(paid, total) : paid,
      paymentStatus: paid <= 0 ? "Pendente" : total > 0 && paid >= total - 0.009 ? "Pago" : "Entrada paga",
      receiptDate: last?.date || "",
      receiptMethod: last?.method || record.receiptMethod || "",
    });
  }

  function receiveAll(record) {
    if (!window.confirm(`Confirmar que ${record.clientName || "o cliente"} já pagou tudo (${brl(record.fin.total)})?`)) return;
    const history = historyOf(record);
    const payments = [...history, { id: crypto.randomUUID(), date: today, amount: record.fin.balance, method: record.receiptMethod || "Não informado", note: "Baixa total" }];
    applyPayments(record, payments);
  }

  function removePayment(record, paymentId) {
    if (!window.confirm("Remover este recebimento?")) return;
    const payments = historyOf(record).filter((item) => item.id !== paymentId);
    applyPayments(record, payments);
  }

  function exportCsv() {
    const header = ["Data", "Cliente", "Serviço", "Fotógrafo", "Valor total", "Recebido", "Saldo", "Situação", "Último recebimento", "Forma"];
    const rows = list.map((record) => [
      dateBR(record.eventDate), record.clientName, record.eventType, photographerLabel(record.photographer) || "",
      record.fin.total.toFixed(2).replace(".", ","), record.fin.paid.toFixed(2).replace(".", ","), record.fin.balance.toFixed(2).replace(".", ","),
      record.fin.label, dateBR(record.receiptDate), record.receiptMethod,
    ]);
    const csv = "﻿" + [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `financeiro-${today}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  }

  const targetFresh = target ? (records.find((item) => item.id === target.id) || target) : null;
  const targetHistory = targetFresh ? historyOf(targetFresh) : [];
  const targetFin = targetFresh ? financeSituation(targetFresh, today) : null;

  const VIEWS = [
    ["abertos", `A receber (${totals.openCount})`],
    ["atrasados", `Em atraso (${totals.lateCount})`],
    ["pagos", "Recebidos"],
    ["todos", "Todos"],
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Total negociado", totals.total, "text-stone-900"],
          ["Recebido", totals.paid, "text-emerald-700"],
          ["A receber", totals.open, "text-amber-700"],
          ["Em atraso", totals.late, "text-rose-700"],
        ].map(([label, value, color]) => (
          <Card key={label} className="rounded-2xl border-stone-200">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-stone-500">{label}</p>
              <p className={`mt-1 text-lg font-semibold sm:text-2xl ${color}`}>{brl(value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {VIEWS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setView(value)}
            className={`rounded-full border px-4 py-1.5 text-sm transition ${view === value ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex h-11 flex-1 items-center gap-3 rounded-xl border border-stone-200 bg-white px-4">
          <Search className="h-4 w-4 text-stone-500" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente, serviço ou local" className="border-0 p-0 shadow-none focus-visible:ring-0" />
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="h-11 w-[200px] rounded-xl border-stone-200 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="fechados">Trabalhos fechados</SelectItem>
              <SelectItem value="orcamentos">Orçamentos em aberto</SelectItem>
              <SelectItem value="tudo">Tudo (fechados + orçamentos)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-11 w-[170px] rounded-xl border-stone-200 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os meses</SelectItem>
              {periods.map((value) => {
                const [y, m] = value.split("-");
                const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
                return <SelectItem key={value} value={value}>{label.charAt(0).toUpperCase() + label.slice(1)}</SelectItem>;
              })}
              <SelectItem value="semdata">Sem data</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="h-11 w-[160px] rounded-xl border-stone-200 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="data">Por data</SelectItem>
              <SelectItem value="valor">Maior saldo</SelectItem>
              <SelectItem value="nome">Cliente A-Z</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" onClick={exportCsv} className="h-11 rounded-xl border-stone-200 bg-white">
            <Download className="mr-2 h-4 w-4" />Planilha
          </Button>
        </div>
      </div>

      {list.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-stone-300">
          <CardContent className="p-10 text-center text-sm text-stone-500">
            {view === "abertos" ? "Nenhum valor pendente com esses filtros. 🎉" : "Nada encontrado com esses filtros."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {list.map((record) => (
            <Card key={record.id} className="rounded-2xl border-stone-200">
              <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-stone-900">{record.clientName || "Sem nome"}</p>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${BADGE[record.fin.key]}`}>{record.fin.label}</span>
                    {record.recordType === "orcamento" ? <span className="rounded-full border border-stone-200 px-2.5 py-0.5 text-xs text-stone-500">Orçamento · {record.status}</span> : null}
                  </div>
                  <p className="mt-0.5 text-sm text-stone-500">
                    {[record.eventDate ? dateBR(record.eventDate) : "Sem data", record.eventType, photographerLabel(record.photographer)].filter(Boolean).join(" · ")}
                  </p>
                  {record.fin.paid > 0 && record.receiptDate ? (
                    <p className="mt-0.5 text-xs text-stone-400">Último recebimento em {dateBR(record.receiptDate)}{record.receiptMethod ? ` · ${record.receiptMethod}` : ""}</p>
                  ) : null}
                </div>
                <div className="grid grid-cols-3 gap-4 text-right text-sm lg:w-[360px]">
                  <div><p className="text-xs text-stone-400">Total</p><p className="font-medium text-stone-800">{brl(record.fin.total)}</p></div>
                  <div><p className="text-xs text-stone-400">Recebido</p><p className="font-medium text-emerald-700">{brl(record.fin.paid)}</p></div>
                  <div><p className="text-xs text-stone-400">Saldo</p><p className={`font-semibold ${record.fin.balance > 0 ? "text-rose-700" : "text-stone-400"}`}>{brl(record.fin.balance)}</p></div>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {record.fin.balance > 0 ? (
                    <>
                      <Button type="button" size="sm" onClick={() => openReceive(record)} className="studio-primary rounded-lg text-white">
                        <Wallet className="mr-1.5 h-4 w-4" />Dar baixa
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => receiveAll(record)} className="rounded-lg border-emerald-200 text-emerald-800 hover:bg-emerald-50">
                        <CheckCircle2 className="mr-1.5 h-4 w-4" />Já recebido
                      </Button>
                    </>
                  ) : (
                    <Button type="button" size="sm" variant="outline" onClick={() => openReceive(record)} className="rounded-lg border-stone-200">
                      Recebimentos
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="outline" onClick={() => onEdit(record)} className="rounded-lg border-stone-200">
                    <Pencil className="mr-1.5 h-4 w-4" />Editar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={Boolean(target)} onOpenChange={(open) => (!open ? setTarget(null) : null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Recebimentos — {targetFresh?.clientName || "cliente"}</DialogTitle>
          </DialogHeader>
          {targetFin ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-stone-50 p-3 text-center text-sm">
                <div><p className="text-xs text-stone-500">Total</p><p className="font-semibold">{brl(targetFin.total)}</p></div>
                <div><p className="text-xs text-stone-500">Recebido</p><p className="font-semibold text-emerald-700">{brl(targetFin.paid)}</p></div>
                <div><p className="text-xs text-stone-500">Saldo</p><p className={`font-semibold ${targetFin.balance > 0 ? "text-rose-700" : "text-stone-400"}`}>{brl(targetFin.balance)}</p></div>
              </div>
              {targetFin.total <= 0 ? (
                <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Este trabalho está sem valor. Use “Editar” para colocar o valor combinado.
                </p>
              ) : null}

              {targetHistory.length ? (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-stone-500">Já recebido</p>
                  <div className="divide-y divide-stone-100 rounded-xl border border-stone-200">
                    {targetHistory.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <div>
                          <p className="font-medium">{brl(item.amount)}</p>
                          <p className="text-xs text-stone-500">{[dateBR(item.date), item.method, item.note].filter(Boolean).join(" · ")}</p>
                        </div>
                        <button type="button" onClick={() => removePayment({ ...targetFresh, fin: targetFin }, item.id)} className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-rose-700" title="Desfazer este recebimento">
                          <Undo2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {targetFin.balance > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Valor recebido agora</Label>
                    <Input value={draft.amount} onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))} placeholder="0,00" inputMode="decimal" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data do recebimento</Label>
                    <Input type="date" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Forma</Label>
                    <Select value={draft.method} onValueChange={(value) => setDraft((current) => ({ ...current, method: value }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{METHODS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Observação</Label>
                    <Input value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Ex.: entrada, 2ª parcela" />
                  </div>
                </div>
              ) : targetFin.total > 0 ? (
                <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Este trabalho já está totalmente recebido.</p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTarget(null)}>Fechar</Button>
            {targetFin && targetFin.balance > 0 ? (
              <Button type="button" onClick={saveReceive} className="studio-primary text-white">Confirmar baixa</Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
