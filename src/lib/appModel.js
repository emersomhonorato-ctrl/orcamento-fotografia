import { getItemsTotal, normalizeItems } from "@/utils/formatters";

export const STORAGE_KEY = "studio_manager_data";

export const EVENT_STATUS_OPTIONS = ["Pendente", "Confirmado", "Concluído", "Cancelado"];
export const BUDGET_STATUS_OPTIONS = ["Pendente", "Em negociação", "Aprovado", "Cancelado"];
export const PAYMENT_OPTIONS = ["Pendente", "Entrada paga", "Pago", "Atrasado"];

export const defaultServices = [
  {
    id: crypto.randomUUID(),
    name: "Ensaio Individual",
    category: "Ensaio",
    price: 450,
    itemDescription: "Ensaio individual com direção personalizada, construção de poses, escolha de enquadramentos e seleção final das melhores imagens.",
    onlinePhotosCount: 0,
    editedPhotosCount: 0,
    photoSize: "",
    workDescription: "Sessão fotográfica individual com proposta leve e elegante, conduzida com direção durante todo o ensaio, tratamento profissional das imagens e entrega final pensada para valorizar sua identidade e presença.",
    contractPaymentMethod: "50% na reserva da data e restante na data do ensaio.",
    contractDeliveryTerms: "Entrega em galeria online no prazo combinado entre as partes.",
    defaultEventStatus: "Confirmado",
    defaultBudgetStatus: "Pendente",
    defaultPaymentStatus: "Pendente",
    defaultEventNotes: "",
    defaultBudgetNotes: "",
    defaultContractNotes: "",
  },
  {
    id: crypto.randomUUID(),
    name: "Ensaio de Casal",
    category: "Ensaio",
    price: 650,
    itemDescription: "Ensaio de casal com direção natural, registros de conexão, momentos espontâneos e composição romântica em estúdio ou locação externa.",
    onlinePhotosCount: 0,
    editedPhotosCount: 0,
    photoSize: "",
    workDescription: "Ensaio fotográfico para casal com foco em conexão, narrativa visual, direção sensível e tratamento profissional das imagens para entrega final com unidade estética e emocional.",
    contractPaymentMethod: "50% na reserva da data e restante na data do ensaio.",
    contractDeliveryTerms: "Entrega em galeria online no prazo combinado entre as partes.",
    defaultEventStatus: "Confirmado",
    defaultBudgetStatus: "Pendente",
    defaultPaymentStatus: "Pendente",
    defaultEventNotes: "",
    defaultBudgetNotes: "",
    defaultContractNotes: "",
  },
  {
    id: crypto.randomUUID(),
    name: "Gestante",
    category: "Ensaio",
    price: 650,
    itemDescription: "Ensaio gestante com direção delicada, valorização da fase da maternidade, trocas de figurino e construção de imagens afetivas e elegantes.",
    onlinePhotosCount: 0,
    editedPhotosCount: 0,
    photoSize: "",
    workDescription: "Ensaio de gestante desenvolvido com sensibilidade, direção cuidadosa e tratamento profissional das imagens para registrar esse período de forma leve, sofisticada e emocional.",
    contractPaymentMethod: "50% na reserva da data e restante na data do ensaio.",
    contractDeliveryTerms: "Entrega em galeria online no prazo combinado entre as partes.",
    defaultEventStatus: "Confirmado",
    defaultBudgetStatus: "Pendente",
    defaultPaymentStatus: "Pendente",
    defaultEventNotes: "",
    defaultBudgetNotes: "",
    defaultContractNotes: "",
  },
  {
    id: crypto.randomUUID(),
    name: "Ensaio Newborn",
    category: "Ensaio",
    price: 850,
    itemDescription: "Sessão newborn com produção delicada, poses seguras e seleção final das imagens.",
    onlinePhotosCount: 0,
    editedPhotosCount: 0,
    photoSize: "",
    workDescription: "Ensaio newborn com direção cuidadosa, ambiente acolhedor e tratamento profissional das imagens.",
    contractPaymentMethod: "50% na reserva da data e restante na data do ensaio.",
    contractDeliveryTerms: "Entrega em galeria online no prazo combinado entre as partes.",
    defaultEventStatus: "Confirmado",
    defaultBudgetStatus: "Pendente",
    defaultPaymentStatus: "Pendente",
    defaultEventNotes: "",
    defaultBudgetNotes: "",
    defaultContractNotes: "",
  },
  {
    id: crypto.randomUUID(),
    name: "Ensaio Profissional",
    category: "Ensaio",
    price: 700,
    itemDescription: "Retratos profissionais para imagem pessoal, redes sociais, currículo e posicionamento.",
    onlinePhotosCount: 0,
    editedPhotosCount: 0,
    photoSize: "",
    workDescription: "Ensaio profissional com direção de postura, expressão e linguagem visual alinhada ao seu perfil.",
    contractPaymentMethod: "50% na reserva da data e restante na data do ensaio.",
    contractDeliveryTerms: "Entrega em galeria online no prazo combinado entre as partes.",
    defaultEventStatus: "Confirmado",
    defaultBudgetStatus: "Pendente",
    defaultPaymentStatus: "Pendente",
    defaultEventNotes: "",
    defaultBudgetNotes: "",
    defaultContractNotes: "",
  },
  {
    id: crypto.randomUUID(),
    name: "Ensaio de Família",
    category: "Ensaio",
    price: 780,
    itemDescription: "Sessão em estúdio ou externa para registrar conexão, afeto e espontaneidade da família.",
    onlinePhotosCount: 0,
    editedPhotosCount: 0,
    photoSize: "",
    workDescription: "Ensaio de família com direção leve, registros espontâneos e tratamento profissional das imagens.",
    contractPaymentMethod: "50% na reserva da data e restante na data do ensaio.",
    contractDeliveryTerms: "Entrega em galeria online no prazo combinado entre as partes.",
    defaultEventStatus: "Confirmado",
    defaultBudgetStatus: "Pendente",
    defaultPaymentStatus: "Pendente",
    defaultEventNotes: "",
    defaultBudgetNotes: "",
    defaultContractNotes: "",
  },
  {
    id: crypto.randomUUID(),
    name: "Ensaio Infantil",
    category: "Ensaio",
    price: 690,
    itemDescription: "Sessão infantil com abordagem lúdica, tempo da criança e imagens cheias de personalidade.",
    onlinePhotosCount: 0,
    editedPhotosCount: 0,
    photoSize: "",
    workDescription: "Ensaio infantil com condução leve e sensível para registrar expressões autênticas e momentos naturais.",
    contractPaymentMethod: "50% na reserva da data e restante na data do ensaio.",
    contractDeliveryTerms: "Entrega em galeria online no prazo combinado entre as partes.",
    defaultEventStatus: "Confirmado",
    defaultBudgetStatus: "Pendente",
    defaultPaymentStatus: "Pendente",
    defaultEventNotes: "",
    defaultBudgetNotes: "",
    defaultContractNotes: "",
  },
  {
    id: crypto.randomUUID(),
    name: "Cobertura de Casamento",
    category: "Evento",
    price: 3500,
    itemDescription: "Cobertura fotográfica do casamento com registros da cerimônia, recepção, detalhes da ambientação, retratos do casal e momentos essenciais do evento.",
    onlinePhotosCount: 0,
    editedPhotosCount: 0,
    photoSize: "",
    workDescription: "Cobertura completa de casamento com olhar documental e direção nos momentos certos, registrando a narrativa do dia com tratamento profissional e entrega final organizada.",
    contractPaymentMethod: "30% na reserva da data e saldo conforme cronograma definido entre as partes.",
    contractDeliveryTerms: "Entrega em galeria online no prazo contratado, com demais formatos conforme pacote escolhido.",
    defaultEventStatus: "Confirmado",
    defaultBudgetStatus: "Pendente",
    defaultPaymentStatus: "Pendente",
    defaultEventNotes: "",
    defaultBudgetNotes: "",
    defaultContractNotes: "",
  },
  {
    id: crypto.randomUUID(),
    name: "Formatura",
    category: "Evento",
    price: 1800,
    itemDescription: "Cobertura de formatura com registros da solenidade, homenagens, convidados, retratos individuais e momentos marcantes da celebração.",
    onlinePhotosCount: 0,
    editedPhotosCount: 0,
    photoSize: "",
    workDescription: "Cobertura de formatura com foco em cerimônia, retratos e momentos de celebração, conduzida com atenção ao protocolo do evento e tratamento profissional das imagens.",
    contractPaymentMethod: "50% na reserva da data e restante até a realização do evento.",
    contractDeliveryTerms: "Entrega em galeria online no prazo combinado entre as partes.",
    defaultEventStatus: "Confirmado",
    defaultBudgetStatus: "Pendente",
    defaultPaymentStatus: "Pendente",
    defaultEventNotes: "",
    defaultBudgetNotes: "",
    defaultContractNotes: "",
  },
  {
    id: crypto.randomUUID(),
    name: "Cobertura Corporativa",
    category: "Evento",
    price: 1600,
    itemDescription: "Cobertura de evento corporativo com registros institucionais, palestras, networking e ambientação.",
    onlinePhotosCount: 0,
    editedPhotosCount: 0,
    photoSize: "",
    workDescription: "Cobertura corporativa com olhar estratégico para fortalecer a comunicação visual da marca e do evento.",
    contractPaymentMethod: "50% na confirmação da data e saldo conforme prazo acordado.",
    contractDeliveryTerms: "Entrega em galeria online ou link de download no prazo combinado entre as partes.",
    defaultEventStatus: "Confirmado",
    defaultBudgetStatus: "Pendente",
    defaultPaymentStatus: "Pendente",
    defaultEventNotes: "",
    defaultBudgetNotes: "",
    defaultContractNotes: "",
  },
];

