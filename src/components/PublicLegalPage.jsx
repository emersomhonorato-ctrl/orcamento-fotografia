import { STUDIO_WHATSAPP } from "@/lib/delivery";

const STUDIO = "Emerson Honorato Retratos";
const CITY = "Siderópolis/SC";
const EMAIL = "emersomhonorato@gmail.com";
const PHONE_LABEL = "(48) 99965-2317";
const UPDATED = "06/11/2026";

function Section({ title, children }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="space-y-2 text-[15px] leading-7 text-slate-700">{children}</div>
    </section>
  );
}

function Privacy() {
  return (
    <>
      <Section title="1. Quem cuida dos seus dados">
        <p>
          O estúdio <strong>{STUDIO}</strong>, de {CITY}, é o responsável (controlador) pelos dados pessoais coletados nas páginas de orçamento,
          agendamento, contrato, pagamento, seleção e entrega de fotos. Dúvidas ou pedidos sobre seus dados: WhatsApp {PHONE_LABEL} ou e-mail {EMAIL}.
        </p>
      </Section>
      <Section title="2. Quais dados pedimos">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Identificação e contato:</strong> nome completo, WhatsApp, e-mail.</li>
          <li><strong>Para o contrato:</strong> CPF e, quando necessário, endereço.</li>
          <li><strong>Data de nascimento:</strong> para cadastro e, se você autorizar, para lembrar do seu aniversário.</li>
          <li><strong>Informações do ensaio ou evento:</strong> data, local, pacote, pessoas e observações que você escrever.</li>
          <li><strong>Pagamentos:</strong> valores, forma e confirmação de pagamento. O estúdio não recebe nem guarda número de cartão: o pagamento com cartão é feito no ambiente do Mercado Pago.</li>
          <li><strong>Fotos:</strong> as imagens do seu ensaio ou evento e as fotos que você escolher na seleção.</li>
        </ul>
      </Section>
      <Section title="3. Para que usamos">
        <ul className="list-disc space-y-1 pl-5">
          <li>Responder seu pedido de orçamento, reservar o horário, preparar e assinar o contrato (execução de contrato).</li>
          <li>Confirmar pagamentos, emitir recibos e cumprir obrigações legais e fiscais (obrigação legal).</li>
          <li>Enviar lembretes do ensaio, o link de seleção e a entrega das fotos (execução de contrato).</li>
          <li>Enviar novidades, promoções e mensagens de aniversário <strong>somente se você autorizar</strong> (consentimento). Você pode cancelar quando quiser.</li>
        </ul>
        <p>Não vendemos seus dados e não os usamos para outra finalidade além das descritas aqui.</p>
      </Section>
      <Section title="4. Com quem os dados são compartilhados">
        <p>Somente com serviços necessários para o atendimento funcionar, que tratam os dados em nome do estúdio:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Supabase (banco de dados) e Vercel (hospedagem das páginas);</li>
          <li>Google (Drive para guardar as fotos, Agenda e e-mail);</li>
          <li>Mercado Pago (pagamento com cartão) e o banco do estúdio (Pix);</li>
          <li>WhatsApp, quando a conversa acontece por lá.</li>
        </ul>
        <p>Alguns desses serviços guardam dados fora do Brasil, com proteções previstas na LGPD.</p>
      </Section>
      <Section title="5. Uso das imagens">
        <p>
          As fotos são suas e são usadas para a entrega do trabalho. O estúdio só publica fotos suas (site, redes sociais, portfólio)
          com a sua autorização, combinada no contrato ou por mensagem. Você pode retirar essa autorização a qualquer momento para publicações futuras.
        </p>
      </Section>
      <Section title="6. Por quanto tempo guardamos">
        <p>
          Enquanto existir o relacionamento com o estúdio e, depois disso, pelo tempo exigido por lei (por exemplo, registros fiscais e de contrato,
          normalmente 5 anos). Os links de seleção e entrega de fotos ficam ativos pelo prazo informado no contrato ou na própria página.
          Contatos deixados só para ver valores, sem reserva, são apagados se você pedir.
        </p>
      </Section>
      <Section title="7. Seus direitos">
        <p>Pela LGPD (art. 18) você pode, a qualquer momento e sem custo:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>saber quais dados seus o estúdio tem e receber uma cópia;</li>
          <li>corrigir dados errados ou desatualizados;</li>
          <li>pedir para apagar dados que não sejam obrigatórios por lei;</li>
          <li>cancelar o recebimento de novidades e promoções;</li>
          <li>reclamar na Autoridade Nacional de Proteção de Dados (ANPD).</li>
        </ul>
        <p>Para isso, fale pelo WhatsApp {PHONE_LABEL} ou e-mail {EMAIL}. Respondemos em até 15 dias.</p>
      </Section>
      <Section title="8. Segurança">
        <p>
          Os dados ficam em serviços com acesso protegido por senha e conexão criptografada (https). Só a equipe do estúdio acessa o painel.
          Se acontecer algum incidente que possa trazer risco a você, avisaremos.
        </p>
      </Section>
      <Section title="9. Armazenamento no navegador">
        <p>
          As páginas guardam no seu próprio aparelho algumas informações para facilitar o uso (por exemplo, seu nome e WhatsApp para não pedir de novo).
          Não usamos cookies de propaganda. Você pode apagar esses dados limpando o histórico do navegador.
        </p>
      </Section>
    </>
  );
}

