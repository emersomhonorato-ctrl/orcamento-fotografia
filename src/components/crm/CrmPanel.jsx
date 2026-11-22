import { useMemo, useState } from "react";
import { CalendarClock, MessageCircle, Search, Tag, X } from "lucide-react";
import { openExternal } from "@/lib/openExternal";
import { buildWhatsAppLink } from "@/utils/whatsappMessages";
import { formatDateBR } from "@/utils/formatters";
import ClientHistory from "@/components/crm/ClientHistory";
import { NovaTarefa, TarefasLista } from "@/components/crm/Tasks";
import { SOURCES, STAGES, etapaAutomatica, hojeISO, semAcento } from "@/lib/crm";

const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// CRM: funil de vendas (quadro por etapa), etiquetas e origem, tarefas e histórico de cada cliente
export default function CrmPanel({ clients = [], records = [], crm, onChangeCrm, onOpenRecord, onNewBudget }) {
  const [busca, setBusca] = useState("");
  const [tagFiltro, setTagFiltro] = useState("");
  const [origemFiltro, setOrigemFiltro] = useState("");
  const [aberto, setAberto] = useState(null);
  const [arrastando, setArrastando] = useState(null);
  const [verFechados, setVerFechados] = useState(false);
  const hoje = hojeISO();

  // registros de cada cliente (por id; se não tiver, pelo nome)
  const registrosPorCliente = useMemo(() => {
    const mapa = new Map();
    const porNome = new Map(clients.map((c) => [semAcento(c.name).trim(), c.id]));
    records.forEach((r) => {
      const id = r.clientId && clients.some((c) => c.id === r.clientId) ? r.clientId : porNome.get(semAcento(r.clientName).trim());
      if (!id) return;
      if (!mapa.has(id)) mapa.set(id, []);
      mapa.get(id).push(r);
    });
    return mapa;
  }, [clients, records]);

  const cartoes = useMemo(() => {
    const termo = semAcento(busca.trim());
    return clients
      .map((c) => {
        const regs = registrosPorCliente.get(c.id) || [];
        const lead = crm.leads[c.id] || {};
        const etapa = lead.stage || etapaAutomatica(regs);
        const datas = regs.map((r) => r.eventDate || r.createdAt || "").filter(Boolean).sort();
        const ultima = datas[datas.length - 1] || "";
        const aberto = regs.filter((r) => r.recordType === "orcamento" && ["Pendente", "Em negociação"].includes(r.status)).reduce((s, r) => s + Number(r.computedAmount || r.amount || 0), 0);
        const fechado = regs.filter((r) => r.recordType !== "orcamento" && r.status !== "Cancelado").reduce((s, r) => s + Number(r.computedAmount || r.amount || 0), 0);
        const proxima = crm.tasks.filter((t) => t.clientId === c.id && !t.done).sort((a, b) => String(a.due).localeCompare(String(b.due)))[0];
        return { cliente: c, lead, etapa, ultima, aberto, fechado, proxima, qtd: regs.length };
      })
      .filter(({ cliente, lead }) => {
        if (termo && !semAcento(`${cliente.name} ${cliente.whatsapp} ${cliente.email} ${(lead.tags || []).join(" ")}`).includes(termo)) return false;
        if (tagFiltro && !(lead.tags || []).includes(tagFiltro)) return false;
        if (origemFiltro && lead.source !== origemFiltro) return false;
        return true;
      })
      .sort((a, b) => String(b.ultima).localeCompare(String(a.ultima)));
  }, [clients, registrosPorCliente, crm, busca, tagFiltro, origemFiltro]);

  const todasTags = useMemo(() => [...new Set(Object.values(crm.leads).flatMap((l) => l.tags || []))].sort((a, b) => a.localeCompare(b, "pt-BR")), [crm.leads]);

  function moverPara(clienteId, etapa) {
    const lead = crm.leads[clienteId] || {};
    onChangeCrm({ ...crm, leads: { ...crm.leads, [clienteId]: { ...lead, stage: etapa, updatedAt: new Date().toISOString() } } });
  }

  const tarefasHoje = crm.tasks.filter((t) => !t.done && t.due && t.due <= hoje).length;
  const totais = Object.fromEntries(STAGES.map(([v]) => [v, cartoes.filter((c) => c.etapa === v)]));
  const valorFunil = (totais.orcamento || []).concat(totais.negociacao || []).reduce((s, c) => s + c.aberto, 0);
  const clienteAberto = aberto ? clients.find((c) => c.id === aberto) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h2 className="text-xl font-semibold text-stone-900">CRM</h2>
          <p className="text-sm text-stone-500">
            {totais.orcamento.length + totais.negociacao.length} negociações abertas • {brl(valorFunil)} em propostas
            {tarefasHoje ? ` • ${tarefasHoje} tarefa${tarefasHoje > 1 ? "s" : ""} para hoje` : ""}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex h-9 items-center gap-2 rounded-xl border border-stone-300 bg-white px-3">
            <Search className="h-4 w-4 text-stone-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente ou etiqueta" className="w-48 bg-transparent text-sm outline-none" />
          </div>
          <select value={tagFiltro} onChange={(e) => setTagFiltro(e.target.value)} className="h-9 rounded-xl border border-stone-300 bg-white px-2 text-sm">
            <option value="">Todas as etiquetas</option>
            {todasTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={origemFiltro} onChange={(e) => setOrigemFiltro(e.target.value)} className="h-9 rounded-xl border border-stone-300 bg-white px-2 text-sm">
            <option value="">Todas as origens</option>
            {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Funil (quadro) */}
      <div className="-mx-1 overflow-x-auto pb-2">
        <div className="grid min-w-[1080px] grid-cols-6 gap-3 px-1">
          {STAGES.map(([valor, rotulo, cor]) => {
            const lista = totais[valor] || [];
            const limite = valor === "fechado" && !verFechados ? 12 : valor === "perdido" ? 12 : 60;
            return (
              <div
                key={valor}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (arrastando) moverPara(arrastando, valor);
                  setArrastando(null);
                }}
                className={`flex min-w-0 flex-col rounded-2xl border-t-4 bg-white/70 ${cor.split(" ")[0]}`}
              >
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-sm font-semibold text-stone-800">{rotulo}</span>
                  <span className="rounded-full bg-stone-100 px-2 text-xs font-semibold text-stone-600">{lista.length}</span>
                </div>
                <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto px-2 pb-2">
                  {lista.slice(0, limite).map(({ cliente, lead, aberto: emAberto, fechado, proxima, qtd }) => (
                    <div
                      key={cliente.id}
                      draggable
                      onDragStart={() => setArrastando(cliente.id)}
                      onClick={() => setAberto(cliente.id)}
                      className="cursor-pointer rounded-xl border border-stone-200 bg-white p-2.5 text-sm shadow-sm transition hover:shadow-md"
                    >
                      <div className="flex items-start gap-2">
                        <b className="min-w-0 flex-1 truncate text-stone-900">{cliente.name || "Sem nome"}</b>
                        {cliente.whatsapp ? (
                          <button
                            type="button"
                            title="WhatsApp"
                            onClick={(e) => {
                              e.stopPropagation();
                              openExternal(buildWhatsAppLink(cliente.whatsapp, `Oi, ${String(cliente.name).split(" ")[0]}! Tudo bem? 😊`));
                            }}
                            className="rounded-md p-0.5 text-emerald-600 hover:bg-emerald-50"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-stone-500">
                        {emAberto ? `${brl(emAberto)} em proposta` : fechado ? `${brl(fechado)} em trabalhos` : qtd ? `${qtd} registro${qtd > 1 ? "s" : ""}` : "sem trabalhos ainda"}
                        {lead.source ? ` • ${lead.source}` : ""}
                      </p>
                      {lead.tags?.length ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {lead.tags.slice(0, 4).map((t) => <span key={t} className="rounded-full bg-[#7f274f]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#7f274f]">{t}</span>)}
                        </div>
                      ) : null}
                      {proxima ? (
                        <p className={`mt-1.5 flex items-center gap-1 text-[11px] ${proxima.due && proxima.due <= hoje ? "font-semibold text-red-700" : "text-stone-500"}`}>
                          <CalendarClock className="h-3 w-3" />{proxima.title}{proxima.due ? ` • ${proxima.due === hoje ? "hoje" : formatDateBR(proxima.due)}` : ""}
                        </p>
                      ) : null}
                      <select
                        value={STAGES.some(([v]) => v === lead.stage) ? lead.stage : ""}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => moverPara(cliente.id, e.target.value)}
                        className="mt-2 w-full rounded-md border border-stone-200 bg-stone-50 px-1.5 py-1 text-[11px] text-stone-600"
                        title="Mudar etapa"
                      >
                        <option value="">Automático</option>
                        {STAGES.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                      </select>
                    </div>
                  ))}
                  {lista.length > limite ? (
                    <button type="button" className="py-1 text-xs text-stone-500 underline" onClick={() => setVerFechados(true)}>
                      + {lista.length - limite} {valor === "fechado" ? "(ver todos)" : ""}
                    </button>
                  ) : null}
                  {!lista.length ? <p className="px-1 py-3 text-center text-xs text-stone-400">Arraste um cliente para cá</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tarefas */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-900"><CalendarClock className="h-4 w-4 text-[#7f274f]" />Tarefas e lembretes</h3>
        <NovaTarefa clients={clients} onAdd={(t) => onChangeCrm({ ...crm, tasks: [...crm.tasks, t] })} />
        <div className="mt-3">
          <TarefasLista crm={crm} clients={clients} onChangeCrm={onChangeCrm} onAbrirCliente={setAberto} />
        </div>
      </section>

      {/* Etiquetas e origem: resumo */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-900"><Tag className="h-4 w-4 text-[#7f274f]" />De onde vêm os clientes</h3>
          {SOURCES.map((s) => {
            const n = Object.values(crm.leads).filter((l) => l.source === s).length;
            return n ? (
              <button key={s} type="button" onClick={() => setOrigemFiltro(origemFiltro === s ? "" : s)} className={`mb-1.5 flex w-full items-center gap-2 text-left text-sm ${origemFiltro === s ? "font-semibold" : ""}`}>
                <span className="w-32 shrink-0 text-stone-700">{s}</span>
                <span className="h-2.5 rounded-full bg-[#7f274f]" style={{ width: `${Math.max(6, (n / Math.max(1, Object.values(crm.leads).filter((l) => l.source).length)) * 100)}%` }} />
                <span className="text-xs text-stone-500">{n}</span>
              </button>
            ) : null;
          })}
          {!Object.values(crm.leads).some((l) => l.source) ? <p className="text-sm text-stone-500">Abra um cliente e marque de onde ele veio (Instagram, indicação…).</p> : null}
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-900"><Tag className="h-4 w-4 text-[#7f274f]" />Etiquetas</h3>
          <div className="flex flex-wrap gap-1.5">
            {todasTags.length ? (
              todasTags.map((t) => (
                <button key={t} type="button" onClick={() => setTagFiltro(tagFiltro === t ? "" : t)} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tagFiltro === t ? "bg-[#7f274f] text-white" : "bg-[#7f274f]/10 text-[#7f274f]"}`}>
                  {t} ({Object.values(crm.leads).filter((l) => l.tags?.includes(t)).length})
                </button>
              ))
            ) : (
              <p className="text-sm text-stone-500">Abra um cliente para colocar etiquetas (VIP, Gestante, Casamento…).</p>
            )}
          </div>
        </div>
      </section>

      {clienteAberto ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setAberto(null)}>
          <div className="h-full w-full max-w-xl overflow-y-auto bg-[#f6f4ef] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-[#f6f4ef]/95 px-5 py-3 backdrop-blur">
              <b className="truncate">{clienteAberto.name}</b>
              <button type="button" onClick={() => setAberto(null)} className="rounded-full p-1.5 hover:bg-stone-200" aria-label="Fechar"><X className="h-5 w-5" /></button>
            </div>
            <ClientHistory
              cliente={clienteAberto}
              registros={registrosPorCliente.get(clienteAberto.id) || []}
              crm={crm}
              onChangeCrm={onChangeCrm}
              clients={clients}
              onOpenRecord={onOpenRecord}
              onNewBudget={onNewBudget}
              etapaAuto={etapaAutomatica(registrosPorCliente.get(clienteAberto.id) || [])}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
