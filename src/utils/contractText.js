import { formatCurrency, formatDateBR, getTodayLocalISO } from "@/utils/formatters";

// Monta o texto do contrato a partir do modelo das Configurações (mesmo texto do PDF)
export function buildContractText(selectedContract, settings = {}, services = []) {
  if (!selectedContract) return "";

  const template = settings.contractTemplate || "";
  if (!template.trim()) return "";

  const amountValue = Number(selectedContract.computedAmount || selectedContract.amount || 0);
  const amountPaidValue = Number(selectedContract.amountPaid || 0);
  const balanceValue = Math.max(amountValue - amountPaidValue, 0);
  const fallback = (value, emptyValue = "a combinar") => {
    const normalized = String(value ?? "").trim();
    return normalized || emptyValue;
  };
  const startHour = selectedContract.startTime ? Number(selectedContract.startTime.split(":")[0] || 0) : null;
  const startMinute = selectedContract.startTime ? Number(selectedContract.startTime.split(":")[1] || 0) : null;
  const endHour = selectedContract.endTime ? Number(selectedContract.endTime.split(":")[0] || 0) : null;
  const endMinute = selectedContract.endTime ? Number(selectedContract.endTime.split(":")[1] || 0) : null;
  const hasDuration = Number.isFinite(startHour) && Number.isFinite(startMinute) && Number.isFinite(endHour) && Number.isFinite(endMinute);
  const eventDuration = hasDuration
    ? (() => {
      const startTotal = startHour * 60 + startMinute;
      const endTotal = endHour * 60 + endMinute;
      const diffMinutes = Math.max(endTotal - startTotal, 0);
      const hours = diffMinutes / 60;
      return hours > 0 ? `${String(hours).replace(".", ",")} ${hours === 1 ? "hora" : "horas"}` : "a combinar";
    })()
    : "a combinar";
  const rawCurrency = (value) => formatCurrency(value).replace(/^R\$\s?/, "");
  const deliveryTerms = (selectedContract.contractDeliveryTerms || "").trim();
  const prazoEntrega = deliveryTerms.match(/\d+/)?.[0] || String(selectedContract.recommendedDeliveryDays || "15");
  const quantidadeFotos = String(selectedContract.editedPhotosCount || selectedContract.onlinePhotosCount || selectedContract.printedPhotosCount || selectedContract.digitalPhotosCount || "a combinar");
  const formaEntrega = (() => {
    if (!deliveryTerms) return "galeria online";

    const sanitized = deliveryTerms
    .replace(/\b(em|até)\s+\d+\s*(dias?|dias úteis|uteis)\b/gi, "")
    .replace(/\b\d+\s*(dias?|dias úteis|uteis)\b/gi, "")
    .replace(/[.,;:-]\s*$/g, "")
    .trim();

    return sanitized || "galeria online";
  })();
  const dataPagamento = balanceValue > 0 ? "na quitação do saldo" : formatDateBR(getTodayLocalISO());
  const companyAddress = settings.contractCity || settings.studioCity || settings.studioAddress || "Endereço do estúdio a definir";
  const clientAddress = selectedContract.clientAddress || selectedContract.location || "Endereço a informar";
  const eventDate = selectedContract.eventDate ? formatDateBR(selectedContract.eventDate) : "a combinar";
  const eventType = selectedContract.eventType || selectedContract.packageName || "ensaio fotográfico";
  const eventLocation = selectedContract.location || "local a combinar";
  const clientName = selectedContract.clientName || "Cliente não informado";
  const clientCpf = selectedContract.clientCpf || "não informado";
  const clientEmail = selectedContract.email || "não informado";
  const clientPhone = selectedContract.whatsapp || selectedContract.phone || "não informado";
  const paymentTerms = selectedContract.contractPaymentMethod || settings.paymentTerms || "Forma de pagamento a combinar.";
  const contractCity = settings.contractCity || settings.studioCity || "Cidade não informada";
  const contractForum = settings.contractForum || contractCity;
  const imageAuthorization = settings.contractImageAuthorization
    || "O CONTRATANTE autoriza o uso das imagens para portfólio e divulgação, salvo manifestação contrária por escrito.";
  const matchedService = services.find(
    (service) => service.name === selectedContract.eventType || service.name === selectedContract.packageName,
  );
  const serviceDescription = fallback(
    selectedContract.serviceDescriptionSnapshot
    || matchedService?.workDescription
    || matchedService?.itemDescription
    || selectedContract.budgetDescription,
    "Descrição específica do serviço a definir em proposta ou briefing aprovado.",
  );
  const serviceItemsBlock = (() => {
    const explicitLines = [
    selectedContract.serviceItemsSnapshot,
    matchedService?.itemDescription,
    selectedContract.serviceDescriptionSnapshot,
    matchedService?.workDescription,
    selectedContract.budgetDescription,
    ]
    .filter(Boolean)
    .flatMap((text) =>
      String(text)
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean),
    );

    const uniqueLines = Array.from(new Set(explicitLines));

    if (uniqueLines.length > 0) {
    return uniqueLines.map((line) => `- ${line}`).join("\n");
    }

    return [
    "- Cobertura fotográfica conforme tempo contratado",
    "- Direção durante o ensaio/evento",
    "- Seleção e tratamento profissional das imagens",
    "- Entrega digital das fotografias em alta resolução",
    ].join("\n");
  })();

  const replacements = {
    studioName: fallback(settings.studioName, "Emerson Honorato Retratos"),
    studioResponsible: fallback(settings.studioResponsible, "Emerson Honorato"),
    studioDocument: fallback(settings.studioDocument, "não informado"),
    studioPhone: fallback(settings.studioPhone, "não informado"),
    studioEmail: fallback(settings.studioEmail, "não informado"),
    studioCity: fallback(settings.studioCity, contractCity),
    clientName,
    clientCpf,
    clientEmail,
    clientPhone,
    clientAddress,
    eventType,
    eventDate,
    startTime: fallback(selectedContract.startTime),
    endTime: fallback(selectedContract.endTime),
    location: eventLocation,
    amount: formatCurrency(amountValue),
    amountPaid: formatCurrency(amountPaidValue),
    balance: formatCurrency(balanceValue),
    paymentTerms: paymentTerms,
    contractPaymentMethod: paymentTerms,
    contractDeliveryTerms: fallback(deliveryTerms),
    notes: fallback(selectedContract.contractNotes || selectedContract.notes, "Sem observações adicionais."),
    currentDate: formatDateBR(getTodayLocalISO()),
    contractCity,
    contractForum,
    packageName: fallback(selectedContract.packageName, eventType),
    NOME_EMPRESA: fallback(settings.studioName, "Emerson Honorato Retratos"),
    RESPONSAVEL_EMPRESA: fallback(settings.studioResponsible, "Emerson Honorato"),
    DOCUMENTO_EMPRESA: fallback(settings.studioDocument, "não informado"),
    TELEFONE_EMPRESA: fallback(settings.studioPhone, "não informado"),
    EMAIL_EMPRESA: fallback(settings.studioEmail, "não informado"),
    ENDERECO_EMPRESA: companyAddress,
    NOME_CLIENTE: clientName,
    CPF_CLIENTE: clientCpf,
    CLIENTE_TELEFONE: clientPhone,
    CLIENTE_EMAIL: clientEmail,
    ENDERECO_CLIENTE: clientAddress,
    TIPO_EVENTO: eventType,
    DATA_EVENTO: eventDate,
    LOCAL_EVENTO: eventLocation,
    HORAS_EVENTO: eventDuration,
    QUANTIDADE_FOTOS: quantidadeFotos,
    FORMA_ENTREGA: formaEntrega,
    PRAZO_ENTREGA: prazoEntrega,
    VALOR_TOTAL: rawCurrency(amountValue),
    VALOR_SINAL: rawCurrency(amountPaidValue),
    DATA_PAGAMENTO: dataPagamento,
    FORMA_PAGAMENTO_CONTRATO: paymentTerms,
    CONDICAO_PAGAMENTO_CONTRATO: paymentTerms,
    AUTORIZACAO_IMAGEM: imageAuthorization,
    DESCRICAO_SERVICO: serviceDescription,
    ITENS_SERVICO_CONTRATADO: serviceItemsBlock,
    CIDADE: contractCity,
    DATA_ATUAL: formatDateBR(getTodayLocalISO()),
  };

  return template.replace(/\{\{(\w+)\}\}|\{([A-Z_]+)\}/g, (_match, camelKey, legacyKey) => {
    const key = camelKey || legacyKey;
    return replacements[key] ?? "";
  });
}
