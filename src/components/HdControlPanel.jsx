import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, HardDrive, Pencil, Plus, RefreshCw, Save, Search, Trash2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/supabase";
import { formatDateBR } from "@/lib/delivery";

// Controle dos HDs: em qual disco está cada trabalho, quanto espaço sobra e a numeração das pastas.

const NUMBER_START = 32;
const HD_COLORS = [
  "bg-blue-100 text-blue-900",
  "bg-violet-100 text-violet-900",
  "bg-orange-100 text-orange-900",
  "bg-slate-200 text-slate-900",
  "bg-emerald-100 text-emerald-900",
  "bg-pink-100 text-pink-900",
];

const emptyWork = { id: null, hd: "", number: "", folder: "", name: "", size_gb: "", file_count: "", modified_on: "", is_work: true, note: "" };
const emptyDisk = { id: null, name: "", capacity: "", capacityUnit: "GB", used_gb: "", measured_on: "", notes: "" };

function gb(value) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (n >= 1000) return `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} TB`;
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB`;
}

function intBR(value) {
  if (value === null || value === undefined || value === "") return "—";
  return Number(value).toLocaleString("pt-BR");
}

function num(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().replace(/\./g, "").replace(",", ".");
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function pad(n) {
  return String(n).padStart(3, "0");
}

function normalize(text) {
  return String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function baseName(work) {
  return normalize(work.name).replace(/^\s*\d+\s*-?\s*/, "").replace(/[^a-z0-9]/g, "");
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function numberingSummary(works) {
  const byNumber = new Map();
  const outOfSequence = [];
  for (const work of works) {
    if (!work.is_work) continue;
    if (work.number === null || work.number === undefined) {
      outOfSequence.push(work);
      continue;
    }
    const list = byNumber.get(work.number) || [];
    list.push(work);
    byNumber.set(work.number, list);
  }
  const numbers = [...byNumber.keys()];
  const max = numbers.length ? Math.max(...numbers) : NUMBER_START - 1;
  const missing = [];
  for (let n = NUMBER_START; n <= max; n += 1) if (!byNumber.has(n)) missing.push(n);
  const shared = [...byNumber.entries()].filter(([, list]) => list.length > 1).sort((a, b) => a[0] - b[0]);
  // Mesmo nome em mais de um HD = cópia (backup). Nomes diferentes = número repetido de verdade.
  const isCopy = (list) => new Set(list.map(baseName)).size === 1;
  const duplicates = shared.filter(([, list]) => !isCopy(list));
  const copies = shared.filter(([, list]) => isCopy(list));
  const single = byNumber.size - duplicates.length;
  return { next: max + 1, missing, duplicates, copies, single, outOfSequence };
}

function DiskCard({ disk, stats, colorClass, onEdit }) {
  const capacity = Number(disk.capacity_gb) || 0;
  const used = Number(disk.used_gb) || 0;
  const pct = capacity > 0 ? Math.min(100, Math.round((used / capacity) * 100)) : null;
  const full = pct !== null && pct >= 90;
  return (
    <div className="flex flex-col gap-2.5 rounded-3xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-lg px-2.5 py-1 text-base font-bold ${colorClass}`}>{disk.name}</span>
        <div className="flex items-center gap-1">
          {pct !== null ? (
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${full ? "bg-red-100 text-red-800" : pct >= 75 ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>{pct}% cheio</span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">sem capacidade</span>
          )}
          <button type="button" onClick={onEdit} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label={`Editar ${disk.name}`}><Pencil className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${full ? "bg-red-600" : pct >= 75 ? "bg-amber-500" : "bg-emerald-600"}`} style={{ width: `${pct || 0}%` }} />
      </div>
      <p className="text-xs text-slate-600">
        {pct !== null ? `${gb(used)} de ${gb(capacity)} usados • ${gb(Math.max(0, capacity - used))} livres` : "Informe a capacidade para ver o %"}
      </p>
      <div className="flex gap-4 text-sm text-slate-700">
        <span><strong className="text-base text-slate-900">{stats.works}</strong> trabalhos</span>
        <span><strong className="text-base text-slate-900">{stats.size ? gb(stats.size) : "—"}</strong> listados</span>
      </div>
      <p className="text-[11px] text-slate-500">{disk.measured_on ? `Medido em ${formatDateBR(disk.measured_on)}` : "Ainda não medido"}{disk.notes ? ` • ${disk.notes}` : ""}</p>
    </div>
  );
}

function DiskDialog({ value, onChange, onSave, onDelete, onClose, saving, canDelete }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" onClick={onClose}>
      <div className="max-h-full w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">{value.id ? `Editar ${value.name}` : "Novo HD"}</h3>
          <button type="button" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Fechar"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="hd-name">Nome</Label>
            <Input id="hd-name" value={value.name} placeholder="Ex.: HD5" onChange={(event) => onChange({ name: event.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="hd-capacity">Capacidade</Label>
            <div className="flex gap-2">
              <Input id="hd-capacity" inputMode="decimal" value={value.capacity} placeholder="Ex.: 2" onChange={(event) => onChange({ capacity: event.target.value })} />
              <select aria-label="Unidade" className="rounded-xl border border-slate-200 bg-white px-3 text-sm" value={value.capacityUnit} onChange={(event) => onChange({ capacityUnit: event.target.value })}>
                <option value="GB">GB</option>
                <option value="TB">TB</option>
              </select>
            </div>
            <p className="text-[11px] text-slate-500">Pode escrever como vem na caixa (ex.: 2 TB); o app converte para o espaço real.</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="hd-used">Espaço usado (GB)</Label>
            <Input id="hd-used" inputMode="decimal" value={value.used_gb} placeholder="Opcional" onChange={(event) => onChange({ used_gb: event.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="hd-measured">Medido em</Label>
            <Input id="hd-measured" type="date" value={value.measured_on || ""} onChange={(event) => onChange({ measured_on: event.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="hd-notes">Observação</Label>
            <Input id="hd-notes" value={value.notes || ""} placeholder="Ex.: fica no armário do estúdio" onChange={(event) => onChange({ notes: event.target.value })} />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button className="flex-1 rounded-2xl" onClick={onSave} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Salvando..." : "Salvar"}</Button>
          {value.id && canDelete ? (
            <Button variant="outline" className="rounded-2xl text-red-700" onClick={onDelete} disabled={saving}><Trash2 className="mr-2 h-4 w-4" />Excluir</Button>
          ) : null}
        </div>
        {value.id && !canDelete ? <p className="mt-2 text-[11px] text-slate-500">Para excluir este HD, mova ou apague antes os trabalhos dele.</p> : null}
      </div>
    </div>
  );
}

function WorkDialog({ value, disks, onChange, onSave, onDelete, onClose, saving, nextNumber }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" onClick={onClose}>
      <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">{value.id ? "Editar trabalho" : "Novo trabalho"}</h3>
          <button type="button" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Fechar"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="work-hd">HD</Label>
            <select id="work-hd" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" value={value.hd} onChange={(event) => onChange({ hd: event.target.value })}>
              <option value="">Escolha…</option>
              {disks.map((disk) => <option key={disk.id} value={disk.name}>{disk.name}</option>)}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="work-number">Nº da pasta</Label>
            <Input id="work-number" inputMode="numeric" value={value.number} placeholder={`Próximo livre: ${pad(nextNumber)}`} onChange={(event) => onChange({ number: event.target.value.replace(/\D/g, "") })} />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="work-name">Nome da pasta</Label>
            <Input id="work-name" value={value.name} placeholder={`Ex.: ${pad(nextNumber)} - Maria Gestante`} onChange={(event) => onChange({ name: event.target.value })} />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="work-folder">Dentro da pasta</Label>
            <Input id="work-folder" value={value.folder} placeholder="Ex.: 00 - Estudio 2026 (vazio = direto no HD)" onChange={(event) => onChange({ folder: event.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="work-size">Tamanho (GB)</Label>
            <Input id="work-size" inputMode="decimal" value={value.size_gb} onChange={(event) => onChange({ size_gb: event.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="work-files">Nº de arquivos</Label>
            <Input id="work-files" inputMode="numeric" value={value.file_count} onChange={(event) => onChange({ file_count: event.target.value.replace(/\D/g, "") })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="work-date">Última mudança</Label>
            <Input id="work-date" type="date" value={value.modified_on || ""} onChange={(event) => onChange({ modified_on: event.target.value })} />
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4" checked={!value.is_work} onChange={(event) => onChange({ is_work: !event.target.checked })} />
            Não é trabalho (pasta vazia, catálogo…)
          </label>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="work-note">Observação</Label>
            <Input id="work-note" value={value.note || ""} onChange={(event) => onChange({ note: event.target.value })} />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button className="flex-1 rounded-2xl" onClick={onSave} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Salvando..." : "Salvar"}</Button>
          {value.id ? <Button variant="outline" className="rounded-2xl text-red-700" onClick={onDelete} disabled={saving}><Trash2 className="mr-2 h-4 w-4" />Excluir</Button> : null}
        </div>
      </div>
    </div>
  );
}

export default function HdControlPanel() {
  const [disks, setDisks] = useState([]);
  const [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("trabalhos");
  const [hdFilter, setHdFilter] = useState("Todos");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [diskForm, setDiskForm] = useState(null);
  const [workForm, setWorkForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [diskRes, workRes] = await Promise.all([
      supabase.from("hd_disks").select("*").order("sort").order("name"),
      supabase.from("hd_works").select("*").order("number", { ascending: false, nullsFirst: false }).order("name").limit(5000),
    ]);
    if (diskRes.error || workRes.error) {
      const message = (diskRes.error || workRes.error).message || "";
      setError(/hd_disks|hd_works|relation|schema cache/i.test(message) ? "A tabela dos HDs ainda não foi criada no banco." : message);
    } else {
      setDisks(diskRes.data || []);
      setWorks(workRes.data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const colorOf = useMemo(() => {
    const map = {};
    disks.forEach((disk, index) => { map[disk.name] = HD_COLORS[index % HD_COLORS.length]; });
    return (name) => map[name] || HD_COLORS[3];
  }, [disks]);

  const statsByDisk = useMemo(() => {
    const stats = {};
    for (const work of works) {
      const s = stats[work.hd] || (stats[work.hd] = { works: 0, size: 0 });
      if (work.is_work) s.works += 1;
      s.size += Number(work.size_gb) || 0;
    }
    return stats;
  }, [works]);

  const numbering = useMemo(() => numberingSummary(works), [works]);
  const duplicateNumbers = useMemo(() => new Set(numbering.duplicates.map(([n]) => n)), [numbering]);
  const copyWhere = useMemo(() => {
    const map = new Map();
    for (const [, list] of numbering.copies) for (const work of list) map.set(work.id, list.filter((other) => other.id !== work.id).map((other) => other.hd).join(", "));
    return map;
  }, [numbering]);

  const fullDisks = disks.filter((disk) => Number(disk.capacity_gb) > 0 && Number(disk.used_gb) / Number(disk.capacity_gb) >= 0.9);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return works.filter((work) => {
      if (hdFilter !== "Todos" && work.hd !== hdFilter) return false;
      if (!showAll && !work.is_work) return false;
      if (!q) return true;
      return normalize(`${work.name} ${work.folder} ${work.note} ${work.number ?? ""}`).includes(q);
    });
  }, [works, hdFilter, query, showAll]);

  function openNewWork() {
    setWorkForm({ ...emptyWork, hd: hdFilter !== "Todos" ? hdFilter : "", number: String(numbering.next), modified_on: todayKey() });
  }

  function openWork(work) {
    setWorkForm({
      ...emptyWork,
      ...work,
      number: work.number ?? "",
      size_gb: work.size_gb ?? "",
      file_count: work.file_count ?? "",
      folder: work.folder === "(raiz)" ? "" : work.folder || "",
      note: work.note || "",
    });
  }

  function openDisk(disk) {
    if (!disk) {
      setDiskForm({ ...emptyDisk, name: `HD${disks.length + 1}`, capacityUnit: "TB" });
      return;
    }
    setDiskForm({ ...emptyDisk, ...disk, capacity: disk.capacity_gb ?? "", capacityUnit: "GB", used_gb: disk.used_gb ?? "", measured_on: disk.measured_on || "", notes: disk.notes || "" });
  }

  async function saveDisk() {
    const name = diskForm.name.trim().toUpperCase().replace(/\s+/g, "");
    if (!name) { alert("Dê um nome ao HD (ex.: HD5)."); return; }
    if (disks.some((disk) => disk.name === name && disk.id !== diskForm.id)) { alert(`Já existe um ${name}.`); return; }
    const capacity = num(diskForm.capacity);
    const row = {
      name,
      capacity_gb: capacity === null ? null : diskForm.capacityUnit === "TB" ? Math.round(capacity * 931.32) : capacity,
      used_gb: num(diskForm.used_gb),
      measured_on: diskForm.measured_on || null,
      notes: diskForm.notes?.trim() || null,
    };
    setSaving(true);
    const result = diskForm.id
      ? await supabase.from("hd_disks").update(row).eq("id", diskForm.id)
      : await supabase.from("hd_disks").insert({ ...row, sort: disks.length + 1 });
    setSaving(false);
    if (result.error) { alert(`Não foi possível salvar: ${result.error.message}`); return; }
    setDiskForm(null);
    load();
  }

  async function deleteDisk() {
    if (!confirm(`Excluir o ${diskForm.name} da lista?`)) return;
    setSaving(true);
    const result = await supabase.from("hd_disks").delete().eq("id", diskForm.id);
    setSaving(false);
    if (result.error) { alert(`Não foi possível excluir: ${result.error.message}`); return; }
    setDiskForm(null);
    load();
  }

  async function saveWork() {
    if (!workForm.hd) { alert("Escolha o HD."); return; }
    if (!workForm.name.trim()) { alert("Escreva o nome da pasta."); return; }
    const number = workForm.number === "" ? null : Number(workForm.number);
    const clash = number !== null && workForm.is_work ? works.find((work) => work.is_work && work.number === number && work.id !== workForm.id) : null;
    if (clash && !confirm(`O nº ${pad(number)} já é usado por "${clash.name}" (${clash.hd}). Salvar mesmo assim?`)) return;
    const row = {
      hd: workForm.hd,
      number,
      folder: workForm.folder.trim() || "(raiz)",
      name: workForm.name.trim(),
      size_gb: num(workForm.size_gb),
      file_count: workForm.file_count === "" ? null : Number(workForm.file_count),
      modified_on: workForm.modified_on || null,
      is_work: workForm.is_work,
      note: workForm.note.trim() || null,
      updated_at: new Date().toISOString(),
    };
    setSaving(true);
    const result = workForm.id
      ? await supabase.from("hd_works").update(row).eq("id", workForm.id)
      : await supabase.from("hd_works").insert(row);
    setSaving(false);
    if (result.error) { alert(`Não foi possível salvar: ${result.error.message}`); return; }
    setWorkForm(null);
    load();
  }

  async function deleteWork() {
    if (!confirm(`Excluir "${workForm.name}" da lista? (Os arquivos no HD não são apagados.)`)) return;
    setSaving(true);
    const result = await supabase.from("hd_works").delete().eq("id", workForm.id);
    setSaving(false);
    if (result.error) { alert(`Não foi possível excluir: ${result.error.message}`); return; }
    setWorkForm(null);
    load();
  }

  if (loading && !disks.length && !error) {
    return <Card className="rounded-3xl"><CardContent className="p-6 text-sm text-slate-500">Carregando os HDs…</CardContent></Card>;
  }

  if (error) {
    return (
      <Card className="rounded-3xl">
        <CardContent className="space-y-3 p-6">
          <p className="text-sm font-semibold text-slate-900">Não foi possível abrir o controle dos HDs</p>
          <p className="text-sm text-slate-600">{error}</p>
          <Button variant="outline" className="rounded-2xl" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Tentar de novo</Button>
        </CardContent>
      </Card>
    );
  }

  const latest = disks.map((disk) => disk.measured_on).filter(Boolean).sort().pop();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900"><HardDrive className="h-5 w-5" />HDs</h2>
          <p className="text-sm text-slate-600">Onde está cada trabalho{latest ? ` • última medição em ${formatDateBR(latest)}` : ""}</p>
        </div>
        <Button className="rounded-2xl" onClick={openNewWork}><Plus className="mr-2 h-4 w-4" />Novo trabalho</Button>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Seções dos HDs">
        {[["trabalhos", "Trabalhos"], ["numeracao", "Numeração"]].map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={view === value}
            onClick={() => setView(value)}
            className={`min-h-10 rounded-full px-4 text-sm font-semibold ${view === value ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {disks.map((disk) => (
          <DiskCard key={disk.id} disk={disk} stats={statsByDisk[disk.name] || { works: 0, size: 0 }} colorClass={colorOf(disk.name)} onEdit={() => openDisk(disk)} />
        ))}
        <button type="button" onClick={() => openDisk(null)} className="flex min-h-40 flex-col items-center justify-center gap-1 rounded-3xl border-2 border-dashed border-slate-300 p-4 text-slate-700 hover:bg-white">
          <Plus className="h-6 w-6" />
          <span className="text-sm font-bold">Novo HD</span>
          <span className="text-xs text-slate-500">Nome e capacidade (ex.: HD5, 2 TB)</span>
        </button>
      </div>

      {fullDisks.length || numbering.duplicates.length ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong className="flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" />Atenção</strong>
          {fullDisks.map((disk) => (
            <span key={disk.id}>{disk.name} com só {gb(Math.max(0, Number(disk.capacity_gb) - Number(disk.used_gb)))} livres</span>
          ))}
          {numbering.duplicates.length ? (
            <button type="button" className="underline" onClick={() => setView("numeracao")}>{numbering.duplicates.length} número{numbering.duplicates.length === 1 ? "" : "s"} repetido{numbering.duplicates.length === 1 ? "" : "s"}</button>
          ) : null}
          <span>Próximo número livre: <strong>{pad(numbering.next)}</strong></span>
        </div>
      ) : null}

      {view === "trabalhos" ? (
        <Card className="rounded-3xl">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="relative min-w-56 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input aria-label="Buscar trabalho" className="pl-9" value={query} placeholder="Buscar por nome ou número" onChange={(event) => setQuery(event.target.value)} />
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por HD">
                {["Todos", ...disks.map((disk) => disk.name)].map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setHdFilter(name)}
                    className={`min-h-10 rounded-xl border px-3 text-sm font-semibold ${hdFilter === name ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"}`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-slate-600">
                    <th className="px-3 py-2 font-semibold">HD</th>
                    <th className="px-3 py-2 font-semibold">Nº</th>
                    <th className="px-3 py-2 font-semibold">Trabalho</th>
                    <th className="px-3 py-2 font-semibold">Pasta</th>
                    <th className="px-3 py-2 text-right font-semibold">Tamanho</th>
                    <th className="px-3 py-2 text-right font-semibold">Arquivos</th>
                    <th className="px-3 py-2 font-semibold">Última mudança</th>
                    <th className="px-3 py-2 font-semibold">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((work) => {
                    const repeated = work.is_work && duplicateNumbers.has(work.number);
                    return (
                      <tr key={work.id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50" onClick={() => openWork(work)}>
                        <td className="px-3 py-2"><span className={`rounded-md px-2 py-0.5 text-xs font-bold ${colorOf(work.hd)}`}>{work.hd}</span></td>
                        <td className={`px-3 py-2 font-semibold ${repeated ? "text-red-700" : ""}`}>{work.number !== null && work.number !== undefined ? pad(work.number) : "—"}</td>
                        <td className="px-3 py-2 font-medium">
                          <button type="button" className="text-left hover:underline" onClick={(event) => { event.stopPropagation(); openWork(work); }}>{work.name}</button>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{work.folder}</td>
                        <td className="px-3 py-2 text-right">{gb(work.size_gb)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{intBR(work.file_count)}</td>
                        <td className="px-3 py-2 text-slate-600">{formatDateBR(work.modified_on) || "—"}</td>
                        <td className="px-3 py-2 text-[13px] text-amber-900">
                          {repeated ? <span className="mr-1 font-semibold text-red-700">Nº repetido.</span> : null}
                          {copyWhere.get(work.id) ? <span className="mr-1 text-slate-600">Cópia também no {copyWhere.get(work.id)}.</span> : null}
                          {work.note}
                        </td>
                      </tr>
                    );
                  })}
                  {!filtered.length ? (
                    <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">Nenhum trabalho encontrado.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>Mostrando {filtered.length} • toque num trabalho para editar</span>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} />
                Mostrar também pastas que não são trabalho
              </label>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl bg-slate-900 p-4 text-white">
              <p className="text-xs text-slate-300">Próximo número livre</p>
              <p className="mt-1 text-4xl font-bold">{pad(numbering.next)}</p>
              <p className="mt-1 text-xs text-slate-300">Use na próxima pasta de trabalho</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-600">Números em uso</p>
              <p className="mt-1 text-3xl font-bold text-emerald-700">{numbering.single}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-600">Faltando</p>
              <p className="mt-1 text-3xl font-bold text-amber-700">{numbering.missing.length}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-600">Repetidos</p>
              <p className="mt-1 text-3xl font-bold text-red-700">{numbering.duplicates.length}</p>
            </div>
          </div>

          <Card className="rounded-3xl">
            <CardContent className="space-y-2 p-4">
              <h3 className="font-semibold text-slate-900">Repetidos — trabalhos diferentes com o mesmo número</h3>
              {numbering.duplicates.length ? numbering.duplicates.map(([number, list]) => (
                <div key={number} className="flex flex-wrap items-center gap-2 rounded-2xl bg-red-50 p-3">
                  <span className="w-14 text-xl font-bold text-red-800">{pad(number)}</span>
                  <div className="flex flex-1 flex-wrap gap-2">
                    {list.map((work) => (
                      <button key={work.id} type="button" onClick={() => openWork(work)} className="min-h-10 rounded-xl border border-red-200 bg-white px-3 text-left text-sm hover:bg-red-100" title="Editar / renumerar">
                        <strong>{work.hd}</strong> · {work.name}
                      </button>
                    ))}
                  </div>
                </div>
              )) : <p className="text-sm text-slate-500">Nenhum número repetido.</p>}
              {numbering.duplicates.length ? <p className="text-xs text-slate-500">Toque num trabalho para trocar o número dele (renomeie a pasta no HD também).</p> : null}
            </CardContent>
          </Card>

          <Card className="rounded-3xl">
            <CardContent className="space-y-2 p-4">
              <h3 className="font-semibold text-slate-900">Faltando — números sem pasta em nenhum HD</h3>
              <div className="flex flex-wrap gap-2">
                {numbering.missing.map((n) => (
                  <span key={n} className="min-w-11 rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-center text-sm font-semibold text-amber-900">{pad(n)}</span>
                ))}
                {!numbering.missing.length ? <p className="text-sm text-slate-500">Nenhum número faltando.</p> : null}
              </div>
            </CardContent>
          </Card>

          {numbering.copies.length ? (
            <Card className="rounded-3xl">
              <CardContent className="space-y-2 p-4">
                <h3 className="font-semibold text-slate-900">Em mais de um HD (cópias do mesmo trabalho)</h3>
                <p className="text-xs text-slate-500">Mesmo número e mesmo nome em HDs diferentes: não é erro, é backup.</p>
                {numbering.copies.map(([number, list]) => (
                  <div key={number} className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 p-3 text-sm">
                    <span className="w-14 text-lg font-bold text-slate-800">{pad(number)}</span>
                    <span className="flex-1">{list[0].name}</span>
                    <span className="flex gap-1">{list.map((work) => <span key={work.id} className={`rounded-md px-2 py-0.5 text-xs font-bold ${colorOf(work.hd)}`}>{work.hd}</span>)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {numbering.outOfSequence.length ? (
            <Card className="rounded-3xl">
              <CardContent className="space-y-2 p-4">
                <h3 className="font-semibold text-slate-900">Fora da sequência (sem número)</h3>
                <div className="flex flex-wrap gap-2">
                  {numbering.outOfSequence.map((work) => (
                    <button key={work.id} type="button" onClick={() => openWork(work)} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm hover:bg-slate-50">
                      <strong>{work.hd}</strong> · {work.name}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}

      {diskForm ? (
        <DiskDialog
          value={diskForm}
          saving={saving}
          canDelete={!(statsByDisk[diskForm.name]?.works) && !works.some((work) => work.hd === diskForm.name)}
          onChange={(fields) => setDiskForm((current) => ({ ...current, ...fields }))}
          onSave={saveDisk}
          onDelete={deleteDisk}
          onClose={() => setDiskForm(null)}
        />
      ) : null}
      {workForm ? (
        <WorkDialog
          value={workForm}
          disks={disks}
          nextNumber={numbering.next}
          saving={saving}
          onChange={(fields) => setWorkForm((current) => ({ ...current, ...fields }))}
          onSave={saveWork}
          onDelete={deleteWork}
          onClose={() => setWorkForm(null)}
        />
      ) : null}
    </div>
  );
}
