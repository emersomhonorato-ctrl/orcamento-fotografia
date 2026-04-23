import {
  BUDGET_STATUS_OPTIONS,
  EVENT_STATUS_OPTIONS,
  PAYMENT_OPTIONS,
  STORAGE_KEY,
  defaultForm,
  defaultServiceForm,
  defaultServices,
  defaultSettings,
  emptyClient,
} from "@/lib/appModel";

export {
  BUDGET_STATUS_OPTIONS,
  PAYMENT_OPTIONS,
  STORAGE_KEY,
  defaultForm,
  defaultServiceForm,
  defaultServices,
  defaultSettings,
  emptyClient,
};

export const STATUS_OPTIONS = EVENT_STATUS_OPTIONS;

export const emptyBudgetItem = {
  id: crypto.randomUUID(),
  type: "Servico",
  name: "",
  description: "",
  quantity: 1,
  unitPrice: 0,
};

export const defaultBudgetForm = {
  id: null,
  budgetNumber: "",
  budgetStatus: "Pendente",
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
  paymentTerms: defaultSettings.paymentTerms,
  total: 0,
  createdAt: "",
  updatedAt: "",
};