export const robustContractTemplate = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS FOTOGRÁFICOS

CONTRATANTE

Nome: {NOME_CLIENTE}
CPF/CNPJ: {CPF_CLIENTE}
Telefone: {CLIENTE_TELEFONE}
E-mail: {CLIENTE_EMAIL}

CONTRATADO

{NOME_EMPRESA}
Responsável: {RESPONSAVEL_EMPRESA}
CPF/CNPJ: {DOCUMENTO_EMPRESA}
Telefone: {TELEFONE_EMPRESA}
E-mail: {EMAIL_EMPRESA}

CLÁUSULA 1 – OBJETO

O presente contrato tem como objeto a prestação de serviços fotográficos pelo CONTRATADO ao CONTRATANTE, conforme descrito abaixo:

Tipo de serviço: {TIPO_EVENTO}
Data: {DATA_EVENTO}
Local: {LOCAL_EVENTO}
Duração: {HORAS_EVENTO}

CLÁUSULA 2 – DESCRIÇÃO DOS SERVIÇOS

Descrição específica do serviço contratado:
{DESCRICAO_SERVICO}

Parágrafo único: A quantidade de fotos entregues pode variar conforme dinâmica do evento, condições do local, duração efetiva da cobertura e critérios técnicos do fotógrafo, sendo prevista a entrega de aproximadamente {QUANTIDADE_FOTOS} imagens finais.

