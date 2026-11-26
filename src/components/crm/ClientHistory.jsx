import { useEffect, useMemo, useState } from "react";
import { BookOpen, CalendarDays, FileText, Images, Mail, MessageCircle, Package, Phone, Plus, StickyNote, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/supabase";
import { historyOf } from "@/lib/finance";
import { openExternal } from "@/lib/openExternal";
import { buildWhatsAppLink } from "@/utils/whatsappMessages";
import { formatDateBR } from "@/utils/formatters";
import { NovaTarefa, TarefasLista } from "@/components/crm/Tasks";
import MensagensProntas from "@/components/crm/MensagensProntas";
import { SOURCES, STAGES, TAG_SUGESTOES } from "@/lib/crm";

// Tudo de um cliente numa tela: etapa, origem, etiquetas, tarefas, anotações e a linha do tempo
const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ClientHistory({ cliente, registros = [], crm, onChangeCrm, clients, onOpenRecord, onNewBudget, etapaAuto }) {
  const lead = crm.leads[cliente.id] || { stage: "", tags: [], source: "" };
  const [novaTag, setNovaTag] = useState("");
  const [nota, setNota] = useState("");
  const [externos, setExternos] = useState([]);

  function salvarLead(mudanca) {
    onChangeCrm({ ...crm, leads: { ...crm.leads, [cliente.id]: { ...lead, ...mudanca, updatedAt: new Date().toISOString() } } });
  }
  function addTag(tag) {
    const t = String(tag || "").trim();
    if (!t || (lead.tags || []).includes(t)) return;
    salvarLead({ tags: [...(lead.tags || []), t].slice(0, 12) });
    setNovaTag("");
  }

  // seleções, entregas, álbuns e links de pagamento com o nome do cliente
  useEffect(() => {
    let ativo = true;
    const nome = String(cliente.name || "").trim();
    if (!nome) return undefined;
    const like = `%${nome.replace(/[%_]/g, "")}%`;
    Promise.all([
      supabase.from("photo_selections").select("title, created_at, status, submitted_at").ilike("client_name", like).limit(20),
      supabase.from("photo_deliveries").select("title, created_at, active").ilike("client_name", like).limit(20),
      supabase.from("photo_albums").select("title, created_at, status, approved_at").ilike("client_name", like).limit(20),
      supabase.from("payments").select("description, created_at, amount, status, paid_at").ilike("client_name", like).limit(30),
    ]).then(([sel, ent, alb, pag]) => {
      if (!ativo) return;
      const itens = [];
      (sel.data || []).forEach((s) => itens.push({ data: s.submitted_at || s.created_at, tipo: "selecao", texto: `Seleção de fotos: ${s.title}${s.status === "enviada" ? " • escolha enviada" : ""}` }));
      (ent.data || []).forEach((s) => itens.push({ data: s.created_at, tipo: "entrega", texto: `Entrega de fotos: ${s.title}` }));
      (alb.data || []).forEach((s) => itens.push({ data: s.approved_at || s.created_at, tipo: "album", texto: `Álbum: ${s.title}${s.status === "aprovado" ? " • aprovado" : ""}` }));
      (pag.data || []).forEach((s) => itens.push({ data: s.paid_at || s.created_at, tipo: "pagamento", texto: `Link de pagamento: ${s.description} • ${brl(s.amount)}${s.status === "pago" ? " • pago" : ""}` }));
      setExternos(itens);
    });
    return () => {
      ativo = false;
    };
  }, [cliente.name]);

  const linhaDoTempo = useMemo(() => {
    const itens = [];
    registros.forEach((r) => {
      itens.push({
        data: r.eventDate || r.createdAt,
        tipo: r.recordType === "orcamento" ? "orcamento" : "trabalho",
        texto: `${r.recordType === "orcamento" ? "Orçamento" : "Trabalho"}: ${r.eventType || "—"} • ${brl(r.computedAmount || r.amount)} • ${r.status}`,
        registro: r,
      });
      historyOf(r).forEach((p) => itens.push({ data: p.date || r.eventDate, tipo: "pago", texto: `Pagamento recebido: ${brl(p.amount)}${p.method ? ` (${p.method})` : ""} — ${r.eventType || ""}` }));
    });
    crm.notes.filter((n) => n.clientId === cliente.id).forEach((n) => itens.push({ data: n.at, tipo: "nota", texto: n.text, nota: n }));
    return [...itens, ...externos].filter((i) => i.data).sort((a, b) => String(b.data).localeCompare(String(a.data)));
  }, [registros, crm.notes, cliente.id, externos]);

  const fechado = registros.filter((r) => r.recordType !== "orcamento" && r.status !== "Cancelado").reduce((s, r) => s + Number(r.computedAmount || r.amount || 0), 0);
  const devendo = registros.filter((r) => r.recordType !== "orcamento" && r.status !== "Cancelado").reduce((s, r) => s + Math.max(0, Number(r.balance || 0)), 0);
  const icones = { orcamento: FileText, trabalho: CalendarDays, pago: Wallet, nota: StickyNote, selecao: Images, entrega: Package, album: BookOpen, pagamento: Wallet };

  return (
    <div className="space-y-5 p-5">
      <div className="space-y-1 text-sm text-stone-600">
        {cliente.whatsapp ? <p className="flex items-center gap-2"><Phone className="h-4 w-4" />{cliente.whatsapp}</p> : null}
        {cliente.email ? <p className="flex items-center gap-2"><Mail className="h-4 w-4" />{cliente.email}</p> : null}
        <p>
          Já fechou <b>{brl(fechado)}</b> em {registros.filter((r) => r.recordType !== "orcamento").length} trabalho(s)
          {devendo > 0 ? <span className="text-amber-700"> • deve {brl(devendo)}</span> : null}
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          {cliente.whatsapp ? (
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openExternal(buildWhatsAppLink(cliente.whatsapp, `Oi, ${String(cliente.name).split(" ")[0]}! Tudo bem? 😊`))}>
              <MessageCircle className="mr-1.5 h-4 w-4" />WhatsApp
            </Button>
          ) : null}
          {onNewBudget ? (
            <Button size="sm" className="rounded-xl bg-[#7f274f] hover:bg-[#692040]" onClick={() => onNewBudget(cliente)}>
              <Plus className="mr-1.5 h-4 w-4" />Orçamento
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs text-stone-500">Etapa no funil
          <select value={lead.stage || ""} onChange={(e) => salvarLead({ stage: e.target.value })} className="block h-9 w-full rounded-xl border border-stone-300 bg-white px-2 text-sm text-stone-900">
            <option value="">Automático ({STAGES.find(([v]) => v === etapaAuto)?.[1]})</option>
            {STAGES.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs text-stone-500">De onde veio
          <select value={lead.source || ""} onChange={(e) => salvarLead({ source: e.target.value })} className="block h-9 w-full rounded-xl border border-stone-300 bg-white px-2 text-sm text-stone-900">
            <option value="">Não sei</option>
            {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        {(lead.stage || etapaAuto) === "perdido" ? (
          <label className="space-y-1 text-xs text-stone-500 sm:col-span-2">Por que não fechou?
            <input value={lead.lostReason || ""} onChange={(e) => salvarLead({ lostReason: e.target.value })} placeholder="Ex.: achou caro, fechou com outro, desistiu da data" className="block h-9 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900" />
          </label>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-xs text-stone-500">Etiquetas</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {(lead.tags || []).map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-[#7f274f]/10 px-2.5 py-1 text-xs font-semibold text-[#7f274f]">
              {t}
              <button type="button" onClick={() => salvarLead({ tags: lead.tags.filter((x) => x !== t) })} aria-label={`Tirar ${t}`}><X className="h-3 w-3" /></button>
            </span>
          ))}
          <form onSubmit={(e) => { e.preventDefault(); addTag(novaTag); }}>
            <input value={novaTag} onChange={(e) => setNovaTag(e.target.value)} placeholder="+ etiqueta" className="h-7 w-28 rounded-full border border-dashed border-stone-300 bg-white px-2.5 text-xs" />
          </form>
        </div>
        <div className="flex flex-wrap gap-1">
          {TAG_SUGESTOES.filter((t) => !(lead.tags || []).includes(t)).map((t) => (
            <button key={t} type="button" onClick={() => addTag(t)} className="rounded-full border border-stone-200 px-2 py-0.5 text-[11px] text-stone-500 hover:bg-white">+ {t}</button>
          ))}
        </div>
      </div>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
        <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><MessageCircle className="h-4 w-4 text-emerald-700" />Mensagens prontas</h4>
        <MensagensProntas cliente={cliente} registros={registros} etapa={lead.stage || etapaAuto} crm={crm} onChangeCrm={onChangeCrm} />
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h4 className="mb-2 text-sm font-semibold">Tarefas</h4>
        <NovaTarefa clients={clients} clientId={cliente.id} onAdd={(t) => onChangeCrm({ ...crm, tasks: [...crm.tasks, t] })} />
        <TarefasLista crm={crm} clients={clients} onChangeCrm={onChangeCrm} filtroCliente={cliente.id} mostrarFeitas />
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h4 className="mb-2 text-sm font-semibold">Anotar</h4>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!nota.trim()) return;
            onChangeCrm({ ...crm, notes: [...crm.notes, { id: crypto.randomUUID(), clientId: cliente.id, text: nota.trim(), at: new Date().toISOString() }] });
            setNota("");
          }}
        >
          <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: ligou perguntando de ensaio de gestante para março" className="h-9 flex-1 rounded-xl border border-stone-300 px-3 text-sm" />
          <Button type="submit" size="sm" className="rounded-xl">Salvar</Button>
        </form>
      </section>

      <section>
        <h4 className="mb-2 text-sm font-semibold">Histórico</h4>
        {linhaDoTempo.length ? (
          <ol className="relative space-y-3 border-l border-stone-200 pl-5">
            {linhaDoTempo.map((item, i) => {
              const Icone = icones[item.tipo] || StickyNote;
              return (
                <li key={i} className="relative text-sm">
                  <span className="absolute -left-[29px] flex h-5 w-5 items-center justify-center rounded-full border border-stone-200 bg-white"><Icone className="h-3 w-3 text-stone-500" /></span>
                  <p className="text-xs text-stone-400">{formatDateBR(String(item.data).slice(0, 10))}</p>
                  {item.registro ? (
                    <button type="button" onClick={() => onOpenRecord?.(item.registro)} className="text-left text-stone-800 hover:underline">{item.texto}</button>
                  ) : (
                    <p className={item.tipo === "nota" ? "whitespace-pre-line rounded-lg bg-amber-50 px-2 py-1 text-stone-800" : "text-stone-700"}>{item.texto}</p>
                  )}
                  {item.nota ? (
                    <button type="button" className="text-[11px] text-stone-400 hover:text-red-600" onClick={() => onChangeCrm({ ...crm, notes: crm.notes.filter((n) => n.id !== item.nota.id) })}>apagar</button>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-stone-500">Nada ainda.</p>
        )}
      </section>
    </div>
  );
}
