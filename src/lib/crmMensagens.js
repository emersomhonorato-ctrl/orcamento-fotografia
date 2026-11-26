// Mensagens prontas do CRM: uma para cada momento do cliente.
// Palavras entre chaves são trocadas sozinhas: {nome} {servico} {data} {valor}
import { formatDateBR } from "@/utils/formatters";

export const MENSAGENS_PADRAO = [
  {
    id: "primeiro",
    titulo: "Primeiro contato",
    etapas: ["novo", "conversa"],
    texto:
      "Oi, {nome}! Tudo bem? Aqui é o Emerson, da Emerson Honorato Retratos 📸\n\nQue bom ter você por aqui! Me conta um pouquinho: qual ensaio ou evento você está pensando e para mais ou menos quando? Assim já te passo as opções certinhas. 😊",
  },
  {
    id: "orcamento",
    titulo: "Depois do orçamento",
    etapas: ["orcamento"],
    texto:
      "Oi, {nome}! Conseguiu ver o orçamento de {servico}? 😊\n\nSe quiser, te ajudo a escolher o pacote que fica melhor para você, ou ajusto alguma coisa. É só me dizer!",
  },
  {
    id: "cobrar",
    titulo: "Cobrar resposta",
    etapas: ["negociacao", "orcamento"],
    texto:
      "Oi, {nome}! Passando para saber se ficou alguma dúvida sobre {servico}. 😊\n\nA data {data} ainda está livre na minha agenda, mas não consigo segurar por muito tempo. Quer que eu reserve para você?",
  },
  {
    id: "confirmacao",
    titulo: "Confirmação do trabalho",
    etapas: ["fechado"],
    texto:
      "Oi, {nome}! Tudo certinho para {servico} no dia {data} ✅\n\nQualquer dúvida sobre roupas, local ou horário, é só me chamar. Vai ficar lindo! 🤍",
  },
  {
    id: "posentrega",
    titulo: "Pós-entrega (avaliação e indicação)",
    etapas: ["fechado"],
    texto:
      "Oi, {nome}! Espero que tenha amado as fotos 🤍\n\nSe puder, me ajuda muito deixar uma avaliação no Google contando como foi.\n\nE se indicar uma amiga ou família que feche comigo, você ganha 5 fotos extras no seu próximo ensaio! 🎁",
  },
  {
    id: "reativar",
    titulo: "Retomar contato",
    etapas: ["perdido"],
    texto:
      "Oi, {nome}! Tudo bem? Aqui é o Emerson 📸\n\nFaz um tempinho que a gente não se fala! Estou com alguns horários abertos nas próximas semanas. Quer que eu te mande as novidades e os pacotes atuais?",
  },
];

// Texto de cada mensagem: o que você salvou no CRM ou o padrão
export function textoDaMensagem(id, crm) {
  const salvo = crm?.templates?.[id];
  if (salvo) return salvo;
  return MENSAGENS_PADRAO.find((m) => m.id === id)?.texto || "";
}

// Mensagem sugerida para a etapa do cliente
export function mensagemSugerida(etapa, registros = []) {
  if (etapa === "fechado") {
    const hoje = new Date().toISOString().slice(0, 10);
    const futuro = registros.some((r) => r.recordType !== "orcamento" && r.status !== "Cancelado" && String(r.eventDate || "") >= hoje);
    return futuro ? "confirmacao" : "posentrega";
  }
  return (MENSAGENS_PADRAO.find((m) => m.etapas.includes(etapa)) || MENSAGENS_PADRAO[0]).id;
}

// Troca {nome} {servico} {data} {valor} pelos dados do cliente (do trabalho/orçamento mais recente)
export function preencherMensagem(texto, cliente, registros = []) {
  const ultimo = [...registros]
    .filter((r) => r.status !== "Cancelado")
    .sort((a, b) => String(b.eventDate || b.createdAt || "").localeCompare(String(a.eventDate || a.createdAt || "")))[0];
  const valor = ultimo ? Number(ultimo.computedAmount || ultimo.amount || 0) : 0;
  const trocas = {
    nome: String(cliente?.name || "").split(" ")[0] || "tudo bem",
    servico: ultimo?.eventType || "o seu ensaio",
    data: ultimo?.eventDate ? formatDateBR(ultimo.eventDate) : "que você quer",
    valor: valor ? valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "",
  };
  return String(texto || "").replace(/\{(nome|servico|data|valor)\}/g, (_, chave) => trocas[chave]);
}