CLÁUSULA 3 – PRAZO DE ENTREGA

A entrega das imagens será realizada por {FORMA_ENTREGA}, no prazo de até {PRAZO_ENTREGA} dias, contados a partir da data do evento/ensaio.

CLÁUSULA 4 – VALOR E FORMA DE PAGAMENTO

O valor total do serviço é de:

R$ {VALOR_TOTAL}

Forma de pagamento:

{FORMA_PAGAMENTO_CONTRATO}

Parágrafo 1º: O não pagamento nas condições acordadas poderá acarretar suspensão da entrega do material até a regularização integral dos valores pendentes.
Parágrafo 2º: Valores pagos para reserva de data não são reembolsáveis em caso de cancelamento por iniciativa do CONTRATANTE, salvo ajuste expresso diverso.

CLÁUSULA 5 – RESERVA DE DATA

A data somente será considerada reservada após:

Assinatura deste contrato
Pagamento do sinal ou da condição inicial ajustada

CLÁUSULA 6 – CANCELAMENTO E REAGENDAMENTO

Cancelamentos não dão direito à devolução do sinal ou do valor inicial destinado à reserva.
Reagendamentos poderão ser realizados mediante disponibilidade de agenda do CONTRATADO.
Em caso de impossibilidade real e comprovada do CONTRATADO, poderá ser indicado outro profissional de confiança ou realizada a devolução integral dos valores pagos, conforme viabilidade do caso.

