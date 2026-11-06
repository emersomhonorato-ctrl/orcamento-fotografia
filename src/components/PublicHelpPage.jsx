import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQ = [
  {
    group: "Agendamento e reserva",
    items: [
      ["Como faço para reservar um horário?", "Abra o link de agendamento, informe nome e WhatsApp, escolha o pacote, o dia e o horário, preencha seus dados e toque em “Reservar meu horário”. Em seguida aparece o Pix do sinal."],
      ["Minha reserva já está garantida?", "O horário fica guardado para você enquanto aguardamos o sinal, no prazo mostrado na tela. Depois do pagamento, envie o comprovante pelo WhatsApp e o estúdio confirma a reserva."],
      ["Não apareceu o horário que eu queria.", "Os horários que somem já foram reservados ou estão bloqueados. Fale com o estúdio pelo WhatsApp: às vezes dá para abrir um encaixe."],
      ["Posso mudar o dia ou o horário?", "Fale com o estúdio pelo WhatsApp o quanto antes. A remarcação depende da agenda e das condições do seu contrato."],
      ["Quantas pessoas podem participar?", "No ensaio de Natal, o pacote inclui a família (pai, mãe e filhos). Pessoas a mais, como avós, têm um valor extra por pessoa, mostrado na página."],
    ],
  },
  {
    group: "Pagamento",
    items: [
      ["Como pago o sinal?", "Pelo Pix copia e cola que aparece depois da reserva (e que também vem pelo WhatsApp). Abra o app do seu banco, escolha Pix “copia e cola”, cole o código e confirme."],
      ["Posso pagar com cartão?", "Quando o link de pagamento oferecer cartão, o pagamento é feito em ambiente seguro do Mercado Pago. O estúdio não recebe o número do seu cartão."],
      ["Já paguei, e agora?", "Envie o comprovante pelo WhatsApp. Pagamentos com cartão são confirmados sozinhos."],
    ],
  },
  {
    group: "Contrato",
    items: [
      ["Como assino o contrato?", "Abra o link do contrato e leia com calma. No final, preencha seu nome completo e CPF, marque que concorda com as cláusulas e toque em “Assinar contrato”. Seu nome, CPF, data e hora ficam registrados como assinatura eletrônica."],
      ["Encontrei um erro nos meus dados.", "Não assine ainda: fale com o estúdio pelo WhatsApp que corrigimos e mandamos um link novo."],
    ],
  },
  {
    group: "Escolha das fotos (seleção)",
    items: [
      ["Como escolho minhas fotos?", "Abra o link da seleção, toque no coração das fotos que você mais gostou e, no final, toque em “Enviar minha escolha”. A quantidade incluída no seu pacote aparece no topo."],
      ["Quero mais fotos do que o meu pacote.", "Fale com o estúdio pelo WhatsApp: dá para incluir fotos extras, com valor por foto."],
      ["A página está pesada ou travando no celular.", "As fotos aparecem em páginas. Use os botões de página no fim da tela e, se travar, feche e abra o link de novo. Pelo computador fica ainda mais confortável."],
      ["Enviei a escolha errada.", "Fale com o estúdio pelo WhatsApp antes do tratamento começar que liberamos uma nova escolha."],
    ],
  },
  {
    group: "Entrega das fotos",
    items: [
      ["Como baixo minhas fotos?", "No link de entrega, toque em “Baixar todas as fotos”: abre o Google Drive, sem precisar de conta Google. No iPhone, as fotos podem ir para o app Arquivos: de lá, toque em compartilhar e “Salvar imagem”. Pelo computador é mais rápido."],
      ["Por quanto tempo o link fica disponível?", "Pelo prazo informado na página de entrega ou no contrato. Baixe e guarde suas fotos em um lugar seguro (computador, HD ou nuvem)."],
      ["Apareceu “Galeria não encontrada”.", "O link pode estar incompleto ou ainda não ter sido liberado. Fale com o estúdio pelo WhatsApp."],
    ],
  },
  {
    group: "Seus dados",
    items: [
      ["Por que vocês pedem CPF e data de nascimento?", "O CPF é usado no contrato. A data de nascimento entra no cadastro e, se você autorizar, para uma surpresa no seu aniversário. Tudo está explicado na Política de Privacidade."],
      ["Quero apagar ou corrigir meus dados.", "É só pedir pelo WhatsApp ou e-mail do estúdio. Respondemos em até 15 dias."],
    ],
  },
];

function Item({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-stone-100 last:border-0">
      <button type="button" className="flex w-full items-center justify-between gap-3 py-3 text-left text-[15px] font-medium text-slate-900" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        {question}
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <p className="pb-4 text-[15px] leading-7 text-slate-600">{answer}</p> : null}
    </div>
  );
}

export default function PublicHelpPage() {
  return (
    <div className="min-h-screen bg-[#f7f4ef] px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9a7a40]">Emerson Honorato Retratos</p>
          <h1 className="text-2xl font-semibold sm:text-3xl">Perguntas frequentes</h1>
          <p className="text-sm text-slate-500">Toque na pergunta para ver a resposta. Não achou? Fale com o estúdio no WhatsApp logo abaixo.</p>
        </header>
        {FAQ.map((section) => (
          <section key={section.group} className="rounded-[24px] border border-stone-200 bg-white px-5 py-2 shadow-sm sm:px-7">
            <h2 className="pb-1 pt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#7a1712]">{section.group}</h2>
            {section.items.map(([question, answer]) => <Item key={question} question={question} answer={answer} />)}
          </section>
        ))}
      </div>
    </div>
  );
}
