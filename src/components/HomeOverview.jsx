import { BadgeDollarSign, CalendarCheck, CalendarPlus, FilePlus2, Inbox, Hourglass } from "lucide-react";

// Topo do Início: saudação, atalhos e o quadro "Hoje" com o que é mais urgente
const brl = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export function HomeHeader({ nome, ensaiosSemana, onNewBudget, onNewEvent, onCobrancas }) {
  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          {saudacao()}{nome ? `, ${nome}` : ""}
        </h1>
        <p className="text-sm text-stone-500 first-letter:uppercase">
          {hoje}
          {ensaiosSemana ? ` • ${ensaiosSemana} ${ensaiosSemana === 1 ? "trabalho" : "trabalhos"} nos próximos 7 dias` : ""}
        </p>
      </div>
      <div className="ml-auto flex flex-wrap gap-2">
        <button type="button" onClick={onCobrancas} className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50">
          <BadgeDollarSign className="h-4 w-4" />Cobranças
        </button>
        <button type="button" onClick={onNewEvent} className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50">
          <CalendarPlus className="h-4 w-4" />Agendamento
        </button>
        <button type="button" onClick={onNewBudget} className="inline-flex items-center gap-1.5 rounded-xl bg-[#7f274f] px-3 py-2 text-sm font-semibold text-white hover:bg-[#692040]">
          <FilePlus2 className="h-4 w-4" />Orçamento
        </button>
      </div>
    </div>
  );
}

export function TodayStrip({ ensaiosHoje, propostas, restante, pedidosNovos, onAgenda, onParaFazer, onPedidos }) {
  const blocos = [
    { valor: ensaiosHoje, texto: ensaiosHoje === 1 ? "trabalho hoje" : "trabalhos hoje", cor: "bg-sky-50 text-sky-900", Icone: CalendarCheck, onClick: onAgenda },
    { valor: propostas, texto: propostas === 1 ? "proposta vencendo" : "propostas vencendo", cor: "bg-amber-50 text-amber-900", Icone: Hourglass, onClick: onParaFazer },
    { valor: brl(restante), texto: "restante a cobrar (7 dias)", cor: "bg-rose-50 text-rose-900", Icone: BadgeDollarSign, onClick: onParaFazer },
    { valor: pedidosNovos, texto: pedidosNovos === 1 ? "pedido novo" : "pedidos novos", cor: "bg-emerald-50 text-emerald-900", Icone: Inbox, onClick: onPedidos },
  ];
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-stone-900">Hoje</h2>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {blocos.map(({ valor, texto, cor, Icone: icone, onClick }) => {
          const Icone = icone;
          return (
          <button key={texto} type="button" onClick={onClick} className={`flex items-start gap-2 rounded-xl px-3.5 py-3 text-left transition hover:brightness-95 ${cor}`}>
            <Icone className="mt-1 h-4 w-4 shrink-0 opacity-70" />
            <span>
              <span className="block text-xl font-bold leading-tight">{valor}</span>
              <span className="text-xs opacity-80">{texto}</span>
            </span>
          </button>
          );
        })}
      </div>
    </section>
  );
}

// Funil do mês: pedidos que chegaram → orçamentos feitos → fechados
export function SalesFunnel({ monthLabel, pedidos, orcamentos, fechados }) {
  const maior = Math.max(pedidos, orcamentos, fechados, 1);
  const taxa = orcamentos ? Math.round((fechados / orcamentos) * 100) : null;
  const linhas = [
    [pedidos, pedidos === 1 ? "pedido recebido" : "pedidos recebidos", "bg-[#7f274f]"],
    [orcamentos, orcamentos === 1 ? "orçamento feito" : "orçamentos feitos", "bg-[#a24a72]"],
    [fechados, `${fechados === 1 ? "fechado" : "fechados"}${taxa !== null ? ` • ${taxa}% dos orçamentos` : ""}`, "bg-[#c4a050]"],
  ];
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-stone-900">Funil de orçamentos</h2>
      <p className="mb-4 text-xs text-stone-500 first-letter:uppercase">{monthLabel}</p>
      <div className="space-y-2.5">
        {linhas.map(([n, texto, cor]) => (
          <div key={texto} className="flex items-center gap-3 text-sm">
            <div className="flex-1">
              <div className={`flex h-7 min-w-[2.25rem] items-center rounded-md px-2.5 text-xs font-bold text-white ${cor}`} style={{ width: `${Math.max(8, (n / maior) * 100)}%` }}>
                {n}
              </div>
            </div>
            <span className="w-44 shrink-0 text-xs text-stone-600">{texto}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