CLÁUSULA 7 – RESPONSABILIDADES DO CONTRATANTE

O CONTRATANTE se compromete a:

Comparecer ou providenciar a realização do evento no horário combinado
Garantir condições adequadas para realização do trabalho
Informar previamente restrições, exigências do local e orientações relevantes

Parágrafo único: Atrasos, mudanças abruptas de cronograma, interferências externas ou ausência de colaboração mínima poderão reduzir o tempo útil de cobertura sem compensação proporcional obrigatória.

CLÁUSULA 8 – RESPONSABILIDADES DO CONTRATADO

O CONTRATADO se compromete a:

Comparecer no local e horário acordados
Executar o serviço com qualidade técnica e profissional
Entregar o material conforme descrito neste contrato e na proposta aprovada

CLÁUSULA 9 – DIREITOS AUTORAIS E USO DE IMAGEM

As fotografias são protegidas pela legislação de direitos autorais.
O CONTRATADO mantém os direitos autorais das imagens, podendo utilizá-las para portfólio, redes sociais e divulgação profissional, observada a cláusula abaixo:

{AUTORIZACAO_IMAGEM}

O CONTRATANTE recebe direito de uso pessoal das imagens, vedada sua comercialização, alteração substancial sem crédito ou cessão para terceiros sem autorização.

Parágrafo único: Caso o CONTRATANTE não autorize o uso das imagens, deverá informar por escrito antes da entrega final.

CLÁUSULA 10 – LGPD (PROTEÇÃO DE DADOS)

Nos termos da Lei Geral de Proteção de Dados Pessoais (LGPD), os dados do CONTRATANTE serão utilizados exclusivamente para execução deste contrato, comunicação operacional, emissão de documentos e entrega do material.
As informações não serão compartilhadas com terceiros sem fundamento legal, necessidade operacional legítima ou autorização aplicável.
O CONTRATANTE poderá solicitar atualização, correção ou exclusão de seus dados nos limites da legislação vigente.

CLÁUSULA 11 – LIMITAÇÃO DE RESPONSABILIDADE

O CONTRATADO não se responsabiliza por:

Condições climáticas adversas
Interferências externas no evento
Problemas causados por terceiros
Perda de registros por força maior, falha técnica extrema, roubo ou situações imprevisíveis fora de controle razoável

Parágrafo único: Em caso de falha comprovada e exclusiva do CONTRATADO, a responsabilidade ficará limitada à devolução dos valores efetivamente pagos pelo serviço contratado, sem prejuízo de solução consensual eventualmente ajustada entre as partes.

CLÁUSULA 12 – FORO

Fica eleito o foro da comarca de residência do CONTRATADO, atualmente em {CIDADE}, para dirimir quaisquer dúvidas oriundas deste contrato.

CLÁUSULA 13 – DISPOSIÇÕES GERAIS

Este contrato é válido após manifestação de concordância entre as partes e vincula CONTRATANTE e CONTRATADO ao cumprimento de seus termos.
Qualquer alteração relevante deverá ser feita por escrito.
As partes declaram estar de acordo com todas as cláusulas aqui previstas.

{CIDADE}, {DATA_ATUAL}

ASSINATURAS

CONTRATANTE:
{NOME_CLIENTE}

