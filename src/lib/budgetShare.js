// Aprovação de orçamento pelo link: monta o "retrato" do orçamento que o cliente vai ver
export const BUDGET_PUBLIC_BASE = "https://orcamento.emersonhonoratoretratos.com.br/orcamento/";

export function buildBudgetSnapshot(record = {}, settings = {}, contractText = "", expiresISO = "") {
  const items = (Array.isArray(record.items) ? record.items : [])
    .map((item) => ({
      name: String(item.name || item.description || "Serviço").trim(),
      description: String(item.description && item.description !== item.name ? item.description : item.itemDescription || "").trim(),
      quantity: Number(item.quantity || 1),
      unitPrice: Number(item.unitPrice || 0),
    }))
    .filter((item) => item.name);
  const total = Number(record.computedAmount || record.amount || 0);
  return {
    clientName: record.clientName || "",
    eventType: record.eventType || record.packageName || "Serviço fotográfico",
    packageName: record.packageName || "",
    eventDate: record.eventDate || "",
    startTime: record.startTime || "",
    endTime: record.endTime || "",
    location: record.location || "",
    description: record.budgetDescription || record.serviceDescriptionSnapshot || "",
    items,
    total,
    amountPaid: Number(record.amountPaid || 0),
    paymentTerms: record.contractPaymentMethod || settings.paymentTerms || "",
    deliveryTerms: record.contractDeliveryTerms || "",
    editedPhotosCount: record.editedPhotosCount || "",
    expiresAt: expiresISO,
    contractText: String(contractText || "").trim(),
    studioName: settings.studioName || "Emerson Honorato Retratos",
    studioInstagram: settings.studioInstagram || "",
    studioWhatsapp: String(settings.studioPhone || "5548999652317").replace(/\D/g, ""),
    createdAt: new Date().toISOString(),
  };
}
