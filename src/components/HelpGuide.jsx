import { useState } from "react";
import { ChevronDown, ExternalLink, LifeBuoy } from "lucide-react";

// Guia rápido de cada aba do app (para o Emerson, a Isabel e quem mais usar)
const GUIDE = [
  ["Dashboard", [
    "No topo, “Próximos 7 dias” mostra a agenda da semana. Toque no nome para abrir o agendamento; “Lembrete” manda a mensagem pelo WhatsApp.",
    "Use as setas ao lado do mês para ver outros meses. Faturamento, Entrou, Contas e Lucro são sempre do mês escolhido.",
    "Defina a meta do mês em “Meta de faturamento” e acompanhe a barra.",
  ]],
  ["Agenda", [
    "“Novo agendamento” (botão do topo) cria um trabalho. Preencha cliente, data, horário, fotógrafo, serviço e valores.",
    "Status: Pendente → Confirmado → Concluído. Cancelados saem da agenda e vão para a aba Cancelados.",
    "Os eventos vão sozinhos para o Google Agenda “EH Estúdio” a cada hora.",
  ]],
  ["Orçamentos", [
    "“Novo orçamento” monta a proposta com os serviços. Gere o PDF ou mande o link para o cliente aprovar online.",
    "Quando o cliente aprova, o orçamento vira agendamento.",
    "Pedidos que chegam pelo formulário público (/pedido) aparecem no topo para você responder.",
  ]],
  ["Financeiro e Cobranças", [
    "Financeiro mostra todos os trabalhos com o que já foi pago e o que falta. “Dar baixa” registra um pagamento (valor, data e forma).",
    "Trabalho sem custo (ex.: pré-wedding incluso no casamento) também pode ser marcado como pago.",
    "Pagamentos por cartão (Mercado Pago) dão baixa sozinhos.",
  ]],
  ["Contas a pagar", [
    "Cadastre contas fixas (aluguel, energia, internet), variáveis e investimentos. As fixas se repetem todo mês.",
    "Marque como paga quando pagar. O total pago entra no “Lucro do mês” do Dashboard.",
  ]],
  ["Clientes", [
    "Cadastro com CPF, aniversário e se aceita receber novidades (LGPD). Reservas e pedidos online já preenchem sozinhos.",
    "“Avisar clientes (Natal)” abre a fila de mensagens de divulgação pelo WhatsApp.",
  ]],
  ["Ensaios (agenda online de Natal)", [
    "Mostra os dias e horários, quem reservou e o status do sinal. “Cobrar sinal” manda o Pix pelo WhatsApp; “Sinal recebido” confirma.",
    "“Transformar em 1 hora” junta o horário seguinte, dobra as fotos e prepara a cobrança da diferença.",
    "Se o prazo do sinal vencer, aparece um aviso vermelho no topo do app: cobrar, dar mais 24h ou excluir.",
    "“Bloquear”/“Liberar” em cada horário. Eventos da agenda bloqueiam os horários sozinhos.",
    "“Interessados que ainda não reservaram” lista quem viu os valores e não reservou, com botão Convidar.",
  ]],
  ["Seleção e Entregas", [
    "Crie a seleção com o nome do cliente e use “Importar fotos”: o app cria a pasta no Drive, envia as fotos e preenche o link.",
    "Quando o cliente envia a escolha, a lista de arquivos aparece para você copiar no Lightroom e uma entrega é criada como rascunho.",
    "Na entrega, coloque a pasta das fotos tratadas, marque “Link ativo” e mande o link pelo WhatsApp.",
  ]],
  ["Contratos", [
    "Gere o contrato a partir do agendamento e mande o link para assinatura online. O app avisa quando o cliente assina.",
  ]],
  ["Se algo der errado", [
    "Página em branco ou dados antigos: feche o app e abra de novo (no iPhone, arraste para cima e reabra).",
    "“Salvo na nuvem” no topo mostra que tudo foi gravado. Se aparecer outra mensagem, espere a internet voltar antes de fechar.",
    "Todo dia às 3h é feito um backup automático no Google Drive, e às 7h chega por e-mail a agenda do mês.",
  ]],
];

function Section({ title, tips }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button type="button" className="flex w-full items-center justify-between gap-3 py-3 text-left font-semibold text-slate-900" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        {title}
        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <ul className="list-disc space-y-1.5 pb-4 pl-5 text-sm leading-6 text-slate-600">
          {tips.map((tip) => <li key={tip}>{tip}</li>)}
        </ul>
      ) : null}
    </div>
  );
}

export default function HelpGuide() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
      <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <h2 className="pb-2 pt-2 text-xl font-semibold text-slate-900">Guia rápido do app</h2>
        <p className="pb-3 text-sm text-slate-500">Toque em cada aba para ver como usar.</p>
        {GUIDE.map(([title, tips]) => <Section key={title} title={title} tips={tips} />)}
      </section>
      <aside className="space-y-4">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="flex items-center gap-2 font-semibold text-slate-900"><LifeBuoy className="h-4 w-4" />Páginas para os clientes</p>
          <p className="mt-1 text-sm text-slate-500">Mande estes links quando o cliente tiver dúvida. Todas as páginas dos clientes já mostram “Precisa de ajuda?” no rodapé.</p>
          <ul className="mt-3 space-y-2 text-sm">
            {[["/ajuda", "Perguntas frequentes"], ["/privacidade", "Política de Privacidade"], ["/termos", "Termos de uso"], ["/natal", "Agendamento do Natal"], ["/pedido", "Pedido de orçamento"]].map(([path, label]) => (
              <li key={path}>
                <a href={path} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-sky-700 hover:underline">{label}<ExternalLink className="h-3 w-3" /></a>
                <span className="ml-1 text-xs text-slate-400">orcamento.emersonhonoratoretratos.com.br{path}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