CONTRATADO:
{NOME_EMPRESA}`;

export function getSuggestedContractTemplate() {
  return robustContractTemplate;
}

export const defaultSettings = {
  studioName: "Emerson Honorato Retratos",
  studioResponsible: "Emerson Honorato",
  studioDocument: "",
  studioPhone: "",
  studioEmail: "",
  studioInstagram: "@emersonhonoratoretratos",
  studioCity: "",
  reminderDaysBefore: 1,
  reminderSameDay: true,
  emailSignature: "Atenciosamente,\nEmerson Honorato Retratos",
  budgetValidityDays: 7,
  paymentTerms: "50% na reserva da data e restante na data do evento ou ensaio.",
  pdfFooter: "Obrigado pela oportunidade.",
  themeColor: "classico",
  contractCity: "",
  contractForum: "",
  contractImageAuthorization: "O CONTRATANTE autoriza o uso das imagens para portfólio, divulgação em redes sociais, site e materiais promocionais, salvo manifestação contrária por escrito.",
  contractTemplate: robustContractTemplate,
  logoDataUrl: "",
  signatureDataUrl: "",
};

export const emptyClient = {
  id: null,
  name: "",
  cpf: "",
  email: "",
  phone: "",
  whatsapp: "",
  city: "",
  address: "",
  instagram: "",
  notes: "",
};

export const defaultForm = {
  id: null,
  clientId: "",
  clientName: "",
  clientCpf: "",
  clientAddress: "",
  email: "",
  phone: "",
  whatsapp: "",
  eventType: "",
  eventDate: "",
  startTime: "",
  endTime: "",
  location: "",
  amount: "",
  amountPaid: "",
  budgetDescription: "",
  items: [],
  recordType: "evento",
  status: "Pendente",
  paymentStatus: "Pendente",
  budgetValidityDays: "",
  recommendedDeliveryDays: "",
  receiptDate: "",
  receiptMethod: "",
  receiptReference: "",
  contractPaymentMethod: "",
  contractDeliveryTerms: "",
  contractNotes: "",
  reminderSent: false,
  sameDayReminderSent: false,
  notes: "",
  packageName: "",
  serviceDescriptionSnapshot: "",
  serviceItemsSnapshot: "",
  onlinePhotosCount: "",
  editedPhotosCount: "",
  photoSize: "",
  digitalPhotosCount: "",
  printedPhotosCount: "",
  createdAt: "",
  updatedAt: "",
};

export const defaultServiceForm = {
  id: null,
  name: "",
  category: "",
  price: "",
  itemDescription: "",
  onlinePhotosCount: "",
  editedPhotosCount: "",
  photoSize: "",
  workDescription: "",
  contractPaymentMethod: "",
  contractDeliveryTerms: "",
  defaultNotes: "",
  defaultReceiptReference: "",
  defaultEventStatus: "Confirmado",
  defaultBudgetStatus: "Pendente",
  defaultPaymentStatus: "Pendente",
  defaultEventNotes: "",
  defaultBudgetNotes: "",
  defaultContractNotes: "",
  defaultBudgetValidityDays: "",
  defaultReceiptMethod: "",
  recommendedDeliveryDays: "",
};

export const mergeServicesByName = (services = []) => {
  const currentServices = Array.isArray(services) ? services : [];
  const existingNames = new Set(
    currentServices.map((service) => String(service?.name || "").trim().toLowerCase()).filter(Boolean),
  );

  const missingDefaults = defaultServices.filter(
    (service) => !existingNames.has(String(service.name || "").trim().toLowerCase()),
  );

  return [...currentServices, ...missingDefaults];
};

export function createDefaultAppState() {
  return {
    events: [],
    clients: [],
    services: mergeServicesByName([]),
    settings: defaultSettings,
  };
}

export function getDefaultStatus(recordType) {
  return recordType === "orcamento" ? "Pendente" : "Confirmado";
}

export function getStatusOptions(recordType) {
  return recordType === "orcamento" ? BUDGET_STATUS_OPTIONS : EVENT_STATUS_OPTIONS;
}

export function deriveRecordType(record = {}) {
  if (record.recordType === "orcamento" || record.recordType === "evento") {
    return record.recordType;
  }

  return record.eventDate ? "evento" : "orcamento";
}

export function normalizeService(service) {
  const source = service && typeof service === "object" ? service : {};

  return {
    id: source.id || crypto.randomUUID(),
    name: source.name || source.serviceName || "",
    category: source.category || source.type || "",
    price: Number(source.price || source.amount || source.value || 0),
    itemDescription: source.itemDescription || source.description || "",
    onlinePhotosCount: Number(source.onlinePhotosCount || source.digitalPhotosCount || 0),
    editedPhotosCount: Number(source.editedPhotosCount || source.printedPhotosCount || 0),
    photoSize: source.photoSize || source.photoFormat || source.printSize || "",
    workDescription: source.workDescription || source.description || source.budgetDescription || "",
    contractPaymentMethod: source.contractPaymentMethod || source.paymentTerms || "",
    contractDeliveryTerms: source.contractDeliveryTerms || source.deliveryTerms || "",
    defaultNotes: source.defaultNotes || source.notes || "",
    defaultReceiptReference: source.defaultReceiptReference || source.receiptReference || "",
    defaultEventStatus: EVENT_STATUS_OPTIONS.includes(source.defaultEventStatus) ? source.defaultEventStatus : "Confirmado",
    defaultBudgetStatus: BUDGET_STATUS_OPTIONS.includes(source.defaultBudgetStatus) ? source.defaultBudgetStatus : "Pendente",
    defaultPaymentStatus: PAYMENT_OPTIONS.includes(source.defaultPaymentStatus) ? source.defaultPaymentStatus : "Pendente",
    defaultEventNotes: source.defaultEventNotes || source.eventNotes || "",
    defaultBudgetNotes: source.defaultBudgetNotes || source.budgetNotes || "",
    defaultContractNotes: source.defaultContractNotes || source.contractNotes || "",
    defaultBudgetValidityDays: source.defaultBudgetValidityDays ? Number(source.defaultBudgetValidityDays) : "",
    defaultReceiptMethod: source.defaultReceiptMethod || source.receiptMethod || "",
    recommendedDeliveryDays: source.recommendedDeliveryDays ? Number(source.recommendedDeliveryDays) : "",
  };
}

export function normalizeClient(client) {
  const source = client && typeof client === "object" ? client : {};

  return {
    id: source.id || crypto.randomUUID(),
    name: source.name || source.clientName || "",
    cpf: source.cpf || source.clientCpf || "",
    email: source.email || "",
    phone: source.phone || "",
    whatsapp: source.whatsapp || source.phone || "",
    city: source.city || source.clientCity || "",
    address: source.address || source.clientAddress || "",
    instagram: source.instagram || "",
    notes: source.notes || source.observations || "",
  };
}

export function normalizeRecord(record = {}) {
  const source = record && typeof record === "object" ? record : {};
  const recordType = deriveRecordType(record);
  const items = normalizeItems(source.items || source.budgetItems || []);
  const totalFromItems = getItemsTotal(items);
  const amount = Number(totalFromItems > 0 ? totalFromItems : source.amount || source.total || source.computedAmount || source.value || 0);
  const amountPaid = Math.min(Number(source.amountPaid || source.paidAmount || 0), amount || Number(source.amountPaid || source.paidAmount || 0));

  return {
    ...source,
    id: source.id || crypto.randomUUID(),
    clientId: source.clientId || "",
    clientName: source.clientName || source.name || "",
    clientCpf: source.clientCpf || source.cpf || "",
    clientAddress: source.clientAddress || source.address || "",
    email: source.email || "",
    phone: source.phone || "",
    whatsapp: source.whatsapp || source.phone || "",
    eventType: source.eventType || source.serviceName || source.type || "",
    eventDate: source.eventDate || source.date || "",
    startTime: source.startTime || source.time || "",
    endTime: source.endTime || "",
    location: source.location || source.addressLine || "",
    amount,
    amountPaid,
    budgetDescription: source.budgetDescription || source.description || "",
    items,
    recordType,
    status: getStatusOptions(recordType).includes(source.status) ? source.status : getDefaultStatus(recordType),
    paymentStatus: PAYMENT_OPTIONS.includes(source.paymentStatus) ? source.paymentStatus : "Pendente",
    budgetValidityDays: Number(source.budgetValidityDays || source.validityDays || 0),
    recommendedDeliveryDays: Number(source.recommendedDeliveryDays || source.deliveryDays || 0),
    receiptDate: source.receiptDate || "",
    receiptMethod: source.receiptMethod || source.paymentMethod || "",
    receiptReference: source.receiptReference || source.paymentReference || "",
    contractPaymentMethod: source.contractPaymentMethod || source.paymentTerms || "",
    contractDeliveryTerms: source.contractDeliveryTerms || source.deliveryTerms || "",
    contractNotes: source.contractNotes || source.contractObservations || "",
    reminderSent: Boolean(source.reminderSent),
    sameDayReminderSent: Boolean(source.sameDayReminderSent),
    notes: source.notes || source.observations || "",
    packageName: source.packageName || source.eventType || source.serviceName || "",
    serviceDescriptionSnapshot: source.serviceDescriptionSnapshot || source.workDescription || source.budgetDescription || "",
    serviceItemsSnapshot: source.serviceItemsSnapshot || source.itemDescription || "",
    onlinePhotosCount: Number(source.onlinePhotosCount || source.digitalPhotosCount || 0),
    editedPhotosCount: Number(source.editedPhotosCount || source.printedPhotosCount || 0),
    photoSize: source.photoSize || source.photoFormat || source.printSize || "",
    digitalPhotosCount: Number(source.digitalPhotosCount || source.onlinePhotosCount || 0),
    printedPhotosCount: Number(source.printedPhotosCount || source.editedPhotosCount || 0),
    createdAt: source.createdAt || new Date().toISOString(),
    updatedAt: source.updatedAt || new Date().toISOString(),
  };
}

export function normalizeAppState(raw) {
  const base = createDefaultAppState();
  const source = raw && typeof raw === "object" ? raw : {};
  const payload = source.payload && typeof source.payload === "object"
    ? source.payload
    : source.appState && typeof source.appState === "object"
      ? source.appState
      : source.state && typeof source.state === "object"
        ? source.state
        : source;
  const legacySettings = {
    studioName: payload.studioName,
    studioResponsible: payload.studioResponsible,
    studioDocument: payload.studioDocument,
    studioPhone: payload.studioPhone,
    studioEmail: payload.studioEmail,
    studioInstagram: payload.studioInstagram,
    studioCity: payload.studioCity,
    reminderDaysBefore: payload.reminderDaysBefore,
    reminderSameDay: payload.reminderSameDay,
    emailSignature: payload.emailSignature,
    budgetValidityDays: payload.budgetValidityDays,
    paymentTerms: payload.paymentTerms,
    pdfFooter: payload.pdfFooter,
    themeColor: payload.themeColor,
    contractCity: payload.contractCity,
    contractForum: payload.contractForum,
    contractImageAuthorization: payload.contractImageAuthorization,
    contractTemplate: payload.contractTemplate,
    logoDataUrl: payload.logoDataUrl,
    signatureDataUrl: payload.signatureDataUrl,
  };

  const sanitizeContractTemplate = (template) => {
    const value = String(template || "");
    if (!value) return value;

    return value.replace(
      /O serviço inclui:\n\nCobertura fotográfica conforme tempo contratado\nDireção durante o ensaio\/evento\nSeleção e tratamento profissional das imagens\nEntrega digital das fotografias em alta resolução\n\n/s,
      "",
    );
  };

  return {
    events: Array.isArray(payload.events) ? payload.events.map(normalizeRecord) : base.events,
    clients: Array.isArray(payload.clients) ? payload.clients.map(normalizeClient) : base.clients,
    services: Array.isArray(payload.services) && payload.services.length > 0
      ? mergeServicesByName(payload.services.map(normalizeService))
      : base.services,
    settings: {
      ...base.settings,
      ...legacySettings,
      ...(payload.settings || {}),
      contractTemplate: sanitizeContractTemplate(
        payload.settings?.contractTemplate || legacySettings.contractTemplate || base.settings.contractTemplate,
      ),
    },
  };
}

export function readLocalAppState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return normalizeAppState(null);
    return normalizeAppState(JSON.parse(saved));
  } catch {
    return normalizeAppState(null);
  }
}
