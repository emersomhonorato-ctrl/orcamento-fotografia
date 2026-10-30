import { useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Download, History, Pencil, Plus, Repeat, Trash2, Undo2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { historyOf } from "@/lib/finance";

export const EXPENSE_TYPES = {
  fixa: { label: "Fixa", plural: "Contas fixas", tone: "bg-sky-50 text-sky-800 border-sky-200" },
  variavel: { label: "Variável", plural: "Contas variáveis", tone: "bg-amber-50 text-amber-800 border-amber-200" },
  investimento: { label: "Investimento", plural: "Investimentos", tone: "bg-violet-50 text-violet-800 border-violet-200" },
};
const CATEGORIES = {
  fixa: ["Aluguel", "Energia", "Internet", "Água", "Telefone", "Condomínio", "Contador", "Sistemas e assinaturas", "Pró-labore", "Outros"],
  variavel: ["Impressão e revelação", "Álbuns", "Combustível", "Alimentação", "Assistente / 2º fotógrafo", "Taxas de cartão", "Impostos", "Manutenção", "Material de cenário", "Marketing e anúncios", "Outros"],
  investimento: ["Câmera e lentes", "Iluminação", "Computador", "Cenários e móveis", "Cursos", "Reforma do estúdio", "Outros"],
};
const METHODS = ["Pix", "Boleto", "Débito automático", "Cartão de crédito", "Cartão de débito", "Dinheiro", "Transferência", "Outro"];

const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pad = (n) => String(n).padStart(2, "0");
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const dateBR = (key) => {
  const [y, m, d] = String(key || "").slice(0, 10).split("-");
  return d ? `${d}/${m}/${y}` : "";
};
const monthKeyOf = (key) => String(key || "").slice(0, 7);
const addMonths = (monthKey, delta) => {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const monthLabel = (monthKey) => {
  const [y, m] = monthKey.split("-").map(Number);
  const text = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return text.charAt(0).toUpperCase() + text.slice(1);
};
function parseMoney(value) {
  const text = String(value ?? "").trim().replace(/[^\d,.-]/g, "");
  if (!text) return 0;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  return Math.round(Number(normalized) * 100) / 100 || 0;
}
const money = (v) => (Number(v || 0) ? Number(v).toFixed(2).replace(".", ",") : "");
const dueInMonth = (monthKey, day) => {
  const [y, m] = monthKey.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${monthKey}-${pad(Math.min(Math.max(Number(day) || 1, 1), last))}`;
};

// Contas fixas viram uma conta por mês (desde o mês de início); as já lançadas ficam como estão
export function expensesForMonth(expenses = [], monthKey) {
  const real = expenses.filter((item) => item.kind !== "modelo" && monthKeyOf(item.dueDate) === monthKey);
  const templates = expenses.filter((item) => item.kind === "modelo" && !item.archived);
  const virtual = templates
    .filter((t) => t.startMonth <= monthKey && (!t.endMonth || t.endMonth >= monthKey))
    .filter((t) => !real.some((item) => item.templateId === t.id))
    .filter((t) => !(t.skippedMonths || []).includes(monthKey))
    .map((t) => ({
      id: `v-${t.id}-${monthKey}`,
      virtual: true,
      templateId: t.id,
      type: "fixa",
      description: t.description,
      category: t.category,
      amount: t.amount,
      dueDate: dueInMonth(monthKey, t.dayOfMonth),
      status: "pendente",
      method: t.method || "",
      notes: t.notes || "",
    }));
  return [...real, ...virtual].sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)) || String(a.description).localeCompare(String(b.description)));
}

const EMPTY = { id: null, type: "variavel", description: "", category: "", amount: "", dueDate: todayKey(), paid: false, paidDate: todayKey(), method: "Pix", notes: "", installments: "1", recurring: false, dayOfMonth: "10", startMonth: monthKeyOf(todayKey()) };

export default function ExpensesAdmin({ expenses = [], records = [], onChange }) {
  const [month, setMonth] = useState(monthKeyOf(todayKey()));
  const [filter, setFilter] = useState("todas");
  const [form, setForm] = useState(null);
  const [paying, setPaying] = useState(null);
  const [payDraft, setPayDraft] = useState({ amount: "", date: todayKey(), method: "Pix" });
  const [showTemplates, setShowTemplates] = useState(false);
  const today = todayKey();

  const monthList = useMemo(() => expensesForMonth(expenses, month), [expenses, month]);
  const templates = useMemo(() => expenses.filter((item) => item.kind === "modelo"), [expenses]);
  const shown = monthList.filter((item) => {
    if (filter === "todas") return true;
    if (filter === "apagar") return item.status !== "pago";
    if (filter === "pagas") return item.status === "pago";
    return item.type === filter;
  });

  const totals = monthList.reduce((acc, item) => {
    const value = Number(item.status === "pago" ? item.paidAmount ?? item.amount : item.amount) || 0;
    acc.total += value;
    acc[item.type] = (acc[item.type] || 0) + value;
    if (item.status === "pago") acc.paid += value;
    else {
      acc.open += value;
      if (item.dueDate < today) { acc.late += value; acc.lateCount += 1; }
    }
    return acc;
  }, { total: 0, paid: 0, open: 0, late: 0, lateCount: 0 });

  const received = useMemo(() => records
    .filter((record) => record && record.status !== "Cancelado")
    .reduce((sum, record) => sum + historyOf(record).filter((p) => monthKeyOf(p.date) === month).reduce((s, p) => s + Number(p.amount || 0), 0), 0), [records, month]);

  // Contas fixas de meses anteriores que ficaram sem baixa
  const pendingPast = useMemo(() => {
    const out = [];
    const current = monthKeyOf(today);
    templates.filter((t) => !t.archived).forEach((t) => {
      let m = t.startMonth;
      let guard = 0;
      while (m < current && guard < 60) {
        if (!expenses.some((item) => item.templateId === t.id && monthKeyOf(item.dueDate) === m) && !(t.skippedMonths || []).includes(m)) out.push({ t, m });
        m = addMonths(m, 1);
        guard += 1;
      }
    });
    return out;
  }, [templates, expenses, today]);

  function save(next) {
    onChange(next.map((item) => ({ ...item, updatedAt: item.updatedAt || new Date().toISOString() })));
  }

  function openNew(type = "variavel") {
    setForm({ ...EMPTY, type, category: CATEGORIES[type][0], recurring: type === "fixa" });
  }

  function openEdit(item) {
    if (item.virtual || item.kind === "modelo") {
      const t = item.kind === "modelo" ? item : templates.find((x) => x.id === item.templateId);
      if (!t) return;
      setForm({ ...EMPTY, id: t.id, type: "fixa", recurring: true, description: t.description, category: t.category, amount: money(t.amount), dayOfMonth: String(t.dayOfMonth || 10), startMonth: t.startMonth, endMonth: t.endMonth || "", method: t.method || "Pix", notes: t.notes || "", editingTemplate: true });
      return;
    }
    setForm({ ...EMPTY, ...item, amount: money(item.amount), paid: item.status === "pago", paidDate: item.paidDate || today, installments: "1", recurring: false });
  }

  function submitForm() {
    const value = parseMoney(form.amount);
    if (!form.description.trim()) return alert("Informe a descrição da conta.");
    if (value <= 0) return alert("Informe o valor.");
    const now = new Date().toISOString();

    if (form.type === "fixa" && form.recurring) {
      const template = {
        id: form.editingTemplate ? form.id : crypto.randomUUID(),
        kind: "modelo",
        type: "fixa",
        description: form.description.trim(),
        category: form.category,
        amount: value,
        dayOfMonth: Number(form.dayOfMonth) || 10,
        startMonth: form.startMonth || monthKeyOf(today),
        endMonth: form.endMonth || "",
        method: form.method,
        notes: form.notes.trim(),
        updatedAt: now,
      };
      const exists = expenses.some((item) => item.id === template.id);
      save(exists ? expenses.map((item) => (item.id === template.id ? { ...item, ...template } : item)) : [...expenses, { ...template, createdAt: now }]);
      setForm(null);
      return;
    }

    if (form.id && !form.editingTemplate) {
      save(expenses.map((item) => (item.id === form.id ? {
        ...item,
        type: form.type,
        description: form.description.trim(),
        category: form.category,
        amount: value,
        dueDate: form.dueDate,
        status: form.paid ? "pago" : "pendente",
        paidDate: form.paid ? form.paidDate : "",
        paidAmount: form.paid ? value : undefined,
        method: form.method,
        notes: form.notes.trim(),
        updatedAt: now,
      } : item)));
      setForm(null);
      return;
    }

    const n = Math.max(1, Math.min(48, Number(form.installments) || 1));
    const group = n > 1 ? crypto.randomUUID() : undefined;
    const parcel = Math.round((value / n) * 100) / 100;
    const created = Array.from({ length: n }, (_, i) => {
      const due = i === 0 ? form.dueDate : `${addMonths(monthKeyOf(form.dueDate), i)}-${form.dueDate.slice(8, 10)}`;
      const amount = i === n - 1 ? Math.round((value - parcel * (n - 1)) * 100) / 100 : parcel;
      const paidNow = form.paid && i === 0;
      return {
        id: crypto.randomUUID(),
        kind: "conta",
        type: form.type,
        description: n > 1 ? `${form.description.trim()} (${i + 1}/${n})` : form.description.trim(),
        category: form.category,
        amount,
        dueDate: dueInMonth(monthKeyOf(due), due.slice(8, 10)),
        status: paidNow ? "pago" : "pendente",
        paidDate: paidNow ? form.paidDate : "",
        paidAmount: paidNow ? amount : undefined,
        method: form.method,
        notes: form.notes.trim(),
        installmentGroup: group,
        createdAt: now,
        updatedAt: now,
      };
    });
    save([...expenses, ...created]);
    setMonth(monthKeyOf(form.dueDate));
    setForm(null);
  }

  function openPay(item) {
    setPaying(item);
    setPayDraft({ amount: money(item.amount), date: item.dueDate < today ? item.dueDate : today, method: item.method || "Pix" });
  }

  function confirmPay() {
    const value = parseMoney(payDraft.amount);
    if (value <= 0) return alert("Informe o valor pago.");
    const now = new Date().toISOString();
    if (paying.virtual) {
      save([...expenses, {
        id: crypto.randomUUID(), kind: "conta", templateId: paying.templateId, type: "fixa", description: paying.description, category: paying.category,
        amount: value, dueDate: paying.dueDate, status: "pago", paidDate: payDraft.date, paidAmount: value, method: payDraft.method, notes: paying.notes || "", createdAt: now, updatedAt: now,
      }]);
    } else {
      save(expenses.map((item) => (item.id === paying.id ? { ...item, status: "pago", paidDate: payDraft.date, paidAmount: value, amount: item.amount || value, method: payDraft.method, updatedAt: now } : item)));
    }
    setPaying(null);
  }

  function undoPay(item) {
    if (!window.confirm("Desfazer o pagamento desta conta?")) return;
    if (item.templateId) save(expenses.filter((x) => x.id !== item.id));
    else save(expenses.map((x) => (x.id === item.id ? { ...x, status: "pendente", paidDate: "", paidAmount: undefined, updatedAt: new Date().toISOString() } : x)));
  }

  function remove(item) {
    if (item.virtual) {
      if (!window.confirm(`Pular "${item.description}" em ${monthLabel(month)}? (a conta fixa continua nos outros meses)`)) return;
      save(expenses.map((t) => (t.id === item.templateId ? { ...t, skippedMonths: [...(t.skippedMonths || []), month] } : t)));
      return;
    }
    if (!window.confirm(`Excluir "${item.description}"?`)) return;
    save(expenses.filter((x) => x.id !== item.id));
  }

  function payAllPast() {
    if (!pendingPast.length) return;
    if (!window.confirm(`Marcar ${pendingPast.length} conta(s) fixa(s) de meses anteriores como pagas, com o valor e o dia de vencimento de cada uma?`)) return;
    const now = new Date().toISOString();
    save([...expenses, ...pendingPast.map(({ t, m }) => ({
      id: crypto.randomUUID(), kind: "conta", templateId: t.id, type: "fixa", description: t.description, category: t.category,
      amount: t.amount, dueDate: dueInMonth(m, t.dayOfMonth), status: "pago", paidDate: dueInMonth(m, t.dayOfMonth), paidAmount: t.amount,
      method: t.method || "", notes: "Lançado como pago (retroativo)", createdAt: now, updatedAt: now,
    }))]);
  }

  function removeTemplate(t) {
    if (!window.confirm(`Encerrar a conta fixa "${t.description}"? Os pagamentos já lançados continuam no histórico.`)) return;
    save(expenses.map((x) => (x.id === t.id ? { ...x, archived: true, endMonth: monthKeyOf(today) } : x)));
  }

  function exportCsv() {
    const rows = monthList.map((item) => [dateBR(item.dueDate), item.description, EXPENSE_TYPES[item.type]?.label, item.category, money(item.amount), item.status === "pago" ? "Pago" : "A pagar", dateBR(item.paidDate), item.method || ""]);
    const head = ["Vencimento", "Descrição", "Tipo", "Categoria", "Valor", "Situação", "Pago em", "Forma"];
    const cell = (v) => (/[;"\n]/.test(String(v ?? "")) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ""));
    const csv = "﻿" + [head, ...rows].map((r) => r.map(cell).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `contas-a-pagar-${month}.csv`;
    a.click();
  }

  const status = (item) => {
    if (item.status === "pago") return ["Paga", "bg-emerald-50 text-emerald-800 border-emerald-200"];
    if (item.dueDate < today) return ["Vencida", "bg-rose-50 text-rose-800 border-rose-200"];
    if (item.dueDate === today) return ["Vence hoje", "bg-amber-50 text-amber-800 border-amber-200"];
    return ["A pagar", "bg-stone-100 text-stone-700 border-stone-200"];
  };
  const result = received - totals.paid;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Mês anterior" onClick={() => setMonth((m) => addMonths(m, -1))} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"><ChevronLeft className="h-4 w-4" /></button>
          <h2 className="min-w-[11rem] text-center text-lg font-semibold text-stone-900">{monthLabel(month)}</h2>
          <button type="button" aria-label="Próximo mês" onClick={() => setMonth((m) => addMonths(m, 1))} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"><ChevronRight className="h-4 w-4" /></button>
          {month !== monthKeyOf(today) ? <button type="button" onClick={() => setMonth(monthKeyOf(today))} className="text-sm text-stone-500 underline-offset-4 hover:underline">Hoje</button> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => openNew("variavel")} className="studio-primary rounded-xl text-white"><Plus className="mr-1.5 h-4 w-4" />Nova conta</Button>
          <Button type="button" variant="outline" onClick={() => openNew("fixa")} className="rounded-xl border-stone-200 bg-white"><Repeat className="mr-1.5 h-4 w-4" />Conta fixa</Button>
          <Button type="button" variant="outline" onClick={() => setForm({ ...EMPTY, type: "variavel", category: CATEGORIES.variavel[0], paid: true, dueDate: `${addMonths(monthKeyOf(today), -1)}-10`, paidDate: `${addMonths(monthKeyOf(today), -1)}-10`, retro: true })} className="rounded-xl border-stone-200 bg-white"><History className="mr-1.5 h-4 w-4" />Lançar pagamento antigo</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ["Contas do mês", totals.total, "text-stone-900"],
          ["Pago", totals.paid, "text-emerald-700"],
          ["A pagar", totals.open, "text-amber-700"],
          ["Vencidas", totals.late, "text-rose-700"],
          ["Resultado (recebido − pago)", result, result >= 0 ? "text-emerald-700" : "text-rose-700"],
        ].map(([label, value, color]) => (
          <Card key={label} className="rounded-2xl border-stone-200">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-stone-500">{label}</p>
              <p className={`mt-1 text-lg font-semibold sm:text-2xl ${color}`}>{brl(value)}</p>
              {label.startsWith("Resultado") ? <p className="mt-0.5 text-[11px] text-stone-400">Recebido no mês: {brl(received)}</p> : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {Object.entries(EXPENSE_TYPES).map(([key, info]) => (
          <div key={key} className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3">
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${info.tone}`}>{info.plural}</span>
            <span className="font-semibold text-stone-900">{brl(totals[key] || 0)}</span>
          </div>
        ))}
      </div>

      {pendingPast.length ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-amber-900">
            <strong>{pendingPast.length} conta(s) fixa(s)</strong> de meses anteriores sem baixa ({[...new Set(pendingPast.map((x) => monthLabel(x.m)))].slice(0, 3).join(", ")}{pendingPast.length > 3 ? "…" : ""}).
          </p>
          <Button type="button" size="sm" onClick={payAllPast} className="rounded-lg bg-amber-700 text-white hover:bg-amber-800"><CheckCircle2 className="mr-1.5 h-4 w-4" />Marcar todas como pagas</Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {[["todas", "Todas"], ["apagar", "A pagar"], ["pagas", "Pagas"], ["fixa", "Fixas"], ["variavel", "Variáveis"], ["investimento", "Investimentos"]].map(([value, label]) => (
          <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full border px-4 py-1.5 text-sm transition ${filter === value ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"}`}>{label}</button>
        ))}
        <span className="flex-1" />
        <button type="button" onClick={() => setShowTemplates((v) => !v)} className="text-sm text-stone-600 underline-offset-4 hover:underline">{showTemplates ? "Ocultar" : "Ver"} contas fixas cadastradas ({templates.filter((t) => !t.archived).length})</button>
        <Button type="button" variant="outline" size="sm" onClick={exportCsv} className="rounded-lg border-stone-200 bg-white"><Download className="mr-1.5 h-4 w-4" />Planilha</Button>
      </div>

      {showTemplates ? (
        <Card className="rounded-2xl border-stone-200">
          <CardContent className="divide-y divide-stone-100 p-0">
            {templates.length ? templates.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-stone-900">{t.description} {t.archived ? <span className="text-xs text-stone-400">(encerrada)</span> : null}</p>
                  <p className="text-xs text-stone-500">{t.category} · {brl(t.amount)} · vence todo dia {t.dayOfMonth} · desde {monthLabel(t.startMonth)}{t.endMonth ? ` até ${monthLabel(t.endMonth)}` : ""}</p>
                </div>
                {!t.archived ? (
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => openEdit(t)}><Pencil className="mr-1 h-3.5 w-3.5" />Editar</Button>
                    <Button type="button" variant="outline" size="sm" className="rounded-lg text-rose-700" onClick={() => removeTemplate(t)}>Encerrar</Button>
                  </div>
                ) : null}
              </div>
            )) : <p className="p-4 text-sm text-stone-500">Nenhuma conta fixa ainda. Use “Conta fixa” para cadastrar aluguel, energia, internet…</p>}
          </CardContent>
        </Card>
      ) : null}

      {shown.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-stone-300">
          <CardContent className="p-10 text-center text-sm text-stone-500">Nenhuma conta em {monthLabel(month)} com esse filtro.</CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {shown.map((item) => {
            const [label, tone] = status(item);
            const info = EXPENSE_TYPES[item.type] || EXPENSE_TYPES.variavel;
            return (
              <Card key={item.id} className="rounded-2xl border-stone-200">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-stone-900">{item.description}</p>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${info.tone}`}>{info.label}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}>{label}</span>
                      {item.templateId ? <Repeat className="h-3.5 w-3.5 text-stone-400" aria-label="Conta fixa" /> : null}
                    </div>
                    <p className="mt-0.5 text-sm text-stone-500">
                      {[item.category, `vence ${dateBR(item.dueDate)}`, item.status === "pago" ? `pago em ${dateBR(item.paidDate)}${item.method ? ` · ${item.method}` : ""}` : ""].filter(Boolean).join(" · ")}
                    </p>
                    {item.notes ? <p className="mt-0.5 text-xs text-stone-400">{item.notes}</p> : null}
                  </div>
                  <p className="text-lg font-semibold text-stone-900 sm:w-32 sm:text-right">{brl(item.status === "pago" ? item.paidAmount ?? item.amount : item.amount)}</p>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {item.status === "pago" ? (
                      <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={() => undoPay(item)}><Undo2 className="mr-1 h-4 w-4" />Desfazer</Button>
                    ) : (
                      <Button type="button" size="sm" className="studio-primary rounded-lg text-white" onClick={() => openPay(item)}><CheckCircle2 className="mr-1 h-4 w-4" />Pagar</Button>
                    )}
                    <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={() => openEdit(item)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                    <Button type="button" size="sm" variant="outline" className="rounded-lg text-rose-700" onClick={() => remove(item)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(form)} onOpenChange={(open) => (!open ? setForm(null) : null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form?.editingTemplate ? "Editar conta fixa" : form?.id ? "Editar conta" : form?.retro ? "Lançar pagamento antigo" : form?.type === "fixa" ? "Nova conta fixa" : "Nova conta"}</DialogTitle>
          </DialogHeader>
          {form ? (
            <div className="space-y-3">
              {!form.editingTemplate ? (
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(EXPENSE_TYPES).map(([key, info]) => (
                    <button key={key} type="button" onClick={() => setForm((f) => ({ ...f, type: key, category: CATEGORIES[key][0], recurring: key === "fixa" && !f.retro && !f.id }))} className={`rounded-xl border px-2 py-2 text-sm ${form.type === key ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white text-stone-700"}`}>{info.label}</button>
                  ))}
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Descrição</Label>
                  <Input value={form.description} onChange={(e) => {
                    const text = e.target.value;
                    const norm = (v) => String(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    const guess = CATEGORIES[form.type].find((c) => c !== "Outros" && norm(text).includes(norm(c).split(" ")[0]));
                    setForm((f) => ({ ...f, description: text, category: guess || f.category }));
                  }} placeholder="Ex.: Aluguel do estúdio, Lente 85mm…" />
                </div>
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES[form.type].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{form.type === "fixa" && form.recurring ? "Valor mensal" : "Valor total"}</Label>
                  <Input value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0,00" inputMode="decimal" />
                </div>
              </div>

              {form.type === "fixa" && !form.id && !form.retro ? (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.recurring} onChange={(e) => setForm((f) => ({ ...f, recurring: e.target.checked }))} />
                  Repetir todo mês (aluguel, energia, internet…)
                </label>
              ) : null}

              {form.type === "fixa" && form.recurring ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Vence todo dia</Label>
                    <Input type="number" min="1" max="31" value={form.dayOfMonth} onChange={(e) => setForm((f) => ({ ...f, dayOfMonth: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Desde o mês</Label>
                    <Input type="month" value={form.startMonth} onChange={(e) => setForm((f) => ({ ...f, startMonth: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Até (opcional)</Label>
                    <Input type="month" value={form.endMonth || ""} onChange={(e) => setForm((f) => ({ ...f, endMonth: e.target.value }))} />
                  </div>
                  <p className="text-xs text-stone-500 sm:col-span-3">Para lançar meses passados, coloque o mês de início lá atrás: os meses anteriores aparecem para dar baixa (um a um ou todos de uma vez).</p>
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Vencimento</Label>
                      <Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value, paidDate: f.retro ? e.target.value : f.paidDate }))} />
                    </div>
                    {!form.id && form.type === "investimento" ? (
                      <div className="space-y-1.5">
                        <Label>Parcelas</Label>
                        <Input type="number" min="1" max="48" value={form.installments} onChange={(e) => setForm((f) => ({ ...f, installments: e.target.value }))} />
                      </div>
                    ) : null}
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.paid} onChange={(e) => setForm((f) => ({ ...f, paid: e.target.checked }))} />
                    Já foi paga{Number(form.installments) > 1 ? " (a 1ª parcela)" : ""}
                  </label>
                  {form.paid ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Pago em</Label>
                        <Input type="date" value={form.paidDate} onChange={(e) => setForm((f) => ({ ...f, paidDate: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Forma</Label>
                        <Select value={form.method} onValueChange={(v) => setForm((f) => ({ ...f, method: v }))}>
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
              <div className="space-y-1.5">
                <Label>Observação</Label>
                <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button type="button" className="studio-primary text-white" onClick={submitForm}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(paying)} onOpenChange={(open) => (!open ? setPaying(null) : null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pagar — {paying?.description}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Valor pago</Label>
              <Input value={payDraft.amount} onChange={(e) => setPayDraft((d) => ({ ...d, amount: e.target.value }))} inputMode="decimal" />
            </div>
            <div className="space-y-1.5">
              <Label>Pago em</Label>
              <Input type="date" value={payDraft.date} onChange={(e) => setPayDraft((d) => ({ ...d, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Forma</Label>
              <Select value={payDraft.method} onValueChange={(v) => setPayDraft((d) => ({ ...d, method: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {paying?.templateId ? <p className="text-xs text-stone-500 sm:col-span-2">Contas como energia mudam todo mês: ajuste o valor acima se veio diferente.</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPaying(null)}>Cancelar</Button>
            <Button type="button" className="studio-primary text-white" onClick={confirmPay}>Confirmar pagamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
