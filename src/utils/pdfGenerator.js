import jsPDF from "jspdf";
import {
  formatCurrency,
  formatDateBR,
  normalizeItems,
  getItemsTotal,
  getLogoFormatFromDataUrl,
} from "./formatters";

export function generateBudgetPDF(evento, settings) {
  const doc = new jsPDF();

  const logoFormat = getLogoFormatFromDataUrl(settings.logoDataUrl);

  const studioName = settings.studioName || "Estúdio Fotográfico";
  const cliente = evento.clientName || "Não informado";
  const tipo = evento.eventType || "Não informado";
  const data = evento.eventDate ? formatDateBR(evento.eventDate) : "Não informada";
  const horario = evento.startTime || "A combinar";
  const local = evento.location || "A combinar";
  const pacote = evento.packageName || evento.eventType || "Não informado";

  const items = normalizeItems(evento.items);
  const total = items.length > 0 ? getItemsTotal(items) : Number(evento.amount || 0);

  const validade = Number(settings.budgetValidityDays || 7);
  const pagamento = settings.paymentTerms || "";
  const descricao = evento.budgetDescription || evento.notes || "";

  // HEADER
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 40, "F");

  if (settings.logoDataUrl) {
    try {
      doc.addImage(settings.logoDataUrl, logoFormat, 15, 7, 24, 24);
    } catch (e) {
      console.log("Erro logo:", e);
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(studioName.toUpperCase(), settings.logoDataUrl ? 46 : 20, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("ORÇAMENTO PROFISSIONAL", settings.logoDataUrl ? 46 : 20, 28);

  // INFORMAÇÕES
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Dados do Cliente", 20, 55);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");

  let y = 65;

  const dados = [
    ["Cliente", cliente],
    ["Serviço", tipo],
    ["Data", data],
    ["Horário", horario],
    ["Local", local],
  ];

  dados.forEach(([label, value]) => {
    doc.text(`${label}: ${value}`, 20, y);
    y += 7;
  });

  y += 5;

  // ITENS
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Itens do Orçamento", 20, y);
  y += 8;

  const lista = items.length > 0
    ? items
    : [
        {
          name: pacote,
          quantity: 1,
          unitPrice: total,
          description: descricao,
        },
      ];

  lista.forEach((item) => {
    const totalItem = item.quantity * item.unitPrice;

    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.text(item.name || "Item", 20, y);

    doc.setFont("helvetica", "normal");
    doc.text(`Qtd: ${item.quantity}`, 20, y + 6);
    doc.text(`Unit: ${formatCurrency(item.unitPrice)}`, 70, y + 6);

    doc.setFont("helvetica", "bold");
    doc.text(formatCurrency(totalItem), 150, y + 6);

    if (item.description) {
      const desc = doc.splitTextToSize(item.description, 170);
      doc.setFont("helvetica", "normal");
      doc.text(desc, 20, y + 12);
      y += 10 + desc.length * 5;
    } else {
      y += 15;
    }
  });

  // TOTAL
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`TOTAL: ${formatCurrency(total)}`, 20, y);

  y += 10;

  // PAGAMENTO
  if (pagamento) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const pay = doc.splitTextToSize(pagamento, 170);
    doc.text(pay, 20, y);
    y += pay.length * 5 + 5;
  }

  // VALIDADE
  doc.setFont("helvetica", "bold");
  doc.text(`Validade: ${validade} dias`, 20, y);

  // RODAPÉ
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(settings.studioName || "", 20, 280);
  doc.text(settings.studioInstagram || "", 80, 280);
  doc.text(new Date().toLocaleDateString("pt-BR"), 160, 280);

  doc.save(`orcamento-${cliente}.pdf`);
}