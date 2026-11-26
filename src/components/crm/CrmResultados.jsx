import { useMemo, useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight, Target } from "lucide-react";
import { semAcento } from "@/lib/crm";

const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const valorDe = (r) => Number(r.computedAmount || r.amount || 0);
const mesDe = (data) => String(data || "").slice(0, 7);
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nomeMes = (mes) => {
  const [a, m] = mes.split("-").map(Number);
  const nome = MESES[m - 1];
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${a}`;
};
const somarMes = (mes, n) => {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const ehTrabalho = (r) => r.recordType !== "orcamento" && r.status !== "Cancelado";
const ehAberto = (r) => r.recordType === "orcamento" && ["Pendente", "Em negociação"].includes(r.status);
const ehPerdido = (r) => r.status === "Cancelado" || r.status === "Recusado";

// Agrupa motivos parecidos ("achou caro", "Achou caro demais" → "achou caro")
function motivoCurto(texto) {
  const t = semAcento(texto).replace(/^recusou:?\s*/, "").trim();
  if (!t) return "";
  if (/caro|preco|valor|orcamento alto|dinheiro/.test(t)) return "Achou caro";
  if (/outro|concorr|fechou com/.test(t)) return "Fechou com outro";
  if (/data|agenda|ocupad/.test(t)) return "Data não deu";
  if (/sumiu|nao respond|sem resposta|visualiz/.test(t)) return "Sumiu / não respondeu";
  if (/desist|cancel|adiou|nao vai/.test(t)) return "Desistiu / adiou";
  return t.charAt(0).toUpperCase() + t.slice(1, 40);
}

export default function CrmResultados({ records, crm, onChangeCrm, origemDoCliente }) {
  const [agora] = useState(() => Date.now());
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [metaTexto, setMetaTexto] = useState("");
  const meta = Number(crm.goals?.[mes] || 0);

  const dados = useMemo(() => {
    // Meta: trabalhos com data no mês (o que entra de faturamento no mês)
    const doMes = records.filter((r) => ehTrabalho(r) && mesDe(r.eventDate) === mes);
    const fechado = doMes.reduce((s, r) => s + valorDe(r), 0);
    const emNegociacao = records.filter((r) => ehAberto(r) && (mesDe(r.eventDate) === mes || (!r.eventDate && mesDe(r.createdAt) === mes))).reduce((s, r) => s + valorDe(r), 0);

    // Fechamento: orçamentos/trabalhos criados nos últimos 90 dias
    const limite = new Date(agora - 90 * 86400000).toISOString();
    const recentes = records.filter((r) => String(r.createdAt || "") >= limite);
    const fechados = recentes.filter(ehTrabalho);
    const perdidos = recentes.filter(ehPerdido);
    const abertos = recentes.filter(ehAberto);
    const decididos = fechados.length + perdidos.length;
    const taxa = decididos ? Math.round((fechados.length / decididos) * 100) : null;
    const ticket = fechados.length ? fechados.reduce((s, r) => s + valorDe(r), 0) / fechados.length : 0;

    // Por que perde: motivos dos orçamentos recusados/cancelados + clientes marcados como perdidos
    const contagem = new Map();
    records.filter(ehPerdido).forEach((r) => {
      const m = motivoCurto(r.lostReason);
      if (m) contagem.set(m, (contagem.get(m) || 0) + 1);
    });
    Object.values(crm.leads || {}).forEach((l) => {
      const m = l.stage === "perdido" ? motivoCurto(l.lostReason) : "";
      if (m) contagem.set(m, (contagem.get(m) || 0) + 1);
    });
    const semMotivo = records.filter((r) => ehPerdido(r) && !motivoCurto(r.lostReason)).length;
    const motivos = [...contagem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

    // De onde vêm os clientes que mais pagam (últimos 12 meses)
    const anoAtras = new Date(agora - 365 * 86400000).toISOString().slice(0, 10);
    const porOrigem = new Map();
    records.filter((r) => ehTrabalho(r) && String(r.eventDate || r.createdAt || "") >= anoAtras).forEach((r) => {
      const origem = origemDoCliente(r) || "Sem origem marcada";
      const atual = porOrigem.get(origem) || { valor: 0, qtd: 0 };
      porOrigem.set(origem, { valor: atual.valor + valorDe(r), qtd: atual.qtd + 1 });
    });
    const origens = [...porOrigem.entries()].sort((a, b) => b[1].valor - a[1].valor).slice(0, 7);

    return { fechado, qtdMes: doMes.length, emNegociacao, taxa, fechados: fechados.length, perdidos: perdidos.length, abertos: abertos.length, ticket, motivos, semMotivo, origens };
  }, [records, crm.leads, mes, origemDoCliente, agora]);

  function salvarMeta() {
    const valor = Number(String(metaTexto).replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, ""));
    const goals = { ...(crm.goals || {}) };
    if (valor > 0) goals[mes] = Math.round(valor);
    else delete goals[mes];
    onChangeCrm({ ...crm, goals });
    setEditandoMeta(false);
  }

  const pct = meta ? Math.min(100, Math.round((dados.fechado / meta) * 100)) : 0;
  const pctNegociacao = meta ? Math.min(100 - pct, Math.round((dados.emNegociacao / meta) * 100)) : 0;
  const falta = Math.max(0, meta - dados.fechado);
  const maiorOrigem = Math.max(1, ...dados.origens.map(([, o]) => o.valor));
  const maiorMotivo = Math.max(1, ...dados.motivos.map(([, n]) => n));

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      {/* Meta do mês */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900"><Target className="h-4 w-4 text-[#7f274f]" />Meta do mês</h3>
          <div className="flex items-center gap-1 text-sm text-stone-700">
            <button type="button" onClick={() => setMes(somarMes(mes, -1))} className="rounded-full p-1 hover:bg-stone-100" aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></button>
            <span className="min-w-36 text-center">{nomeMes(mes)}</span>
            <button type="button" onClick={() => setMes(somarMes(mes, 1))} className="rounded-full p-1 hover:bg-stone-100" aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>

        {editandoMeta ? (
          <div className="flex gap-2">
            <input autoFocus inputMode="decimal" value={metaTexto} onChange={(e) => setMetaTexto(e.target.value)} onKeyDown={(e) => e.key === "Enter" && salvarMeta()} placeholder="Ex.: 15000" className="h-10 flex-1 rounded-xl border border-stone-300 px-3 text-sm" />
            <button type="button" onClick={salvarMeta} className="rounded-xl bg-[#7f274f] px-4 text-sm font-semibold text-white">Salvar</button>
            <button type="button" onClick={() => setEditandoMeta(false)} className="rounded-xl border border-stone-300 px-3 text-sm">Cancelar</button>
          </div>
        ) : meta ? (
          <>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold text-stone-900">{brl(dados.fechado)}</p>
                <p className="text-xs text-stone-500">de {brl(meta)} • {dados.qtdMes} trabalho{dados.qtdMes === 1 ? "" : "s"} no mês</p>
              </div>
              <p className={`text-3xl font-bold ${pct >= 100 ? "text-emerald-600" : "text-[#7f274f]"}`}>{pct}%</p>
            </div>
            <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full bg-[#7f274f]" style={{ width: `${pct}%` }} />
              <div className="h-full bg-[#7f274f]/30" style={{ width: `${pctNegociacao}%` }} />
            </div>
            <p className="mt-2 text-sm text-stone-700">
              {falta > 0 ? <>Faltam <b>{brl(falta)}</b>.</> : <b className="text-emerald-700">🎉 Meta batida!</b>}
              {dados.emNegociacao > 0 ? <> Em negociação para o mês: <b>{brl(dados.emNegociacao)}</b> (parte clara da barra).</> : null}
            </p>
            <button type="button" onClick={() => { setMetaTexto(String(meta)); setEditandoMeta(true); }} className="mt-2 text-xs font-semibold text-[#7f274f] underline">Mudar meta</button>
          </>
        ) : (
          <div>
            <p className="text-sm text-stone-600">Trabalhos com data em {nomeMes(mes)}: <b>{brl(dados.fechado)}</b> ({dados.qtdMes}).</p>
            <button type="button" onClick={() => { setMetaTexto(""); setEditandoMeta(true); }} className="mt-3 rounded-xl bg-[#7f274f] px-4 py-2 text-sm font-semibold text-white">Definir meta de {MESES[Number(mes.slice(5)) - 1]}</button>
          </div>
        )}
      </div>

      {/* Fechamento */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-900"><BarChart3 className="h-4 w-4 text-[#7f274f]" />Fechamento — últimos 90 dias</h3>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-emerald-50 p-3"><p className="text-2xl font-bold text-emerald-700">{dados.taxa === null ? "—" : `${dados.taxa}%`}</p><p className="text-xs text-stone-600">taxa de fechamento</p></div>
          <div className="rounded-xl bg-stone-50 p-3"><p className="text-2xl font-bold text-stone-900">{brl(dados.ticket)}</p><p className="text-xs text-stone-600">ticket médio</p></div>
          <div className="rounded-xl bg-amber-50 p-3"><p className="text-2xl font-bold text-amber-700">{dados.abertos}</p><p className="text-xs text-stone-600">ainda em aberto</p></div>
        </div>
        <p className="mt-2 text-xs text-stone-500">{dados.fechados} fechado{dados.fechados === 1 ? "" : "s"} e {dados.perdidos} perdido{dados.perdidos === 1 ? "" : "s"} entre os orçamentos e trabalhos criados nos últimos 90 dias.</p>
      </div>

      {/* Por que perde */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-stone-900">Por que você perde clientes</h3>
        {dados.motivos.length ? (
          dados.motivos.map(([motivo, n]) => (
            <div key={motivo} className="mb-1.5 flex items-center gap-2 text-sm">
              <span className="w-40 shrink-0 truncate text-stone-700">{motivo}</span>
              <span className="h-2.5 rounded-full bg-stone-400" style={{ width: `${Math.max(6, (n / maiorMotivo) * 60)}%` }} />
              <span className="text-xs text-stone-500">{n}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-stone-500">Ainda sem motivos anotados.</p>
        )}
        {dados.semMotivo ? <p className="mt-2 text-xs text-stone-500">{dados.semMotivo} cancelado{dados.semMotivo === 1 ? "" : "s"} sem motivo. Ao cancelar um orçamento, anote o motivo para este quadro ficar mais certo.</p> : null}
      </div>

      {/* Origem x faturamento */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-stone-900">De onde vêm os clientes que mais pagam <span className="font-normal text-stone-500">(12 meses)</span></h3>
        {dados.origens.length ? (
          dados.origens.map(([origem, o]) => (
            <div key={origem} className="mb-1.5 flex items-center gap-2 text-sm">
              <span className="w-36 shrink-0 truncate text-stone-700">{origem}</span>
              <span className={`h-2.5 rounded-full ${origem === "Sem origem marcada" ? "bg-stone-300" : "bg-[#7f274f]"}`} style={{ width: `${Math.max(6, (o.valor / maiorOrigem) * 50)}%` }} />
              <span className="whitespace-nowrap text-xs text-stone-500">{brl(o.valor)} • {o.qtd}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-stone-500">Sem trabalhos nos últimos 12 meses.</p>
        )}
        <p className="mt-2 text-xs text-stone-500">Marque a origem de cada cliente (abrindo o cliente no quadro) para saber onde vale investir.</p>
      </div>
    </section>
  );
}
