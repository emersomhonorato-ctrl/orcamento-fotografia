import { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateBR } from "@/utils/formatters";
import { hojeISO } from "@/lib/crm";

// Tarefas e lembretes do CRM
function TarefaLinha({ tarefa, cliente, onToggle, onRemover, onAbrirCliente }) {
  const hoje = hojeISO();
  const atrasada = !tarefa.done && tarefa.due && tarefa.due < hoje;
  return (
    <li className="flex items-center gap-2 py-2 text-sm">
      <button type="button" onClick={onToggle} aria-label={tarefa.done ? "Marcar como não feita" : "Marcar como feita"} className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${tarefa.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-stone-300 bg-white"}`}>
        {tarefa.done ? <Check className="h-3.5 w-3.5" /> : null}
      </button>
      <span className={`min-w-0 flex-1 ${tarefa.done ? "text-stone-400 line-through" : "text-stone-800"}`}>
        {tarefa.title}
        {cliente ? (
          <button type="button" onClick={onAbrirCliente} className="ml-1.5 text-xs font-medium text-[#7f274f] hover:underline">• {cliente.name}</button>
        ) : null}
      </span>
      {tarefa.due ? <span className={`shrink-0 text-xs ${atrasada ? "font-semibold text-red-700" : tarefa.due === hoje ? "font-semibold text-amber-700" : "text-stone-500"}`}>{tarefa.due === hoje ? "hoje" : formatDateBR(tarefa.due)}</span> : null}
      <button type="button" onClick={onRemover} className="rounded p-1 text-stone-300 hover:text-red-600" aria-label="Apagar tarefa"><Trash2 className="h-3.5 w-3.5" /></button>
    </li>
  );
}

export function NovaTarefa({ clients = [], clientId = "", onAdd }) {
  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState(hojeISO());
  const [cliente, setCliente] = useState(clientId);
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!titulo.trim()) return;
        onAdd({ id: crypto.randomUUID(), title: titulo.trim(), due: data, clientId: cliente, done: false, createdAt: new Date().toISOString() });
        setTitulo("");
      }}
    >
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Nova tarefa (ex.: ligar para confirmar o ensaio)" className="h-9 min-w-[12rem] flex-1 rounded-xl border border-stone-300 bg-white px-3 text-sm" />
      <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="h-9 rounded-xl border border-stone-300 bg-white px-2 text-sm" />
      {!clientId ? (
        <select value={cliente} onChange={(e) => setCliente(e.target.value)} className="h-9 max-w-[12rem] rounded-xl border border-stone-300 bg-white px-2 text-sm">
          <option value="">Sem cliente</option>
          {[...clients].sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR")).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      ) : null}
      <Button type="submit" size="sm" className="rounded-xl bg-[#7f274f] hover:bg-[#692040]"><Plus className="mr-1 h-4 w-4" />Adicionar</Button>
    </form>
  );
}

export function TarefasLista({ crm, clients, onChangeCrm, onAbrirCliente, mostrarFeitas = false, filtroCliente = "", ateHoje = false }) {
  const porId = new Map(clients.map((c) => [c.id, c]));
  const lista = crm.tasks
    .filter((t) => (mostrarFeitas || !t.done) && (!filtroCliente || t.clientId === filtroCliente) && (!ateHoje || (t.due && t.due <= hojeISO())))
    .sort((a, b) => Number(a.done) - Number(b.done) || String(a.due || "9999").localeCompare(String(b.due || "9999")));
  const alterar = (id, fn) => onChangeCrm({ ...crm, tasks: crm.tasks.map((t) => (t.id === id ? fn(t) : t)) });
  if (!lista.length) return <p className="py-3 text-sm text-stone-500">Nenhuma tarefa {mostrarFeitas ? "" : "pendente"}.</p>;
  return (
    <ul className="divide-y divide-stone-100">
      {lista.map((t) => (
        <TarefaLinha
          key={t.id}
          tarefa={t}
          cliente={filtroCliente ? null : porId.get(t.clientId)}
          onToggle={() => alterar(t.id, (x) => ({ ...x, done: !x.done, doneAt: !x.done ? new Date().toISOString() : "" }))}
          onRemover={() => onChangeCrm({ ...crm, tasks: crm.tasks.filter((x) => x.id !== t.id) })}
          onAbrirCliente={() => onAbrirCliente?.(t.clientId)}
        />
      ))}
    </ul>
  );
}