function Terms() {
  return (
    <>
      <Section title="1. Sobre estas páginas">
        <p>
          As páginas de orçamento, agendamento online, contrato, pagamento, seleção e entrega de fotos são do estúdio <strong>{STUDIO}</strong> ({CITY})
          e servem para você contratar e acompanhar o seu trabalho fotográfico.
        </p>
      </Section>
      <Section title="2. Informações verdadeiras">
        <p>Ao preencher os formulários, você confirma que os dados são seus (ou de quem você representa) e estão corretos. O contrato é feito com os dados informados.</p>
      </Section>
      <Section title="3. Reserva de horário e pagamento">
        <p>
          O horário escolhido no agendamento online fica reservado para você enquanto aguardamos o pagamento do sinal no prazo mostrado na página.
          Sem o pagamento no prazo, o estúdio pode liberar o horário para outra pessoa. Valores, pacotes, quantidade de fotos e prazos de entrega
          são os informados na página, no orçamento ou no contrato.
        </p>
      </Section>
      <Section title="4. Contrato">
        <p>
          As condições completas de cada serviço — remarcação, cancelamento, devolução de valores, direitos de imagem e prazos — estão no contrato
          ou no orçamento aprovado. Em caso de diferença, vale o que está no contrato.
        </p>
      </Section>
      <Section title="5. Links de seleção e entrega">
        <p>Os links são pessoais. Compartilhe só com quem você quiser que veja as fotos. Baixe e guarde suas fotos dentro do prazo informado.</p>
      </Section>
      <Section title="6. Privacidade">
        <p>O uso dos seus dados segue a <a className="font-medium text-[#7a1712] underline" href="/privacidade">Política de Privacidade</a>.</p>
      </Section>
      <Section title="7. Contato">
        <p>Dúvidas: WhatsApp {PHONE_LABEL} ou e-mail {EMAIL}. Estes termos seguem as leis brasileiras.</p>
      </Section>
    </>
  );
}

export default function PublicLegalPage({ page = "privacidade" }) {
  const isTerms = page === "termos";
  return (
    <div className="min-h-screen bg-[#f7f4ef] px-4 py-10 text-slate-900">
      <article className="mx-auto max-w-3xl space-y-7 rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm sm:p-10">
        <header className="space-y-2 border-b border-stone-100 pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9a7a40]">{STUDIO}</p>
          <h1 className="text-2xl font-semibold sm:text-3xl">{isTerms ? "Termos de uso" : "Política de Privacidade"}</h1>
          <p className="text-sm text-slate-500">Atualizada em {UPDATED}</p>
          <nav className="flex gap-4 pt-1 text-sm">
            <a href="/privacidade" className={isTerms ? "text-slate-500 hover:text-slate-900" : "font-semibold text-[#7a1712]"}>Privacidade</a>
            <a href="/termos" className={isTerms ? "font-semibold text-[#7a1712]" : "text-slate-500 hover:text-slate-900"}>Termos de uso</a>
          </nav>
        </header>
        {isTerms ? <Terms /> : <Privacy />}
        <footer className="border-t border-stone-100 pt-5 text-sm text-slate-500">
          Ficou com dúvida? <a className="font-medium text-emerald-700 underline" href={`https://wa.me/${STUDIO_WHATSAPP}`} target="_blank" rel="noreferrer">Fale com o estúdio no WhatsApp</a>.
        </footer>
      </article>
    </div>
  );
}
