src/utils/formatters.js
src/utils/pdfGenerator.js
export const STORAGE_KEY = "studio_manager_premium_v3";

export const STATUS_OPTIONS = ["Pendente", "Confirmado", "Concluído", "Cancelado"];
export const PAYMENT_OPTIONS = ["Pendente", "Entrada paga", "Pago", "Atrasado"];

export const defaultServices = [
  {
    id: crypto.randomUUID(),
    name: "Ensaio Individual",
    category: "Ensaio",
    price: 450,
    description: "Sessão fotográfica com direção, seleção e tratamento profissional das imagens.",
  },
  {
    id: crypto.randomUUID(),
    name: "Ensaio de Casal",
    category: "Ensaio",
    price: 650,
    description: "Ensaio em estúdio ou externa com foco em conexão, direção e entrega profissional.",
  },
  {
    id: crypto.randomUUID(),
    name: "Gestante",
    category: "Ensaio",
    price: 650,
    description: "Ensaio delicado e direcionado para registrar a gestação com sensibilidade.",
  },
  {
    id: crypto.randomUUID(),
    name: "Cobertura de Casamento",
    category: "Evento",
    price: 3500,
    description: "Cobertura fotográfica da cerimônia e festa com tratamento das imagens.",
  },
  {
    id: crypto.randomUUID(),
    name: "Formatura",
    category: "Evento",
    price: 1800,
    description: "Cobertura fotográfica completa da solenidade com entrega digital das imagens.",
  },
];

export const defaultSettings = {
  studioName: "Emerson Honorato Retratos",
  studioPhone: "",
  studioEmail: "",
  studioInstagram: "@emersonhonoratoretratos",
  reminderDaysBefore: 1,
  reminderSameDay: true,
  emailSignature: "Atenciosamente,\nEmerson Honorato Retratos",
  budgetValidityDays: 7,
  paymentTerms: "50% na reserva da data e restante na data do evento ou ensaio.",
  budgetFooter: "Agradecemos a oportunidade. Será um prazer registrar esse momento.",
  logoDataUrl: "",
  logoFormat: "PNG",
};

export const emptyClient = {
  id: null,
  name: "",
  email: "",
  phone: "",
  whatsapp: "",
  city: "",
  instagram: "",
  notes: "",
};

export const emptyBudgetItem = {
  id: crypto.randomUUID(),
  type: "Serviço",
  name: "",
  description: "",
  quantity: 1,
  unitPrice: 0,
};

export const defaultForm = {
  id: null,
  clientId: "",
  clientName: "",
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
  status: "Pendente",
  paymentStatus: "Pendente",
  reminderSent: false,
  sameDayReminderSent: false,
  notes: "",
  packageName: "",
  createdAt: "",
  updatedAt: "",
budgetNumber: "",
budgetStatus: "Rascunho",
budgetValidUntil: "",
export const BUDGET_STATUS_OPTIONS = ["Rascunho", "Enviado", "Aprovado", "Recusado"];

};

export const defaultServiceForm = {
  id: null,
  name: "",
  category: "",
  price: "",
  description: "",
};
export const emptyBudgetItem = {
  id: crypto.randomUUID(),
  type: "Serviço",
  name: "",
  description: "",
  quantity: 1,
  unitPrice: 0,
};

export const defaultBudgetForm = {
  id: null,
  budgetNumber: "",
  budgetStatus: "Rascunho",
  budgetDate: "",
  budgetValidUntil: "",
  clientId: "",
  clientName: "",
  email: "",
  phone: "",
  whatsapp: "",
  location: "",
  items: [],
  notes: "",
  paymentTerms: "",
  total: 0,
  createdAt: "",
  updatedAt: "",
};