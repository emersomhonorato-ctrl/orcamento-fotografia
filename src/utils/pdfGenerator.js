import jsPDF from "jspdf";
import {
  formatCurrency,
  formatDateBR,
  getItemsTotal,
  getTodayLocalISO,
  getLogoFormatFromDataUrl,
  normalizeItems,
} from "./formatters";

const PDF_TYPO = {
  labelSize: 8.5,
  bodySize: 10,
  bodyStrongSize: 10.5,
  smallSize: 8.8,
  microSize: 8.2,
  totalLabelSize: 7.8,
  totalValueSize: 16.5,
};

function setPdfLabel(doc) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_TYPO.labelSize);
  doc.setTextColor(100, 116, 139);
}

function setPdfBody(doc) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(PDF_TYPO.bodySize);
  doc.setTextColor(15, 23, 42);
}

function setPdfBodyStrong(doc) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_TYPO.bodyStrongSize);
  doc.setTextColor(15, 23, 42);
}

function setPdfSmall(doc) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(PDF_TYPO.smallSize);
  doc.setTextColor(71, 85, 105);
}

function drawSectionIcon(doc, x, y, type) {
  doc.setDrawColor(214, 180, 95);
  doc.setLineWidth(0.6);

  if (type === "client") {
    doc.circle(x + 2, y - 1.5, 1.8, "S");
    doc.line(x - 0.5, y + 3.5, x + 4.5, y + 3.5);
  } else if (type === "service") {
    doc.roundedRect(x - 0.8, y - 2, 6, 4.2, 0.8, 0.8, "S");
    doc.circle(x + 2.2, y + 0.1, 1.2, "S");
  } else if (type === "commercial") {
    doc.circle(x + 2, y - 1, 2, "S");
    doc.line(x + 2, y - 2.8, x + 2, y + 0.8);
    doc.line(x + 0.6, y - 1.8, x + 3.4, y - 1.8);
  }

  doc.setLineWidth(0.2);
}

function drawFooter(doc, settings) {
  doc.setFillColor(248, 248, 246);
  doc.rect(0, 278, 210, 12, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(166, 176, 192);
  doc.text(settings.pdfFooter || "Obrigado pela oportunidade.", 105, 287, { align: "center" });
}

function ensureSpace(doc, cursor, amount, settings) {
  if (cursor.value + amount <= 279) return;
  doc.addPage();
  cursor.value = 18;
}

function drawSectionTitle(doc, cursor, title, iconType = null) {
  if (iconType) {
    drawSectionIcon(doc, 16, cursor.value, iconType);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(String(title).toUpperCase(), iconType ? 24 : 16, cursor.value);
  cursor.value += 10;
}

function drawBudgetInfoCard(doc, x, y, w, h, label, value, options = {}) {
  const {
    fill = [250, 250, 251],
    accent = [203, 213, 225],
    valueStrong = false,
    valueSize = PDF_TYPO.bodySize,
    valueColor = [15, 23, 42],
    labelColor = [100, 116, 139],
    radius = 5,
  } = options;

  doc.setFillColor(...fill);
  doc.roundedRect(x, y, w, h, radius, radius, "F");
  doc.setFillColor(...accent);
  doc.roundedRect(x, y, 1.2, h, 1.2, 1.2, "F");

  const isCompactCard = h <= 11.5;
  const isMediumCard = h > 11.5 && h < 14.5;
  const labelY = y + (isCompactCard ? 4.8 : isMediumCard ? 5.2 : 6);
  const valueY = y + (isCompactCard ? 8.8 : isMediumCard ? 10.2 : 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_TYPO.labelSize);
  doc.setTextColor(...labelColor);
  doc.text(label, x + 4, labelY);

  doc.setFont("helvetica", valueStrong ? "bold" : "normal");
  doc.setFontSize(valueSize);
  doc.setTextColor(...valueColor);
  doc.text(doc.splitTextToSize(String(value || "-"), w - 8), x + 4, valueY);
}

function drawDocumentHeader(doc, settings, subtitle) {
  const logoFormat = getLogoFormatFromDataUrl(settings.logoDataUrl);
  const studioName = settings.studioName || "Emerson Honorato Retratos";
  const headerContacts = [
    settings.studioPhone,
    settings.studioEmail,
    settings.studioInstagram,
    settings.studioCity,
  ]
    .filter(Boolean)
    .join("   •   ");

  doc.setFillColor(23, 27, 38);
  doc.rect(0, 0, 210, 46, "F");

  if (settings.logoDataUrl) {
    try {
      doc.addImage(settings.logoDataUrl, logoFormat, 16, 9, 28, 28);
    } catch {
      // ignore invalid image and continue with the PDF
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.text(studioName, settings.logoDataUrl ? 50 : 16, 19);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(166, 176, 192);
  if (typeof doc.setCharSpace === "function") {
    doc.setCharSpace(0.8);
    doc.text(subtitle, settings.logoDataUrl ? 50 : 16, 28);
    doc.setCharSpace(0);
  } else {
    doc.text(subtitle, settings.logoDataUrl ? 50 : 16, 28);
  }

  if (headerContacts) {
    doc.setFontSize(8.5);
    doc.text(headerContacts, settings.logoDataUrl ? 50 : 16, 35);
  }

  return studioName;
}

function drawBudgetEditorialCard(doc, cursor, title, lines, options = {}) {
  const {
    fill = [252, 252, 253],
    accent = [214, 180, 95],
    bodyColor = [30, 41, 59],
    minHeight = 22,
    leadLineCount = 0,
  } = options;
  const contentLines = Array.isArray(lines) ? lines : doc.splitTextToSize(String(fixSentenceSpacing(lines) || ""), 174);
  const resolvedMinHeight = Math.max(24, minHeight);
  const leadLines = getBudgetResolvedLeadLineCount(contentLines, leadLineCount);
  const trailingLines = Math.max(0, contentLines.length - leadLines);
  const leadHeight = leadLines * 4.8;
  const trailingHeight = trailingLines * 4.2;
  const cardHeight = Math.max(resolvedMinHeight, leadHeight + trailingHeight + 12.6);

  doc.setFillColor(...fill);
  doc.roundedRect(16, cursor.value, 178, cardHeight, 6, 6, "F");
  doc.setFillColor(...accent);
  doc.roundedRect(16, cursor.value, 1.4, cardHeight, 1.4, 1.4, "F");

  setPdfLabel(doc);
  doc.text(title, 20, cursor.value + 6.5);
  let textY = cursor.value + 12;

  if (leadLines) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(31, 41, 55);
    doc.text(contentLines.slice(0, leadLines), 20, textY);
    textY += leadHeight - 0.2;
  }

  if (trailingLines) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.3);
    doc.setTextColor(...bodyColor);
    doc.text(contentLines.slice(leadLines), 20, textY);
  }

  cursor.value += cardHeight + 5.5;
}

function drawBudgetTechnicalScopeCard(doc, cursor, title, items, options = {}) {
  const {
    fill = [246, 247, 249],
    accent = [191, 201, 214],
    textColor = [51, 65, 85],
  } = options;
  const normalizedItems = Array.isArray(items)
    ? items.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const useTwoColumns = normalizedItems.length >= 6;
  const bulletWidth = useTwoColumns ? 70.5 : 158.5;
  const columns = useTwoColumns ? [[], []] : [[]];

  normalizedItems.forEach((item, index) => {
    const wrapped = doc.splitTextToSize(item, bulletWidth);
    const targetColumn = useTwoColumns ? (index % 2) : 0;
    columns[targetColumn].push(wrapped);
  });

  const columnHeights = columns.map((column) =>
    column.reduce((total, wrapped, wrappedIndex) => total + wrapped.length * 3.55 + (wrappedIndex === column.length - 1 ? 0 : 1.4), 0),
  );
  const contentHeight = Math.max(...columnHeights, 10);
  const cardHeight = Math.max(17, contentHeight + 8.6);

  const drawCardFrame = (heading, y, height) => {
    doc.setFillColor(...fill);
    doc.roundedRect(16, y, 178, height, 4, 4, "F");
    doc.setFillColor(...accent);
    doc.roundedRect(16, y, 2.1, height, 1.2, 1.2, "F");
    setPdfLabel(doc);
    doc.text(heading, 20, y + 5.2);
  };

  const drawColumns = (heading) => {
    drawCardFrame(heading, cursor.value, cardHeight);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.35);
    doc.setTextColor(...textColor);

    const columnX = useTwoColumns ? [20, 108] : [20];
    columns.forEach((column, columnIndex) => {
      let y = cursor.value + 9.9;
      column.forEach((wrapped) => {
        doc.setFont("helvetica", "bold");
        doc.text("•", columnX[columnIndex], y);
        doc.setFont("helvetica", "normal");
        doc.text(wrapped, columnX[columnIndex] + 4, y);
        y += wrapped.length * 3.55 + 1.4;
      });
    });

    cursor.value += cardHeight + 6.5;
  };

  const pageTop = 18;
  const pageBottom = 265;

  if (cursor.value + cardHeight <= pageBottom) {
    drawColumns(title);
    return;
  }

  if (cardHeight <= pageBottom - pageTop) {
    doc.addPage();
    cursor.value = pageTop;
    drawColumns(title);
    return;
  }

  const wrappedItems = normalizedItems.map((item) => doc.splitTextToSize(item, 158.5));
  let currentItems = [];
  let currentHeight = 8.6;
  let heading = title;

  if (cursor.value + 17 > pageBottom) {
    doc.addPage();
    cursor.value = pageTop;
  }

  const flushScopePage = () => {
    const height = Math.max(17, currentHeight);
    drawCardFrame(heading, cursor.value, height);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.35);
    doc.setTextColor(...textColor);

    let y = cursor.value + 9.9;
    currentItems.forEach((wrapped) => {
      doc.setFont("helvetica", "bold");
      doc.text("•", 20, y);
      doc.setFont("helvetica", "normal");
      doc.text(wrapped, 24, y);
      y += wrapped.length * 3.55 + 1.4;
    });

    cursor.value += height + 6.5;
    currentItems = [];
    currentHeight = 8.6;
  };

  wrappedItems.forEach((wrapped) => {
    const bulletHeight = wrapped.length * 3.55 + 1.4;
    if (cursor.value + currentHeight + bulletHeight > pageBottom && currentItems.length) {
      flushScopePage();
      doc.addPage();
      cursor.value = pageTop;
      heading = `${title} (continuação)`;
    }
    currentItems.push(wrapped);
    currentHeight += bulletHeight;
  });

  if (currentItems.length) {
    flushScopePage();
  }
}

function estimateBudgetEditorialCardHeight(lines, options = {}) {
  const { minHeight = 22, leadLineCount = 0 } = options;
  const contentLines = Array.isArray(lines) ? lines : [];
  const resolvedMinHeight = Math.max(24, minHeight);
  const leadLines = getBudgetResolvedLeadLineCount(contentLines, leadLineCount);
  const trailingLines = Math.max(0, contentLines.length - leadLines);
  const leadHeight = leadLines * 5.45;
  const trailingHeight = trailingLines * 4.95;
  return Math.max(resolvedMinHeight, leadHeight + trailingHeight + 14.5) + 4;
}

function splitTextIntoBudgetParagraphLines(doc, text, width) {
  return String(fixSentenceSpacing(text) || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .flatMap((paragraph, index, arr) => {
      const trimmed = paragraph.trim();
      if (!trimmed) {
        return index === arr.length - 1 ? [] : [""];
      }
      const lines = doc.splitTextToSize(trimmed, width);
      return index === arr.length - 1 ? lines : [...lines, ""];
    });
}

function extractBulletLines(text) {
  return String(fixSentenceSpacing(text) || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-•]/.test(line))
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
}

function removeBudgetBulletLines(text) {
  return String(fixSentenceSpacing(text) || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => !/^[-•]/.test(line.trim()))
    .join("\n")
    .trim();
}

function buildBudgetSentenceScopeItems(text) {
  return String(fixSentenceSpacing(text) || "")
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/[.;:]$/, ""));
}

function normalizeBudgetServiceCatalog(record, settings) {
  const serviceCatalog =
    (Array.isArray(record.serviceCatalog) && record.serviceCatalog) ||
    (Array.isArray(record.services) && record.services) ||
    (Array.isArray(settings.serviceCatalog) && settings.serviceCatalog) ||
    (Array.isArray(settings.services) && settings.services) ||
    [];

  return serviceCatalog.filter((service) => service && typeof service === "object");
}

function findBudgetServiceForItem(item, services) {
  if (!item || !Array.isArray(services) || !services.length) return null;
  const serviceId = String(item.serviceId || item.service_id || "").trim();
  const serviceName = String(item.name || item.serviceName || item.eventType || item.packageName || "").trim().toLowerCase();

  return services.find((service) => {
    const idMatches = serviceId && String(service.id || "").trim() === serviceId;
    const nameMatches = serviceName && String(service.name || "").trim().toLowerCase() === serviceName;
    return idMatches || nameMatches;
  }) || null;
}

function drawBudgetFieldValue(doc, text, x, y, width) {
  const normalized = String(text || "").trim().toLowerCase();
  const isPending = normalized === "a definir";

  doc.setFont("helvetica", isPending ? "italic" : "normal");
  doc.setFontSize(isPending ? 9.6 : 10);
  doc.setTextColor(...(isPending ? [100, 116, 139] : [15, 23, 42]));
  doc.text(doc.splitTextToSize(text, width), x, y);
}

function normalizeBudgetComparableText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isBudgetPendingValue(value) {
  return normalizeBudgetComparableText(value) === "a definir";
}

function getBudgetScheduleDisplayValue(value, pendingCount) {
  if (!isBudgetPendingValue(value)) return value;
  return pendingCount >= 2 ? "A confirmar" : "A definir";
}

function buildBudgetNarrativeLines(budgetData) {
  return budgetData.displayWorkLines
    .filter((line) => String(line || "").trim())
    .slice(0, 12);
}

function buildBudgetTechnicalScopeLines(doc, budgetData) {
  const bulletLines = extractBulletLines(budgetData.serviceSnapshot.itemDescription);
  if (bulletLines.length) {
    return bulletLines;
  }

  const sentenceChunks = String(fixSentenceSpacing(budgetData.serviceSnapshot.itemDescription) || "")
    .split(/(?<=[.!?])\s+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => chunk.replace(/[.;:]$/, ""));

  if (sentenceChunks.length) {
    return sentenceChunks;
  }

  return splitTextIntoBudgetParagraphLines(doc, budgetData.serviceSnapshot.itemDescription, 164)
    .filter((line) => String(line || "").trim());
}

function estimateBudgetSimpleCommercialBlocksHeight(doc, sections) {
  return sections.reduce((total, section) => {
    const lines = splitTextIntoBudgetParagraphLines(doc, section.value, 168).slice(0, 6);
    return total + estimateBudgetEditorialCardHeight(lines, {
      minHeight: 18,
      leadLineCount: Math.min(1, lines.length),
    });
  }, 0);
}

function buildBudgetItemDescriptionLines(
  doc,
  itemDescription,
  normalizedWorkDescription,
  width = 104,
  options = {},
) {
  const { workDescriptionIsStructured = false, compact = false } = options;
  const cleanedItemDescription = fixSentenceSpacing(itemDescription);
  const normalizedItemDescription = String(cleanedItemDescription || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (!normalizedItemDescription || normalizedItemDescription === normalizedWorkDescription) {
    return [];
  }

  const bulletLines = extractBulletLines(cleanedItemDescription);

  const technicalLinesSource = bulletLines.length
    ? bulletLines.slice(0, compact ? 4 : workDescriptionIsStructured ? 3 : 5)
    : String(cleanedItemDescription || "")
        .split(/(?<=[.!?])\s+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, compact ? 2 : workDescriptionIsStructured ? 3 : 4);

  return technicalLinesSource
    .flatMap((line) => doc.splitTextToSize(`• ${line}`, width))
    .slice(0, compact ? 5 : workDescriptionIsStructured ? 6 : 8);
}

function drawBudgetTransitionSummary(doc, cursor, total, validityDays, settings) {
  const studioName = settings.studioName || "Emerson Honorato Retratos";
  const cardHeight = 21;
  ensureSpace(doc, cursor, cardHeight + 6, settings);

  doc.setFillColor(249, 248, 245);
  doc.roundedRect(16, cursor.value, 178, cardHeight, 5, 5, "F");
  doc.setFillColor(214, 180, 95);
  doc.roundedRect(16, cursor.value, 2.2, cardHeight, 1.2, 1.2, "F");

  setPdfLabel(doc);
  doc.text("Resumo da proposta", 20, cursor.value + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.8);
  doc.setTextColor(100, 116, 139);
  doc.text("Composição completa e condições finais organizadas na próxima página.", 20, cursor.value + 13);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("INVESTIMENTO PROPOSTO", 166, cursor.value + 6, { align: "right" });
  doc.setFontSize(14.2);
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrency(total), 190, cursor.value + 14, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  doc.setTextColor(148, 163, 184);
  doc.text(studioName, 190, cursor.value + 18, { align: "right" });

  cursor.value += cardHeight + 6;
}

function drawBudgetPremiumTransitionSummary(doc, cursor, budgetData, settings) {
  const cardHeight = 30;
  ensureSpace(doc, cursor, cardHeight + 6, settings);

  doc.setFillColor(249, 249, 247);
  doc.roundedRect(16, cursor.value, 178, cardHeight, 5, 5, "F");
  doc.setDrawColor(232, 236, 242);
  doc.roundedRect(16, cursor.value, 178, cardHeight, 5, 5, "S");
  doc.setFillColor(214, 180, 95);
  doc.roundedRect(16, cursor.value, 2.4, cardHeight, 1.2, 1.2, "F");
  doc.setDrawColor(214, 180, 95);
  doc.line(20, cursor.value + 5, 52, cursor.value + 5);

  setPdfLabel(doc);
  doc.text("Fechamento da proposta", 20, cursor.value + 9);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.2);
  doc.setTextColor(31, 41, 55);
  doc.text("Investimento e validade organizados para decisão.", 20, cursor.value + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Os detalhes finais seguem na próxima página.", 20, cursor.value + 21.5);

  drawBudgetInfoCard(doc, 122, cursor.value + 6, 68, 10.8, "Validade", `${budgetData.validityDays} dias`, {
    fill: [255, 255, 255],
    accent: [214, 180, 95],
    valueStrong: true,
    valueSize: 9.3,
  });

  doc.setFillColor(15, 23, 42);
  doc.roundedRect(122, cursor.value + 18, 68, 12, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.1);
  doc.setTextColor(191, 201, 214);
  doc.text("INVESTIMENTO PROPOSTO", 156, cursor.value + 22.3, { align: "center" });
  doc.setFontSize(12.8);
  doc.setTextColor(255, 255, 255);
  doc.text(formatCurrency(budgetData.total), 156, cursor.value + 27.3, { align: "center" });

  cursor.value += cardHeight + 6;
}

function _drawBudgetPageClosureHint(doc, cursor, total, settings) {
  const studioName = settings.studioName || "Emerson Honorato Retratos";
  const cardHeight = 19;
  ensureSpace(doc, cursor, cardHeight + 4, settings);

  doc.setFillColor(249, 249, 251);
  doc.roundedRect(16, cursor.value, 178, cardHeight, 4.5, 4.5, "F");
  doc.setDrawColor(232, 236, 242);
  doc.roundedRect(16, cursor.value, 178, cardHeight, 4.5, 4.5, "S");
  doc.setDrawColor(214, 180, 95);
  doc.line(20, cursor.value + 4, 48, cursor.value + 4);

  setPdfLabel(doc);
  doc.text("Fechamento na próxima página", 20, cursor.value + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.4);
  doc.setTextColor(100, 116, 139);
  doc.text(studioName, 20, cursor.value + 14);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.1);
  doc.setTextColor(100, 116, 139);
  doc.text("VALOR DA PROPOSTA", 188, cursor.value + 8, { align: "right" });
  doc.setFontSize(13.2);
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrency(total), 188, cursor.value + 14, { align: "right" });

  cursor.value += cardHeight + 5;
}

function drawBudgetClosingIntro(doc, cursor) {
  const cardHeight = 22;
  doc.setFillColor(249, 249, 251);
  doc.roundedRect(16, cursor.value, 178, cardHeight, 4.5, 4.5, "F");
  doc.setDrawColor(232, 236, 242);
  doc.roundedRect(16, cursor.value, 178, cardHeight, 4.5, 4.5, "S");
  doc.setDrawColor(214, 180, 95);
  doc.line(20, cursor.value + 4, 58, cursor.value + 4);

  setPdfLabel(doc);
  doc.text("Fechamento da proposta", 20, cursor.value + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.8);
  doc.setTextColor(100, 116, 139);
  doc.text("Condições, valor consolidado e assinatura do estúdio reunidos nesta etapa final.", 20, cursor.value + 15);

  cursor.value += cardHeight + 6;
}

function _drawBudgetTailPage(doc, cursor, budgetData, settings, studioName, options = {}) {
  const { includeIntro = false, includeScope = false } = options;

  if (includeIntro) {
    drawBudgetClosingIntro(doc, cursor);
  }

  if (includeScope && budgetData.remainingWorkLines.length) {
    const scopedLines = budgetData.remainingWorkLines.slice(0, 2);
    drawBudgetEditorialCard(doc, cursor, "Detalhamento complementar", scopedLines, {
      fill: [250, 250, 251],
      accent: [191, 201, 214],
      bodyColor: [51, 65, 85],
      minHeight: 18,
    });
  }

  doc.setFillColor(247, 248, 252);
  doc.roundedRect(16, cursor.value, 178, 24, 5, 5, "F");
  doc.setDrawColor(232, 236, 242);
  doc.roundedRect(16, cursor.value, 178, 24, 5, 5, "S");
  doc.setDrawColor(214, 180, 95);
  doc.line(20, cursor.value + 4, 52, cursor.value + 4);
  setPdfLabel(doc);
  doc.text("Fechamento financeiro", 20, cursor.value + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Valor consolidado e pronto para aprovação.", 20, cursor.value + 14.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("INVESTIMENTO TOTAL", 156, cursor.value + 8, { align: "center" });
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(118, cursor.value + 4, 76, 14, 3.5, 3.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13.8);
  doc.setTextColor(255, 255, 255);
  doc.text(formatCurrency(budgetData.total), 156, cursor.value + 13.2, { align: "center" });
  cursor.value += 30;

  doc.setFillColor(247, 248, 252);
  doc.roundedRect(16, cursor.value, 178, 26, 4, 4, "F");
  drawBudgetInfoCard(doc, 20, cursor.value + 4, 42, 11.5, "Validade", `${budgetData.validityDays} dias`, {
    fill: [255, 255, 255],
    accent: [214, 180, 95],
    valueStrong: true,
  });
  drawBudgetInfoCard(doc, 66, cursor.value + 4, 124, 11.5, "Pagamento", budgetData.paymentTerms, {
    fill: [255, 255, 255],
    accent: [191, 201, 214],
    valueSize: 8.6,
  });
  setPdfLabel(doc);
  doc.text("Síntese da proposta", 20, cursor.value + 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.7);
  doc.setTextColor(55, 65, 81);
  doc.text("Tudo organizado para decisão, aprovação e formalização do atendimento.", 62, cursor.value + 20);
  cursor.value += 31;

  doc.setFillColor(250, 249, 246);
  doc.roundedRect(16, cursor.value, 178, 17, 4, 4, "F");
  doc.setDrawColor(214, 180, 95);
  doc.line(20, cursor.value + 4, 58, cursor.value + 4);
  setPdfLabel(doc);
  doc.text("Próximos passos", 20, cursor.value + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.6);
  doc.setTextColor(71, 85, 105);
  doc.text("Após aprovação, o estúdio segue com a formalização e o alinhamento final do atendimento.", 20, cursor.value + 13.5);
  cursor.value += 22;

  drawCompanySignaturePinned(doc, 252, studioName, settings, { compact: true });
}

function drawCompanySignatureBlock(doc, cursor, companyLabel, settings, options = {}) {
  const { compact = false, caption = "" } = options;
  const hasSignatureImage = Boolean(settings.signatureDataUrl);
  const imageHeight = compact ? 14 : 18;
  const blockReserve = (hasSignatureImage ? (compact ? 32 : 40) : compact ? 22 : 28) + (caption ? 4 : 0);
  ensureSpace(doc, cursor, blockReserve, settings);
  cursor.value += compact ? 4 : 6;

  if (hasSignatureImage) {
    const signatureFormat = getLogoFormatFromDataUrl(settings.signatureDataUrl);
    try {
      doc.addImage(settings.signatureDataUrl, signatureFormat, 69, cursor.value - 2, 72, imageHeight);
      cursor.value += imageHeight;
    } catch {
      // Se a imagem falhar, seguimos com a assinatura em texto sem quebrar o PDF.
    }
  }

  if (caption) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(caption, 105, cursor.value - 2, { align: "center" });
  }

  doc.setDrawColor(148, 163, 184);
  doc.line(58, cursor.value, 152, cursor.value);
  cursor.value += compact ? 5 : 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(compact ? 8.8 : 9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(companyLabel, 105, cursor.value, { align: "center" });
}

function drawCompanySignaturePinned(doc, y, companyLabel, settings, options = {}) {
  const { compact = false } = options;
  const hasSignatureImage = Boolean(settings.signatureDataUrl);
  const imageHeight = compact ? 14 : 18;
  let cursorY = y;

  if (hasSignatureImage) {
    const signatureFormat = getLogoFormatFromDataUrl(settings.signatureDataUrl);
    try {
      doc.addImage(settings.signatureDataUrl, signatureFormat, 69, cursorY - 2, 72, imageHeight);
      cursorY += imageHeight;
    } catch {
      // Se a imagem falhar, mantemos a assinatura textual na mesma página.
    }
  }

  doc.setDrawColor(148, 163, 184);
  doc.line(58, cursorY, 152, cursorY);
  cursorY += compact ? 5 : 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(compact ? 8.8 : 9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(companyLabel, 105, cursorY, { align: "center" });
}

function normalizeContractCompareText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function toTitleCase(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatCPF(cpf) {
  if (!cpf) return "";
  const digits = String(cpf).replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatCNPJ(cnpj) {
  if (!cnpj) return "";
  const digits = String(cnpj).replace(/\D/g, "");
  if (digits.length !== 14) return cnpj;
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function formatTaxId(value) {
  if (!value) return "";
  const digits = String(value).replace(/\D/g, "");
  if (digits.length === 11) return formatCPF(digits);
  if (digits.length === 14) return formatCNPJ(digits);
  return value;
}

function toContractCityTitleCase(value, fallback = "Criciúma") {
  const normalized = normalizeContractCompareText(value);
  if (!normalized || ["a combinar", "a definir", normalizeContractCompareText("Cidade não informada")].includes(normalized)) {
    return fallback;
  }
  if (normalized === normalizeContractCompareText("Criciúma")) return "Criciúma";
  return toTitleCase(value);
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceContractTextValue(text, source, replacement) {
  const sourceText = String(source || "").trim();
  if (!sourceText || sourceText === replacement) return text;
  return text.replace(new RegExp(escapeRegExp(sourceText), "g"), replacement);
}

function getContractPhotoCountText(record) {
  const photoCount = [
    record.onlinePhotosCount,
    record.editedPhotosCount,
    record.printedPhotosCount,
    record.digitalPhotosCount,
  ].find((value) => Number(value) > 0);

  return photoCount ? `aproximadamente ${Number(photoCount)}` : null;
}

function isContractPhotoDeliveryParagraph(line) {
  const normalized = normalizeContractCompareText(line);
  return normalized.startsWith("paragrafo unico:")
    && normalized.includes("quantidade de fotos entregues")
    && normalized.includes("imagens finais");
}

function isContractClosingDateLine(line) {
  const normalized = normalizeContractCompareText(line);
  return /^[a-z\s]+,\s*\d{2}\/\d{2}\/\d{4}\.?$/.test(normalized);
}

function normalizeContractTextForPdf(text, record, settings, contractCity, contractForum) {
  const photoCountText = getContractPhotoCountText(record);
  const photoDeliveryParagraph = photoCountText
    ? `Parágrafo único: A quantidade de fotos entregues para escolha, pode variar conforme dinâmica do evento, condições do local, duração efetiva da cobertura e critérios técnicos do fotógrafo, sendo prevista a entrega de ${photoCountText} imagens finais.`
    : null;
  const rawCityValues = [
    settings.contractCity,
    settings.studioCity,
    "Cidade não informada",
    "cidade não informada",
  ].filter(Boolean);

  let normalizedText = String(fixSentenceSpacing(text) || "")
    .replace(/CONTRATO DE PRESTA[CÇ][AÃ]O DE SERVI[CÇ]OS FOTOGR[AÁ]FICOS/g, "CONTRATO DE PRESTAÇÃO DE SERVIÇOS FOTOGRÁFICOS")
    .replace(/CONTRATO DE PRESTA[CÇ][AÃ]O DE SERVI[CÇ]OS/g, "CONTRATO DE PRESTAÇÃO DE SERVIÇOS")
    .replace(
      /Instrumento particular entre as partes, com condi[cç][oõ]es comerciais e jur[ií]dicas registradas\./g,
      "Instrumento particular entre as partes, com condições comerciais e jurídicas registradas.",
    )
    .replace(/\bcrici[uú]ma\b/gi, "Criciúma");

  rawCityValues.forEach((value) => {
    normalizedText = replaceContractTextValue(normalizedText, value, contractCity);
  });

  if (settings.contractForum) {
    normalizedText = replaceContractTextValue(normalizedText, settings.contractForum, contractForum);
  }

  const lines = normalizedText.replace(/\r\n/g, "\n").split("\n");
  const signatureIndex = lines.findIndex((line) => normalizeContractCompareText(line) === "assinaturas");
  const bodyLines = signatureIndex >= 0 ? lines.slice(0, signatureIndex) : lines;

  if (signatureIndex >= 0) {
    while (bodyLines.length > 0 && !bodyLines[bodyLines.length - 1].trim()) {
      bodyLines.pop();
    }

    if (isContractClosingDateLine(bodyLines[bodyLines.length - 1])) {
      bodyLines.pop();
    }
  }

  return bodyLines
    .map((line) => {
      if (isContractPhotoDeliveryParagraph(line)) return photoDeliveryParagraph;
      return line;
    })
    .filter((line) => line !== null)
    .join("\n")
    .trim();
}

function isContractDocumentTitle(text) {
  const normalized = normalizeContractCompareText(text);
  return normalized === normalizeContractCompareText("CONTRATO DE PRESTAÇÃO DE SERVIÇOS")
    || normalized === normalizeContractCompareText("CONTRATO DE PRESTAÇÃO DE SERVIÇOS FOTOGRÁFICOS");
}

function isContractSectionHeading(text) {
  const normalized = normalizeContractCompareText(text).replace(/:$/, "");
  return normalized === "contratante"
    || normalized === "contratado"
    || normalized === "assinaturas"
    || /^clausula\s+\d+/.test(normalized);
}

function isContractListIntro(text) {
  const normalized = normalizeContractCompareText(text);
  return normalized.includes("se compromete a:")
    || normalized.includes("nao se responsabiliza por:")
    || normalized.includes("somente sera considerada reservada apos:");
}

function getContractExplicitBulletText(text) {
  const match = String(text || "").trim().match(/^[-•]\s*(.+)$/);
  return match ? match[1].trim() : "";
}

function drawContractSignatureBlock(doc, cursor, clientLabel, companyLabel, settings) {
  const hasSignatureImage = Boolean(settings.signatureDataUrl);
  ensureContractPageSpace(doc, cursor, hasSignatureImage ? 38 : 28, settings, { bottom: 276 });
  cursor.value += 4;

  const leftCenter = 62;
  const rightCenter = 148;
  const lineWidth = 64;
  const lineStartOffset = lineWidth / 2;

  if (hasSignatureImage) {
    const signatureFormat = getLogoFormatFromDataUrl(settings.signatureDataUrl);
    try {
      doc.addImage(settings.signatureDataUrl, signatureFormat, 116, cursor.value - 2, 64, 14);
      cursor.value += 14;
    } catch {
      // Se a imagem falhar, mantemos o bloco textual sem interromper o PDF.
    }
  }

  doc.setDrawColor(148, 163, 184);
  doc.line(leftCenter - lineStartOffset, cursor.value, leftCenter + lineStartOffset, cursor.value);
  doc.line(rightCenter - lineStartOffset, cursor.value, rightCenter + lineStartOffset, cursor.value);
  cursor.value += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(100, 116, 139);
  doc.text("CONTRATANTE", leftCenter, cursor.value, { align: "center" });
  doc.text("CONTRATADO", rightCenter, cursor.value, { align: "center" });
  cursor.value += 4.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.8);
  doc.setTextColor(71, 85, 105);
  doc.text(clientLabel, leftCenter, cursor.value, { align: "center" });
  doc.text(companyLabel, rightCenter, cursor.value, { align: "center" });
}

function drawContractPaperFrame(doc, cursor) {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(16, cursor.value, 178, 248 - cursor.value, 4, 4, "FD");
  doc.setDrawColor(214, 180, 95);
  doc.line(22, cursor.value + 7, 188, cursor.value + 7);
}

function ensureContractPageSpace(doc, cursor, amount, settings, options = {}) {
  const { bottom = 262 } = options;
  if (cursor.value + amount <= bottom) return;
  doc.addPage();
  drawDocumentHeader(doc, settings, "CONTRATO DE PRESTAÇÃO DE SERVIÇOS");
  cursor.value = 56;
  drawContractPaperFrame(doc, cursor);
  cursor.value = 66;
}

function drawContractParagraph(doc, cursor, text, options = {}, settings = {}) {
  const { tone = "body", indent = 0 } = options;
  const content = String(text || "").trim();
  if (!content) {
    cursor.value += 4;
    return;
  }

  const width = (tone === "body" || tone === "intro" ? 150 : 156) - indent;
  const lines = doc.splitTextToSize(content, width);
  const lineHeight = tone === "heading" ? 5.8 : tone === "bullet" ? 4.9 : tone === "intro" ? 5.5 : 5.2;
  ensureContractPageSpace(doc, cursor, lines.length * lineHeight + 8, settings);

  if (tone === "heading") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
  } else if (tone === "bullet") {
    doc.setFont("times", "normal");
    doc.setFontSize(10.6);
    doc.setTextColor(55, 65, 81);
  } else if (tone === "intro") {
    doc.setFont("times", "normal");
    doc.setFontSize(10.9);
    doc.setTextColor(31, 41, 55);
  } else {
    doc.setFont("times", "normal");
    doc.setFontSize(10.8);
    doc.setTextColor(55, 65, 81);
  }

  if (tone === "bullet") {
    doc.text("•", 29, cursor.value);
  }

  doc.text(lines, 28 + indent, cursor.value);
  cursor.value += lines.length * lineHeight + (tone === "heading" ? 2.6 : 1.8);
}

function renderContractBody(doc, cursor, contractText, settings) {
  const rawLines = String(contractText || "").replace(/\r\n/g, "\n").split("\n");
  let inBulletList = false;
  let hasRenderedListItem = false;

  rawLines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      if (inBulletList && !hasRenderedListItem) {
        cursor.value += 1.5;
        return;
      }

      if (inBulletList && hasRenderedListItem) {
        inBulletList = false;
        hasRenderedListItem = false;
      }

      cursor.value += 2.4;
      return;
    }

    if (isContractDocumentTitle(trimmed)) {
      return;
    }

    if (isContractSectionHeading(trimmed) || /^\d+\.\s/.test(trimmed)) {
      inBulletList = false;
      hasRenderedListItem = false;
      drawContractParagraph(doc, cursor, trimmed, { tone: "heading" }, settings);
      return;
    }

    const explicitBulletText = getContractExplicitBulletText(trimmed);
    if (explicitBulletText) {
      drawContractParagraph(doc, cursor, explicitBulletText, { tone: "bullet", indent: 8 }, settings);
      return;
    }

    if (isContractListIntro(trimmed)) {
      inBulletList = true;
      hasRenderedListItem = false;
      drawContractParagraph(doc, cursor, trimmed, { tone: "body" }, settings);
      return;
    }

    if (inBulletList) {
      hasRenderedListItem = true;
      drawContractParagraph(doc, cursor, trimmed, { tone: "bullet", indent: 8 }, settings);
      return;
    }

    if (trimmed.endsWith(":") && trimmed.length <= 42) {
      drawContractParagraph(doc, cursor, trimmed, { tone: "heading" }, settings);
      return;
    }

    drawContractParagraph(doc, cursor, trimmed, { tone: "body" }, settings);
  });
}

function sanitizeFilePart(value, fallback) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function buildReceiptPreview(record, settings = {}) {
  const receiptDate = record.receiptDate ? formatDateBR(record.receiptDate) : formatDateBR(getTodayLocalISO());
  const receiptMethod = record.receiptMethod || "A combinar";
  const receiptReference = fixSentenceSpacing(record.receiptReference) || "Sem observações adicionais.";
  const receiptReferenceText = /[.!?]$/.test(receiptReference) ? receiptReference : `${receiptReference}.`;
  const studioName = settings.studioName || "Emerson Honorato Retratos";
  const studioDocument = settings.studioDocument || "-";

  return [
    `Recebi de ${record.clientName || "-"}, CPF ${formatTaxId(record.clientCpf) || "-"}, o valor de ${formatCurrency(record.amountPaid || 0)}, referente ao serviço ${record.eventType || record.packageName || "-"}` +
      `${record.eventDate ? ` previsto/realizado em ${formatDateBR(record.eventDate)}` : ""}.`,
    `Data do recebimento: ${receiptDate}.`,
    `Forma de pagamento: ${receiptMethod}.`,
    `Referência: ${receiptReferenceText}`,
    "",
    `${studioName}`,
    `CNPJ: ${formatTaxId(studioDocument) || "-"}`,
  ].join("\n");
}

function fixSentenceSpacing(text) {
  if (!text) return text;
  return String(text).replace(/([.!?])([A-ZÀ-Ú])/g, "$1 $2");
}

function getBudgetResolvedLeadLineCount(lines, requestedLineCount) {
  let lineCount = Math.max(0, Math.min(requestedLineCount, lines.length));

  while (lineCount < lines.length) {
    const leadText = lines.slice(0, lineCount).join(" ");
    const openParentheses = (leadText.match(/\(/g) || []).length;
    const closeParentheses = (leadText.match(/\)/g) || []).length;

    if (openParentheses <= closeParentheses) break;
    lineCount += 1;
  }

  return lineCount;
}

function prepareBudgetPdfData(record, settings = {}) {
  const clientName = record.clientName || "Cliente não informado";
  const eventType = record.eventType || "Serviço não informado";
  const eventDate = record.eventDate ? formatDateBR(record.eventDate) : "A definir";
  const eventTime = record.startTime || "A definir";
  const location = record.location || "A definir";
  const packageName = record.packageName || record.eventType || "Pacote não informado";
  const photoSize = String(record.photoSize || "").trim();
  const onlinePhotosCount = Number(record.onlinePhotosCount || 0);
  const printedPhotosCount = Number(record.editedPhotosCount || 0);
  const rawItems = Array.isArray(record.items) ? record.items : [];
  const serviceCatalog = normalizeBudgetServiceCatalog(record, settings);
  const items = normalizeItems(record.items || []).map((item, index) => {
    const source = rawItems[index] && typeof rawItems[index] === "object" ? rawItems[index] : {};
    const service = findBudgetServiceForItem(source, serviceCatalog);
    const scopeItems = Array.isArray(source.scopeItems)
      ? source.scopeItems.map((scopeItem) => String(fixSentenceSpacing(scopeItem) || "").trim()).filter(Boolean)
      : Array.isArray(service?.scopeItems)
        ? service.scopeItems.map((scopeItem) => String(fixSentenceSpacing(scopeItem) || "").trim()).filter(Boolean)
      : [];

    return {
      ...item,
      serviceId: source.serviceId || service?.id || item.serviceId || "",
      description: String(fixSentenceSpacing(source.description || item.description || service?.itemDescription || service?.workDescription || "") || "").trim(),
      itemDescription: String(fixSentenceSpacing(source.itemDescription || source.serviceItemsSnapshot || item.itemDescription || service?.itemDescription || "") || "").trim(),
      workDescription: String(fixSentenceSpacing(source.workDescription || source.serviceDescription || source.serviceDescriptionSnapshot || item.workDescription || service?.workDescription || "") || "").trim(),
      scopeItems,
    };
  });
  const total = items.length > 0 ? getItemsTotal(items) : Number(record.amount || 0);
  const validityDays = Number(record.budgetValidityDays || settings.budgetValidityDays || 7);
  const paymentTerms = settings.paymentTerms || "Condição de pagamento a combinar.";
  const notes = fixSentenceSpacing(record.notes || "");
  const workDescription = (fixSentenceSpacing(record.budgetDescription) || "").trim() || "Cobertura e entrega conforme combinado.";
  const normalizedWorkDescription = workDescription.replace(/\s+/g, " ").trim().toLowerCase();
  const workDescriptionIsStructured = extractBulletLines(workDescription).length >= 2;
  const normalizedPackageName = String(packageName || "").replace(/\s+/g, " ").trim().toLowerCase();
  const normalizedEventType = String(eventType || "").replace(/\s+/g, " ").trim().toLowerCase();
  const shouldShowPackageCard = normalizedPackageName && normalizedPackageName !== normalizedEventType;
  const fullWorkLines = splitTextIntoBudgetParagraphLines(new jsPDF(), workDescription, 174);
  const firstPageWorkLineLimit = fullWorkLines.length > 16 ? 16 : fullWorkLines.length;
  const displayWorkLines = fullWorkLines.slice(0, firstPageWorkLineLimit);
  const remainingWorkLines = fullWorkLines.slice(firstPageWorkLineLimit);
  const deliveryEntries = [
    printedPhotosCount ? { label: "Fotos reveladas", value: String(printedPhotosCount) } : null,
    onlinePhotosCount ? { label: "Fotos digitais entregues", value: String(onlinePhotosCount) } : null,
    photoSize ? { label: "Tamanho da foto", value: photoSize } : null,
  ].filter(Boolean);
  const renderedItems = items.length > 0
      ? items
      : [{ id: "single", name: packageName, description: "", quantity: 1, unitPrice: total }];
  const serviceSnapshot = {
    category: String(record.category || "").trim(),
    itemDescription: String(fixSentenceSpacing(record.serviceItemsSnapshot) || "").trim(),
    workDescription: String(fixSentenceSpacing(record.serviceDescriptionSnapshot || record.budgetDescription) || "").trim(),
    paymentTerms: String(fixSentenceSpacing(record.contractPaymentMethod || settings.paymentTerms) || "").trim(),
    deliveryTerms: String(fixSentenceSpacing(record.contractDeliveryTerms) || "").trim(),
    commercialNotes: String(fixSentenceSpacing(record.notes) || "").trim(),
    contractNotes: String(fixSentenceSpacing(record.contractNotes) || "").trim(),
    receiptMethod: String(record.receiptMethod || "").trim(),
    receiptReference: String(fixSentenceSpacing(record.receiptReference) || "").trim(),
    budgetValidityDays: validityDays,
    recommendedDeliveryDays: Number(record.recommendedDeliveryDays || 0),
  };

  return {
    clientName,
    eventType,
    eventDate,
    eventTime,
    location,
    packageName,
    total,
    validityDays,
    paymentTerms,
    notes,
    normalizedWorkDescription,
    workDescriptionIsStructured,
    shouldShowPackageCard,
    displayWorkLines,
    remainingWorkLines,
    deliveryEntries,
    renderedItems,
    serviceSnapshot,
  };
}

function _drawBudgetClientSection(doc, cursor, budgetData) {
  drawSectionTitle(doc, cursor, "Dados do cliente");

  doc.setFillColor(243, 246, 250);
  doc.roundedRect(16, cursor.value, 118, 14, 3, 3, "F");
  doc.roundedRect(138, cursor.value, 56, 14, 3, 3, "F");
  setPdfLabel(doc);
  doc.text("Cliente", 20, cursor.value + 6);
  doc.text("Serviço", 142, cursor.value + 6);
  setPdfBodyStrong(doc);
  doc.text(doc.splitTextToSize(budgetData.clientName, 110), 20, cursor.value + 10.5);
  doc.text(doc.splitTextToSize(budgetData.eventType, 48), 142, cursor.value + 10.5);
  cursor.value += 17;

  const scheduleFields = [
    { label: "Data", value: budgetData.eventDate, x: 16 },
    { label: "Horário", value: budgetData.eventTime, x: 77 },
    { label: "Local", value: budgetData.location, x: 138 },
  ];

  scheduleFields.forEach(({ label, value, x }) => {
    const pending = String(value || "").trim().toLowerCase() === "a definir";
    doc.setFillColor(...(pending ? [249, 250, 252] : [243, 246, 250]));
    doc.roundedRect(x, cursor.value, 56, 13, 3, 3, "F");
    doc.setDrawColor(...(pending ? [232, 236, 242] : [243, 246, 250]));
    doc.roundedRect(x, cursor.value, 56, 13, 3, 3, "S");
    setPdfLabel(doc);
    doc.text(label, x + 4, cursor.value + 6);
    drawBudgetFieldValue(doc, value, x + 4, cursor.value + 9.8, 48);
  });
  cursor.value += 15.5;
}

function drawBudgetSimpleClientSection(doc, cursor, budgetData) {
  drawSectionTitle(doc, cursor, "Dados do cliente", "client");
  const schedulePendingCount = [budgetData.eventDate, budgetData.eventTime, budgetData.location].filter(isBudgetPendingValue).length;

  drawBudgetInfoCard(doc, 16, cursor.value, 178, 18, "Cliente", budgetData.clientName, {
    fill: [246, 248, 252],
    accent: [214, 180, 95],
    valueStrong: true,
  });
  cursor.value += 22.5;

  drawBudgetInfoCard(doc, 16, cursor.value, 86, 13, "Serviço", budgetData.eventType, {
    fill: [249, 250, 252],
    accent: [191, 201, 214],
    valueStrong: true,
  });
  drawBudgetInfoCard(doc, 108, cursor.value, 86, 13, "Data", getBudgetScheduleDisplayValue(budgetData.eventDate, schedulePendingCount), {
    fill: [249, 250, 252],
    accent: [214, 180, 95],
    valueSize: 9.4,
  });
  cursor.value += 15.5;

  drawBudgetInfoCard(doc, 16, cursor.value, 86, 13, "Horário", getBudgetScheduleDisplayValue(budgetData.eventTime, schedulePendingCount), {
    fill: [249, 250, 252],
    accent: [191, 201, 214],
    valueSize: 9.4,
  });
  drawBudgetInfoCard(doc, 108, cursor.value, 86, 13, "Local", getBudgetScheduleDisplayValue(budgetData.location, schedulePendingCount), {
    fill: [249, 250, 252],
    accent: [191, 201, 214],
    valueSize: 9.4,
  });
  cursor.value += 16.5;

  if (schedulePendingCount >= 2) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.7);
    doc.setTextColor(100, 116, 139);
    doc.text("Data, horário e local serão confirmados no alinhamento final.", 16, cursor.value - 1.2);
    cursor.value += 12;
    return;
  }

  cursor.value += 12;
}

function drawBudgetSimpleServiceSection(doc, cursor, budgetData, settings) {
  drawSectionTitle(doc, cursor, "Resumo do serviço", "service");

  if (budgetData.shouldShowPackageCard) {
    drawBudgetInfoCard(doc, 16, cursor.value, 178, 14.5, "Pacote", budgetData.packageName, {
      fill: [247, 248, 252],
      accent: [214, 180, 95],
      valueStrong: true,
    });
    cursor.value += 16.5;
  }

  const summaryLines = buildBudgetNarrativeLines(budgetData);

  if (summaryLines.length) {
    drawBudgetEditorialCard(doc, cursor, "Descrição do serviço", summaryLines, {
      fill: [248, 249, 252],
      accent: [214, 180, 95],
      bodyColor: [30, 41, 59],
      minHeight: 28,
      leadLineCount: Math.min(1, summaryLines.length),
    });
  }

  if (budgetData.serviceSnapshot.itemDescription) {
    const itemLines = buildBudgetTechnicalScopeLines(doc, budgetData);
    drawBudgetTechnicalScopeCard(doc, cursor, "Escopo contratado", itemLines, {
      fill: [250, 250, 251],
      accent: [191, 201, 214],
      textColor: [51, 65, 85],
    });
  }

  if (budgetData.deliveryEntries.length) {
    const cardGap = 4;
    const totalWidth = 178;
    const cardWidth = (totalWidth - cardGap * (budgetData.deliveryEntries.length - 1)) / budgetData.deliveryEntries.length;
    const deliveryHeight = 14;
    ensureSpace(doc, cursor, deliveryHeight + 7.5, settings);

    setPdfLabel(doc);
    doc.text("Entregas principais", 16, cursor.value + 2.5);

    budgetData.deliveryEntries.forEach((entry, index) => {
      const cardX = 16 + index * (cardWidth + cardGap);
      drawBudgetInfoCard(doc, cardX, cursor.value + 4.4, cardWidth, deliveryHeight, entry.label, entry.value, {
        fill: index === 0 ? [255, 251, 240] : [248, 249, 251],
        accent: index === 0 ? [214, 180, 95] : [191, 201, 214],
        valueStrong: true,
        valueSize: 9.3,
        labelColor: index === 0 ? [146, 108, 33] : [100, 116, 139],
        radius: 4,
      });
    });

    cursor.value += deliveryHeight + 11.5;

    if (cursor.value < 240) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.2);
      doc.setTextColor(148, 163, 184);
      doc.text(
        "Condições comerciais e investimento organizados na próxima página.",
        105,
        cursor.value + 8,
        { align: "center" },
      );
      cursor.value += 16;
    }
  }

  const metaCards = [
    budgetData.serviceSnapshot.category
      ? { label: "Categoria", value: budgetData.serviceSnapshot.category, accent: [191, 201, 214] }
      : null,
    budgetData.serviceSnapshot.recommendedDeliveryDays
      ? { label: "Prazo sugerido", value: `${budgetData.serviceSnapshot.recommendedDeliveryDays} dias`, accent: [214, 180, 95] }
      : null,
    budgetData.serviceSnapshot.receiptMethod
      ? { label: "Recebimento", value: budgetData.serviceSnapshot.receiptMethod, accent: [191, 201, 214] }
      : null,
  ].filter(Boolean);

  if (metaCards.length) {
    ensureSpace(doc, cursor, 20, settings);
    const totalWidth = 178;
    const gap = 4;
    const cardWidth = (totalWidth - gap * (metaCards.length - 1)) / metaCards.length;
    metaCards.forEach((entry, index) => {
      drawBudgetInfoCard(doc, 16 + index * (cardWidth + gap), cursor.value, cardWidth, 14, entry.label, entry.value, {
        fill: [249, 250, 252],
        accent: entry.accent,
        valueStrong: true,
        valueSize: 9.2,
      });
    });
    cursor.value += 17;
  }

  cursor.value += 4;
}

function drawBudgetCommercialHighlight(doc, cursor, budgetData, settings) {
  doc.setFillColor(248, 248, 246);
  doc.roundedRect(16, cursor.value, 178, 20, 4, 4, "F");
  doc.setFillColor(214, 180, 95);
  doc.roundedRect(16, cursor.value, 2.2, 20, 1.2, 1.2, "F");

  setPdfLabel(doc);
  doc.text("Fechamento comercial", 20, cursor.value + 5.5);

  drawBudgetInfoCard(doc, 20, cursor.value + 7.5, 36, 10.5, "Validade", `${budgetData.validityDays} dias`, {
    fill: [255, 255, 255],
    accent: [214, 180, 95],
    valueStrong: true,
    valueSize: 8.6,
    radius: 3,
  });

  drawBudgetInfoCard(doc, 60, cursor.value + 7.5, 66, 10.5, "Próxima etapa", "Condições finais na página seguinte", {
    fill: [255, 255, 255],
    accent: [191, 201, 214],
    valueSize: 7.6,
    radius: 3,
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("INVESTIMENTO", 188, cursor.value + 7.5, { align: "right" });
  doc.setFontSize(12.8);
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrency(budgetData.total), 188, cursor.value + 15.2, { align: "right" });

  cursor.value += 25;
}

function drawBudgetSimpleFinancialSection(doc, cursor, budgetData, settings) {
  const commercialPayment = budgetData.serviceSnapshot.paymentTerms || settings.paymentTerms || "Pagamento a combinar.";
  const extraCommercialBlocks = [
    budgetData.serviceSnapshot.deliveryTerms,
    budgetData.serviceSnapshot.commercialNotes,
    budgetData.serviceSnapshot.contractNotes,
    budgetData.serviceSnapshot.receiptReference,
  ].filter(Boolean).length;
  const compactCommercialSummary = extraCommercialBlocks > 0 || commercialPayment.length > 72;
  const sections = [
    compactCommercialSummary && commercialPayment ? { title: "Forma de pagamento", value: commercialPayment } : null,
    budgetData.serviceSnapshot.deliveryTerms ? { title: "Entrega", value: budgetData.serviceSnapshot.deliveryTerms } : null,
    budgetData.serviceSnapshot.commercialNotes ? { title: "Observações comerciais", value: budgetData.serviceSnapshot.commercialNotes } : null,
    budgetData.serviceSnapshot.contractNotes ? { title: "Observações do contrato", value: budgetData.serviceSnapshot.contractNotes } : null,
    budgetData.serviceSnapshot.receiptReference ? { title: "Referência de recibo", value: budgetData.serviceSnapshot.receiptReference } : null,
  ].filter(Boolean);
  const reservedHeight = 8.5 + 37 + estimateBudgetSimpleCommercialBlocksHeight(doc, sections);
  if (cursor.value + reservedHeight > 282) {
    doc.addPage();
    cursor.value = 18;
  }

  drawSectionTitle(doc, cursor, "Informações comerciais", "commercial");
  ensureSpace(doc, cursor, 37 + extraCommercialBlocks * 15, settings);

  doc.setFillColor(248, 248, 246);
  doc.roundedRect(16, cursor.value, 178, 31, 5, 5, "F");
  doc.setDrawColor(232, 236, 242);
  doc.roundedRect(16, cursor.value, 178, 31, 5, 5, "S");
  doc.setFillColor(214, 180, 95);
  doc.roundedRect(16, cursor.value, 2.4, 31, 1.2, 1.2, "F");

  drawBudgetInfoCard(doc, 20, cursor.value + 5.5, 38, 12.5, "Validade", `${budgetData.validityDays} dias`, {
    fill: [255, 255, 255],
    accent: [214, 180, 95],
    valueStrong: true,
    valueSize: 9.2,
  });

  if (compactCommercialSummary) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.1);
    doc.setTextColor(71, 85, 105);
    doc.text("Condições detalhadas organizadas logo abaixo.", 64, cursor.value + 13.2);
  } else {
    drawBudgetInfoCard(doc, 62, cursor.value + 5.5, 64, 12.5, "Pagamento", commercialPayment, {
      fill: [255, 255, 255],
      accent: [191, 201, 214],
      valueSize: 8.2,
    });
  }

  doc.setFillColor(23, 27, 38);
  doc.roundedRect(130, cursor.value + 5.5, 60, 24, 4, 4, "F");
  doc.setDrawColor(214, 180, 95);
  doc.setLineWidth(0.5);
  doc.line(134, cursor.value + 3.5, 188, cursor.value + 3.5);
  doc.setLineWidth(0.2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(214, 180, 95);
  doc.text("INVESTIMENTO", 160, cursor.value + 10.8, { align: "center" });
  doc.setFontSize(15.5);
  doc.setTextColor(255, 255, 255);
  doc.text(formatCurrency(budgetData.total), 160, cursor.value + 21.8, { align: "center" });

  cursor.value += 40;

  sections.forEach((section, index) => {
    const lines = splitTextIntoBudgetParagraphLines(doc, section.value, 168).slice(0, 6);
    drawBudgetEditorialCard(doc, cursor, section.title, lines, {
      fill: index % 2 === 0 ? [248, 249, 252] : [250, 250, 251],
      accent: index % 2 === 0 ? [214, 180, 95] : [191, 201, 214],
      bodyColor: [51, 65, 85],
      minHeight: 18,
      leadLineCount: Math.min(1, lines.length),
    });
  });
}

function _drawBudgetScopeSection(doc, cursor, budgetData, settings) {
  cursor.value += 4;
  ensureSpace(doc, cursor, 56, settings);
  drawSectionTitle(doc, cursor, "Pacote e escopo");

  if (budgetData.shouldShowPackageCard) {
    drawBudgetInfoCard(doc, 16, cursor.value, 178, 14.5, "Descrição do pacote", budgetData.packageName, {
      fill: [247, 248, 252],
      accent: [214, 180, 95],
      valueStrong: true,
    });
    cursor.value += 16;
  }

  const firstParagraphLineCount = Math.max(
    0,
    budgetData.displayWorkLines.findIndex((line) => !String(line || "").trim()),
  );
  const leadLineCount = firstParagraphLineCount > 0 ? firstParagraphLineCount : Math.min(2, budgetData.displayWorkLines.length);

  drawBudgetEditorialCard(doc, cursor, "Descrição dos trabalhos", budgetData.displayWorkLines, {
    fill: [248, 249, 252],
    accent: [214, 180, 95],
    bodyColor: [30, 41, 59],
    minHeight: 24,
    leadLineCount,
  });
}

function _drawBudgetDeliveriesSection(doc, cursor, budgetData, settings) {
  if (!budgetData.deliveryEntries.length) return;

  const cardGap = 4;
  const totalWidth = 178;
  const cardWidth = (totalWidth - cardGap * (budgetData.deliveryEntries.length - 1)) / budgetData.deliveryEntries.length;
  const deliveryHeight = 16;

  ensureSpace(doc, cursor, deliveryHeight + 10, settings);
  doc.setFillColor(249, 249, 251);
  doc.roundedRect(16, cursor.value, 178, deliveryHeight + 3, 4, 4, "F");
  setPdfLabel(doc);
  doc.text("Entregas incluídas", 20, cursor.value + 5.5);

  budgetData.deliveryEntries.forEach((entry, index) => {
    const cardX = 20 + index * (cardWidth + cardGap);
    drawBudgetInfoCard(doc, cardX, cursor.value + 6.2, cardWidth, deliveryHeight, entry.label, entry.value, {
      fill: index === 0 ? [255, 251, 240] : [255, 255, 255],
      accent: index === 0 ? [214, 180, 95] : [191, 201, 214],
      valueStrong: true,
      valueSize: 9.8,
      labelColor: index === 0 ? [146, 108, 33] : [100, 116, 139],
      radius: 4,
    });
  });

  cursor.value += deliveryHeight + 10.5;
  cursor.value += 1;
}

function _drawBudgetExtendedScopeSection(doc, cursor, budgetData, settings, options = {}) {
  const { title = "Continuação do escopo", compact = false } = options;
  if (!budgetData.remainingWorkLines?.length) return;

  const scopedLines = compact ? budgetData.remainingWorkLines.slice(0, 2) : budgetData.remainingWorkLines;

  ensureSpace(doc, cursor, Math.min(compact ? 42 : 60, scopedLines.length * 5.2 + 18), settings);
  drawBudgetEditorialCard(doc, cursor, title, scopedLines, {
    fill: [250, 250, 251],
    accent: [191, 201, 214],
    bodyColor: [51, 65, 85],
    minHeight: compact ? 18 : 22,
  });
}

function estimateBudgetExtendedScopeHeight(budgetData, options = {}) {
  const { compact = false } = options;
  if (!budgetData.remainingWorkLines?.length) return 0;
  const scopedLines = compact ? budgetData.remainingWorkLines.slice(0, 2) : budgetData.remainingWorkLines;
  return estimateBudgetEditorialCardHeight(scopedLines, {
    minHeight: compact ? 18 : 22,
  });
}

function estimateBudgetRowHeight(doc, item, budgetData, options = {}) {
  const itemName = item.name || "Item";
  const itemDescription = String(item.description || "").trim();
  const descriptionLines = buildBudgetItemDescriptionLines(
    doc,
    itemDescription,
    budgetData.normalizedWorkDescription,
    102,
    {
      workDescriptionIsStructured: budgetData.workDescriptionIsStructured,
      compact: options.compactDescription,
    },
  );
  const titleLines = doc.splitTextToSize(itemName, 104);
  return Math.max(13, titleLines.length * 4.6 + (descriptionLines.length ? descriptionLines.length * 4 + 4.5 : 0));
}

function estimateBudgetItemsSectionHeight(doc, budgetData, options = {}) {
  const compactItemDescription = options.compactDescription ?? (budgetData.renderedItems.length === 1 && budgetData.displayWorkLines.length >= 6);
  const rowsHeight = budgetData.renderedItems.reduce(
    (total, item) =>
      total
      + estimateBudgetRowHeight(doc, item, budgetData, {
        compactDescription: compactItemDescription,
      })
      + 7.5,
    0,
  );

  return 8.5 + 14.5 + rowsHeight;
}

function drawBudgetItemsSection(doc, cursor, budgetData, settings, options = {}) {
  const {
    allowPageBreak = true,
    compactDescription = budgetData.renderedItems.length === 1 && budgetData.displayWorkLines.length >= 6,
  } = options;
  const firstRowHeight = budgetData.renderedItems.length
    ? estimateBudgetRowHeight(doc, budgetData.renderedItems[0], budgetData, {
        compactDescription,
      })
    : 18;
  const budgetSectionReserve = 8.5 + 14.5 + firstRowHeight + 4;
  const needsNextPageForBudgetItems = cursor.value + budgetSectionReserve > 279;
  if (needsNextPageForBudgetItems && allowPageBreak) {
    drawBudgetTransitionSummary(doc, cursor, budgetData.total, budgetData.validityDays, settings);
    doc.addPage();
    cursor.value = 18;
  }

  drawSectionTitle(doc, cursor, "Itens do orçamento", "service");

  doc.setFillColor(249, 250, 251);
  doc.roundedRect(16, cursor.value, 178, 13, 4, 4, "F");
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(16, cursor.value, 178, 13, 4, 4, "S");
  doc.setDrawColor(214, 180, 95);
  doc.line(20, cursor.value + 3.5, 68, cursor.value + 3.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_TYPO.microSize);
  doc.setTextColor(71, 85, 105);
  doc.text("DESCRIÇÃO", 20, cursor.value + 7.7);
  doc.text("QTD", 146, cursor.value + 7.7, { align: "right" });
  doc.text("VALOR", 168, cursor.value + 7.7, { align: "right" });
  doc.text("SUBTOTAL", 190, cursor.value + 7.7, { align: "right" });
  cursor.value += 14.5;

  budgetData.renderedItems.forEach((item, index) => {
    const itemName = item.name || "Item";
    const itemDescription = String(item.description || "").trim();
    const descriptionLines = buildBudgetItemDescriptionLines(
      doc,
      itemDescription,
      budgetData.normalizedWorkDescription,
      102,
      {
        workDescriptionIsStructured: budgetData.workDescriptionIsStructured,
        compact: compactDescription,
      },
    );
    const titleLines = doc.splitTextToSize(itemName, 104);
    const rowHeight = Math.max(13, titleLines.length * 4.6 + (descriptionLines.length ? descriptionLines.length * 4 + 4.5 : 0));
    const quantity = Number(item.quantity || 1);
    const unitPrice = Number(item.unitPrice || 0);

    ensureSpace(doc, cursor, rowHeight + 7, settings);

    doc.setFillColor(index % 2 === 0 ? 250 : 247, index % 2 === 0 ? 250 : 248, index % 2 === 0 ? 252 : 250);
    doc.roundedRect(16, cursor.value - 4, 178, rowHeight + 6, 4, 4, "F");
    doc.setDrawColor(229, 233, 240);
    doc.roundedRect(16, cursor.value - 4, 178, rowHeight + 6, 4, 4, "S");
    doc.setFillColor(index % 2 === 0 ? 214 : 191, index % 2 === 0 ? 180 : 201, index % 2 === 0 ? 95 : 214);
    doc.roundedRect(16, cursor.value - 4, 2.2, rowHeight + 6, 1.2, 1.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.3);
    doc.setTextColor(148, 163, 184);
    doc.text(`ITEM ${String(index + 1).padStart(2, "0")}`, 186, cursor.value + 1, { align: "right" });
    doc.setDrawColor(index === 0 ? 214 : 203, index === 0 ? 180 : 213, index === 0 ? 95 : 225);
    doc.line(22, cursor.value - 0.5, 66, cursor.value - 0.5);
    setPdfBodyStrong(doc);
    doc.text(titleLines, 22, cursor.value + 1);

    if (descriptionLines.length) {
      doc.setDrawColor(232, 236, 242);
      doc.line(22, cursor.value + titleLines.length * 4.9 + 0.4, 118, cursor.value + titleLines.length * 4.9 + 0.4);
      setPdfSmall(doc);
      doc.setTextColor(88, 102, 124);
      doc.text(descriptionLines, 22, cursor.value + titleLines.length * 4.9 + 4.4);
    }

    setPdfBody(doc);
    doc.text(String(quantity), 146, cursor.value + 1, { align: "right" });
    doc.text(formatCurrency(unitPrice), 168, cursor.value + 1, { align: "right" });
    doc.text(formatCurrency(quantity * unitPrice), 190, cursor.value + 1, { align: "right" });
    cursor.value += rowHeight + 7.5;
  });

  return needsNextPageForBudgetItems;
}

function buildBudgetMultiItemDescriptionLines(doc, item, width = 164) {
  const workDescription = String(item.workDescription || "").trim();
  const description = removeBudgetBulletLines(item.description || "");
  const hasStructuredDescription = extractBulletLines(item.description || "").length > 0;
  const descriptionSource = hasStructuredDescription ? description : workDescription || description;

  return splitTextIntoBudgetParagraphLines(doc, descriptionSource, width)
    .map((line) => String(line || "").trim())
    .filter(Boolean);
}

function buildBudgetMultiItemScopeItems(item) {
  if (Array.isArray(item.scopeItems) && item.scopeItems.length) {
    return item.scopeItems;
  }

  const itemDescription = String(item.itemDescription || "").trim();
  const description = String(item.description || "").trim();
  const workDescription = String(item.workDescription || "").trim();
  const candidates = [itemDescription, description, workDescription].filter(Boolean);

  for (const candidate of candidates) {
    const bulletLines = extractBulletLines(candidate);
    if (bulletLines.length) return bulletLines;
  }

  if (itemDescription) {
    return buildBudgetSentenceScopeItems(itemDescription);
  }

  return [];
}

function drawBudgetMultiItemTotalsRow(doc, cursor, quantity, unitPrice, subtotal, settings) {
  ensureSpace(doc, cursor, 16, settings);

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(20, cursor.value, 170, 13, 4, 4, "F");
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(20, cursor.value, 170, 13, 4, 4, "S");

  const details = [
    { label: "Qtd", value: String(quantity), x: 28, align: "left" },
    { label: "Unitário", value: formatCurrency(unitPrice), x: 104, align: "right" },
    { label: "Total", value: formatCurrency(subtotal), x: 184, align: "right", bold: true },
  ];

  details.forEach((detail) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    doc.text(detail.label, detail.x, cursor.value + 5, { align: detail.align });
    doc.setFont("helvetica", detail.bold ? "bold" : "normal");
    doc.setFontSize(detail.bold ? 9 : 8.4);
    doc.setTextColor(detail.bold ? 15 : 55, detail.bold ? 23 : 65, detail.bold ? 42 : 81);
    doc.text(detail.value, detail.x, cursor.value + 10, { align: detail.align });
  });

  cursor.value += 17;
}

function drawBudgetMultiItemsSection(doc, cursor, budgetData, settings) {
  drawSectionTitle(doc, cursor, "Itens do orçamento", "service");

  budgetData.renderedItems.forEach((item, index) => {
    const itemName = item.name || "Item";
    const quantity = Number(item.quantity || 1);
    const unitPrice = Number(item.unitPrice || 0);
    const subtotal = quantity * unitPrice;
    const titleLines = doc.splitTextToSize(itemName, 158);
    const descriptionLines = buildBudgetMultiItemDescriptionLines(doc, item);
    const scopeItems = buildBudgetMultiItemScopeItems(item);
    const cardHeight = Math.max(24, 13 + titleLines.length * 4.8);

    const minItemHeight = 50;
    if (cursor.value + minItemHeight > 280) {
      doc.addPage();
      cursor.value = 18;
    }

    ensureSpace(doc, cursor, cardHeight + 6, settings);

    doc.setFillColor(index % 2 === 0 ? 250 : 247, index % 2 === 0 ? 250 : 248, index % 2 === 0 ? 252 : 250);
    doc.roundedRect(16, cursor.value, 178, cardHeight, 5, 5, "F");
    doc.setDrawColor(229, 233, 240);
    doc.roundedRect(16, cursor.value, 178, cardHeight, 5, 5, "S");
    doc.setFillColor(index % 2 === 0 ? 214 : 191, index % 2 === 0 ? 180 : 201, index % 2 === 0 ? 95 : 214);
    doc.roundedRect(16, cursor.value, 2.4, cardHeight, 1.2, 1.2, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.4);
    doc.setTextColor(148, 163, 184);
    doc.text(`ITEM ${String(index + 1).padStart(2, "0")}`, 22, cursor.value + 7);

    setPdfBodyStrong(doc);
    doc.text(titleLines, 22, cursor.value + 13);

    cursor.value += cardHeight + 5.5;

    if (descriptionLines.length) {
      ensureSpace(doc, cursor, estimateBudgetEditorialCardHeight(descriptionLines, {
        minHeight: 18,
        leadLineCount: Math.min(1, descriptionLines.length),
      }), settings);
      drawBudgetEditorialCard(doc, cursor, "Descrição do serviço", descriptionLines, {
        fill: [252, 252, 253],
        accent: [214, 180, 95],
        bodyColor: [30, 41, 59],
        minHeight: 18,
        leadLineCount: Math.min(1, descriptionLines.length),
      });
    }

    if (scopeItems.length) {
      drawBudgetTechnicalScopeCard(doc, cursor, "Escopo", scopeItems, {
        fill: [246, 247, 249],
        accent: [191, 201, 214],
        textColor: [51, 65, 85],
      });
    }

    drawBudgetMultiItemTotalsRow(doc, cursor, quantity, unitPrice, subtotal, settings);

    if (index < budgetData.renderedItems.length - 1) {
      ensureSpace(doc, cursor, 6, settings);
      doc.setDrawColor(226, 232, 240);
      doc.line(20, cursor.value, 190, cursor.value);
      cursor.value += 6;
    }
  });

  ensureSpace(doc, cursor, 24, settings);
  doc.setFillColor(23, 27, 38);
  doc.roundedRect(116, cursor.value, 78, 18, 4, 4, "F");
  doc.setDrawColor(214, 180, 95);
  doc.setLineWidth(0.5);
  doc.line(120, cursor.value - 2, 190, cursor.value - 2);
  doc.setLineWidth(0.2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(214, 180, 95);
  doc.text("TOTAL GERAL", 155, cursor.value + 5, { align: "center" });
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(formatCurrency(budgetData.total), 155, cursor.value + 13.5, { align: "center" });
  cursor.value += 22;
}

function _shouldPushBudgetClosureToNextPage(cursor) {
  const reservedClosureHeight = 74;
  const availableLimit = 279;
  return cursor.value + reservedClosureHeight > availableLimit;
}

function drawBudgetFinancialClosure(doc, cursor, budgetData, settings, options = {}) {
  const { compact = false } = options;
  cursor.value += compact ? 2 : 5;
  ensureSpace(doc, cursor, compact ? 22 : 30, settings);
  doc.setFillColor(247, 248, 252);
  doc.roundedRect(16, cursor.value - 2, 178, compact ? 19 : 26, 5, 5, "F");
  doc.setDrawColor(232, 236, 242);
  doc.roundedRect(16, cursor.value - 2, 178, compact ? 19 : 26, 5, 5, "S");
  doc.setDrawColor(214, 180, 95);
  doc.line(20, cursor.value + 2.5, compact ? 48 : 54, cursor.value + 2.5);
  setPdfLabel(doc);
  doc.text("Fechamento financeiro", 20, cursor.value + 7);

  if (!compact) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.8);
    doc.setTextColor(100, 116, 139);
    doc.text("Valor consolidado para esta proposta.", 20, cursor.value + 14.2);
  }

  doc.setDrawColor(214, 180, 95);
  doc.roundedRect(compact ? 112 : 120, cursor.value, compact ? 80 : 72, compact ? 14.5 : 18, 4.5, 4.5, "S");
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(compact ? 113.5 : 121.5, cursor.value + 1.5, compact ? 77 : 69, compact ? 11.5 : 15, 3.5, 3.5, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(compact ? 7.5 : 8.1);
  doc.setTextColor(191, 201, 214);
  doc.text("INVESTIMENTO TOTAL", compact ? 152 : 156, cursor.value + (compact ? 5 : 6), { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(compact ? 13.2 : 14.8);
  doc.setTextColor(255, 255, 255);
  doc.text(formatCurrency(budgetData.total), compact ? 152 : 156, cursor.value + (compact ? 10.6 : 13.5), { align: "center" });
  cursor.value += compact ? 18 : 25;
}

function estimateBudgetFinancialClosureHeight(options = {}) {
  return options.compact ? 22 : 30;
}

function drawBudgetCommercialSection(doc, cursor, budgetData, settings, options = {}) {
  const { compact = false } = options;
  const persuasiveCopy = budgetData.total > 0
    ? "Uma proposta construída para alinhar valor, clareza comercial e a entrega deste momento."
    : "Uma proposta organizada para alinhar tudo com clareza.";
  const persuasiveLines = doc.splitTextToSize(persuasiveCopy, 170).slice(0, compact ? 1 : 3);
  const notesLines = budgetData.notes ? doc.splitTextToSize(budgetData.notes, 170) : [];
  const commerceHeight = (compact ? 13 : 20) + persuasiveLines.length * (compact ? 3.5 : 4.1) + (budgetData.notes && !compact ? 9 + notesLines.length * 4.6 : 0);

  ensureSpace(doc, cursor, commerceHeight + 10, settings);
  if (!compact) {
    drawSectionTitle(doc, cursor, "Condições comerciais");
  }

  doc.setFillColor(247, 248, 252);
  doc.roundedRect(16, cursor.value, 178, commerceHeight, 4, 4, "F");
  drawBudgetInfoCard(doc, 20, cursor.value + 4, 42, compact ? 10.5 : 13, "Validade", `${budgetData.validityDays} dias`, {
    fill: [255, 255, 255],
    accent: [214, 180, 95],
    valueStrong: true,
  });
  drawBudgetInfoCard(doc, 66, cursor.value + 4, 124, compact ? 10.5 : 13, "Pagamento", budgetData.paymentTerms, {
    fill: [255, 255, 255],
    accent: [191, 201, 214],
    valueSize: compact ? 8.6 : 9.1,
  });
  setPdfLabel(doc);
  doc.text("Síntese da proposta", 20, cursor.value + (compact ? 16.5 : 20.5));
  doc.setFont("helvetica", "normal");
  doc.setFontSize(compact ? 8.5 : 8.9);
  doc.setTextColor(55, 65, 81);
  doc.text(persuasiveLines, 20, cursor.value + (compact ? 19.5 : 25.2));

  if (budgetData.notes && !compact) {
    setPdfLabel(doc);
    doc.text("Observações", 20, cursor.value + 28 + persuasiveLines.length * 4.1);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.4);
    doc.setTextColor(55, 65, 81);
    doc.text(notesLines, 20, cursor.value + 32.5 + persuasiveLines.length * 4.1);
  }

  cursor.value += commerceHeight + 4;
}

function estimateBudgetCommercialSectionHeight(doc, budgetData, options = {}) {
  const { compact = false } = options;
  const persuasiveCopy = budgetData.total > 0
    ? "Uma proposta construída para alinhar valor, clareza comercial e a entrega deste momento."
    : "Uma proposta organizada para alinhar tudo com clareza.";
  const persuasiveLines = doc.splitTextToSize(persuasiveCopy, 170).slice(0, compact ? 1 : 3);
  const notesLines = budgetData.notes ? doc.splitTextToSize(budgetData.notes, 170) : [];
  const commerceHeight = (compact ? 13 : 20) + persuasiveLines.length * (compact ? 3.5 : 4.1) + (budgetData.notes && !compact ? 9 + notesLines.length * 4.6 : 0);
  return (compact ? 0 : 8.5) + commerceHeight + 4;
}

function estimateCompanySignatureBlockHeight(settings, options = {}) {
  const { compact = false } = options;
  const hasSignatureImage = Boolean(settings.signatureDataUrl);
  return hasSignatureImage ? (compact ? 32 : 40) : compact ? 22 : 28;
}

function shouldIncludeExtendedScopeOnTail(budgetData) {
  return budgetData.renderedItems.length > 1 && budgetData.remainingWorkLines.length > 0;
}

function _shouldMoveBudgetTailToNextPage(doc, cursor, budgetData, settings) {
  const tailReserve = (shouldIncludeExtendedScopeOnTail(budgetData) ? estimateBudgetExtendedScopeHeight(budgetData, { compact: true }) : 0)
    + estimateBudgetFinancialClosureHeight()
    + estimateBudgetCommercialSectionHeight(doc, budgetData, { compact: true })
    + estimateCompanySignatureBlockHeight(settings, { compact: true });

  return cursor.value + tailReserve > 279;
}

function estimateBudgetSingleItemTailHeight(doc, budgetData, settings) {
  return estimateBudgetFinancialClosureHeight({ compact: true })
    + estimateBudgetCommercialSectionHeight(doc, budgetData, { compact: true })
    + estimateCompanySignatureBlockHeight(settings, { compact: true })
    + 6;
}

function drawBudgetSingleItemPremiumSummary(doc, cursor, budgetData, settings) {
  drawBudgetPremiumTransitionSummary(doc, cursor, budgetData, settings);
}

function _renderBudgetSingleItemPremiumFlow(doc, cursor, budgetData, settings, studioName) {
  const compactItemDescription = true;
  const itemSectionHeight = estimateBudgetItemsSectionHeight(doc, budgetData, { compactDescription: compactItemDescription });
  const compactTailHeight = estimateBudgetSingleItemTailHeight(doc, budgetData, settings);
  const canCloseOnFirstPage = cursor.value + itemSectionHeight + compactTailHeight <= 279;

  if (!canCloseOnFirstPage) {
    drawBudgetSingleItemPremiumSummary(doc, cursor, budgetData, settings);
    doc.addPage();
    cursor.value = 18;
  }

  drawBudgetItemsSection(doc, cursor, budgetData, settings, {
    allowPageBreak: false,
    compactDescription: compactItemDescription,
  });
  drawBudgetFinancialClosure(doc, cursor, budgetData, settings, { compact: true });
  drawBudgetCommercialSection(doc, cursor, budgetData, settings, { compact: true });
  drawCompanySignaturePinned(doc, 252, studioName, settings, { compact: true });
}

export function generateBudgetPDF(record, settings = {}) {
  const doc = new jsPDF();
  const budgetData = prepareBudgetPdfData(record, settings);
  const cursor = { value: 18 };
  drawDocumentHeader(doc, settings, "PROPOSTA COMERCIAL");

  cursor.value = 56;
  drawBudgetSimpleClientSection(doc, cursor, budgetData);
  if (budgetData.renderedItems.length <= 1) {
    drawBudgetSimpleServiceSection(doc, cursor, budgetData, settings);
  } else {
    drawBudgetMultiItemsSection(doc, cursor, budgetData, settings);
  }
  drawBudgetSimpleFinancialSection(doc, cursor, budgetData, settings);
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(doc, settings);
  }
  doc.save(`orcamento-${sanitizeFilePart(budgetData.clientName, "cliente")}.pdf`);
}

export function generateEventPDF(record, settings = {}) {
  const doc = new jsPDF();
  const studioName = drawDocumentHeader(doc, settings, "CONFIRMAÇÃO DE AGENDAMENTO");
  const clientName = record.clientName || "Cliente não informado";
  const eventType = record.eventType || record.packageName || "Serviço não informado";
  const eventDate = record.eventDate ? formatDateBR(record.eventDate) : "A combinar";
  const startTime = record.startTime || "A combinar";
  const endTime = record.endTime || "A combinar";
  const location = record.location || "Local a combinar";
  const amount = Number(record.computedAmount || record.amount || 0);
  const amountPaid = Number(record.amountPaid || 0);
  const serviceSummary = String(fixSentenceSpacing(record.serviceDescriptionSnapshot || record.budgetDescription) || "").trim();
  const notes = String(fixSentenceSpacing(record.notes) || "").trim();
  const deliveryTerms = String(fixSentenceSpacing(record.contractDeliveryTerms) || "").trim();
  const paymentTerms = String(fixSentenceSpacing(record.contractPaymentMethod || settings.paymentTerms) || "").trim();
  const cursor = { value: 56 };
  const eventSummary = [
    eventDate,
    startTime !== "A combinar" ? `${startTime}${endTime !== "A combinar" ? ` às ${endTime}` : ""}` : null,
    location !== "Local a combinar" ? location : null,
  ].filter(Boolean).join("   •   ");

  doc.setFillColor(249, 250, 251);
  doc.roundedRect(16, cursor.value, 178, 30, 4, 4, "F");
  doc.setDrawColor(214, 180, 95);
  doc.line(22, cursor.value + 6, 188, cursor.value + 6);
  doc.setFont("times", "normal");
  doc.setFontSize(16.5);
  doc.setTextColor(31, 41, 55);
  doc.text("CONFIRMAÇÃO DE AGENDAMENTO", 20, cursor.value + 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Documento de apoio com dados principais do compromisso e condições registradas.", 20, cursor.value + 21);
  if (eventSummary) {
    doc.setFontSize(8);
    doc.text(doc.splitTextToSize(eventSummary, 166), 20, cursor.value + 26);
  }
  cursor.value += 38;

  drawSectionTitle(doc, cursor, "Dados do agendamento");

  doc.setFillColor(243, 246, 250);
  doc.roundedRect(16, cursor.value, 56, 18, 3, 3, "F");
  doc.roundedRect(77, cursor.value, 56, 18, 3, 3, "F");
  doc.roundedRect(138, cursor.value, 56, 18, 3, 3, "F");
  setPdfLabel(doc);
  doc.text("Cliente", 20, cursor.value + 6);
  doc.text("Serviço", 81, cursor.value + 6);
  doc.text("Status", 142, cursor.value + 6);
  setPdfBody(doc);
  doc.text(doc.splitTextToSize(clientName, 48), 20, cursor.value + 12);
  doc.text(doc.splitTextToSize(eventType, 48), 81, cursor.value + 12);
  doc.text(doc.splitTextToSize(record.status || "Confirmado", 48), 142, cursor.value + 12);
  cursor.value += 24;

  doc.setFillColor(243, 246, 250);
  doc.roundedRect(16, cursor.value, 56, 20, 3, 3, "F");
  doc.roundedRect(77, cursor.value, 56, 20, 3, 3, "F");
  doc.roundedRect(138, cursor.value, 56, 20, 3, 3, "F");
  setPdfLabel(doc);
  doc.text("Data", 20, cursor.value + 6);
  doc.text("Horário", 81, cursor.value + 6);
  doc.text("Local", 142, cursor.value + 6);
  setPdfBody(doc);
  doc.text(doc.splitTextToSize(eventDate, 48), 20, cursor.value + 12);
  doc.text(doc.splitTextToSize(`${startTime}${endTime !== "A combinar" ? ` às ${endTime}` : ""}`, 48), 81, cursor.value + 12);
  doc.text(doc.splitTextToSize(location, 48), 142, cursor.value + 12);
  cursor.value += 26;

  drawSectionTitle(doc, cursor, "Investimento e entregas");
  doc.setFillColor(243, 246, 250);
  doc.roundedRect(16, cursor.value, 56, 20, 3, 3, "F");
  doc.roundedRect(77, cursor.value, 56, 20, 3, 3, "F");
  doc.roundedRect(138, cursor.value, 56, 20, 3, 3, "F");
  setPdfLabel(doc);
  doc.text("Valor", 20, cursor.value + 6);
  doc.text("Pago", 81, cursor.value + 6);
  doc.text("Entregas", 142, cursor.value + 6);
  setPdfBody(doc);
  doc.text(formatCurrency(amount), 20, cursor.value + 12);
  doc.text(formatCurrency(amountPaid), 81, cursor.value + 12);
  doc.text(
    doc.splitTextToSize(
      [
        record.onlinePhotosCount ? `${record.onlinePhotosCount} online` : null,
        record.editedPhotosCount ? `${record.editedPhotosCount} reveladas` : null,
        record.photoSize || null,
      ].filter(Boolean).join(" • ") || "A combinar",
      48,
    ),
    142,
    cursor.value + 12,
  );
  cursor.value += 28;

  if (serviceSummary) {
    ensureSpace(doc, cursor, 36, settings);
    drawSectionTitle(doc, cursor, "Descrição do serviço");
    const summaryLines = doc.splitTextToSize(serviceSummary, 170);
    const summaryHeight = Math.max(24, summaryLines.length * 5 + 10);
    doc.setFillColor(243, 246, 250);
    doc.roundedRect(16, cursor.value, 178, summaryHeight, 3, 3, "F");
    setPdfBody(doc);
    doc.text(summaryLines, 20, cursor.value + 8);
    cursor.value += summaryHeight + 6;
  }

  if (notes) {
    ensureSpace(doc, cursor, 32, settings);
    drawSectionTitle(doc, cursor, "Observações do atendimento");
    const notesLines = doc.splitTextToSize(notes, 170);
    const notesHeight = Math.max(24, notesLines.length * 5 + 10);
    doc.setFillColor(250, 248, 252);
    doc.roundedRect(16, cursor.value, 178, notesHeight, 3, 3, "F");
    setPdfBody(doc);
    doc.text(notesLines, 20, cursor.value + 8);
    cursor.value += notesHeight + 6;
  }

  ensureSpace(doc, cursor, 30, settings);
  doc.setFillColor(35, 27, 53);
  doc.roundedRect(16, cursor.value, 178, 22, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(214, 180, 95);
  doc.text("RESUMO FINANCEIRO", 105, cursor.value + 7, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15.5);
  doc.setTextColor(255, 255, 255);
  doc.text(formatCurrency(amount), 105, cursor.value + 16, { align: "center" });
  cursor.value += 28;

  ensureSpace(doc, cursor, 42, settings);
  drawSectionTitle(doc, cursor, "Condições combinadas");
  doc.setFillColor(243, 246, 250);
  doc.roundedRect(16, cursor.value, 178, 28, 3, 3, "F");
  setPdfLabel(doc);
  doc.text("Pagamento", 20, cursor.value + 6);
  doc.text("Entrega", 108, cursor.value + 6);
  setPdfBody(doc);
  doc.text(doc.splitTextToSize(paymentTerms || "A combinar.", 78), 20, cursor.value + 12);
  doc.text(doc.splitTextToSize(deliveryTerms || "A combinar.", 78), 108, cursor.value + 12);
  cursor.value += 30;

  ensureSpace(doc, cursor, 16, settings);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.8);
  doc.setTextColor(100, 116, 139);
  doc.text("Este documento resume o agendamento e pode acompanhar o atendimento comercial do estúdio.", 105, cursor.value, { align: "center" });
  cursor.value += 6;

  drawCompanySignatureBlock(doc, cursor, studioName, settings);
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(doc, settings);
  }
  doc.save(`agenda-${sanitizeFilePart(clientName, "cliente")}.pdf`);
}

export function generateContractPDF(record, settings = {}, previewText = "") {
  const doc = new jsPDF();
  const studioName = drawDocumentHeader(doc, settings, "CONTRATO DE PRESTAÇÃO DE SERVIÇOS");
  const clientName = record.clientName || "Cliente não informado";
  const contractCity = toContractCityTitleCase(settings.contractCity || settings.studioCity || settings.contractForum);
  const contractForum = toContractCityTitleCase(settings.contractForum || contractCity, contractCity);
  const contractText = normalizeContractTextForPdf(
    String(previewText || "").trim() || "Defina um texto base de contrato para gerar este documento.",
    record,
    settings,
    contractCity,
    contractForum,
  );
  const cursor = { value: 56 };
  const signatureClosingHeight = settings.signatureDataUrl ? 44 : 32;

  drawContractPaperFrame(doc, cursor);
  cursor.value += 16;
  doc.setFont("times", "normal");
  doc.setFontSize(17);
  doc.setTextColor(31, 41, 55);
  doc.text("CONTRATO DE PRESTAÇÃO DE SERVIÇOS FOTOGRÁFICOS", 28, cursor.value);
  cursor.value += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.4);
  doc.setTextColor(100, 116, 139);
  doc.text("Instrumento particular entre as partes, com condições comerciais e jurídicas registradas.", 28, cursor.value);
  cursor.value += 10;
  renderContractBody(doc, cursor, contractText, settings);

  ensureContractPageSpace(doc, cursor, signatureClosingHeight, settings, { bottom: 276 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.3);
  doc.setTextColor(71, 85, 105);
  doc.text(`${contractCity}, ${formatDateBR(getTodayLocalISO())}.`, 28, cursor.value);
  cursor.value += 5;
  doc.setFontSize(8.7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Foro eleito: ${contractForum}.`, 28, cursor.value);
  cursor.value += 5.5;
  doc.setDrawColor(214, 180, 95);
  doc.line(28, cursor.value, 98, cursor.value);
  cursor.value += 5.5;

  drawContractSignatureBlock(doc, cursor, clientName, studioName, settings);
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(doc, settings);
  }
  doc.save(`contrato-${sanitizeFilePart(clientName, "cliente")}.pdf`);
}

export function generateReceiptPDF(record, settings = {}) {
  const doc = new jsPDF();
  const studioName = drawDocumentHeader(doc, settings, "RECIBO DE PAGAMENTO");
  const clientName = record.clientName || "Cliente não informado";
  const previewText = buildReceiptPreview(record, settings);
  const cursor = { value: 56 };

  drawSectionTitle(doc, cursor, "Dados do pagamento");

  doc.setFillColor(243, 246, 250);
  doc.roundedRect(16, cursor.value, 56, 18, 3, 3, "F");
  doc.roundedRect(77, cursor.value, 56, 18, 3, 3, "F");
  doc.roundedRect(138, cursor.value, 56, 18, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Cliente", 20, cursor.value + 6);
  doc.text("Valor recebido", 81, cursor.value + 6);
  doc.text("Saldo restante", 142, cursor.value + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(doc.splitTextToSize(clientName, 48), 20, cursor.value + 12);
  doc.text(formatCurrency(record.amountPaid || 0), 81, cursor.value + 12);
  doc.text(formatCurrency(record.balance || 0), 142, cursor.value + 12);
  cursor.value += 24;

  doc.setFillColor(243, 246, 250);
  doc.roundedRect(16, cursor.value, 86, 22, 3, 3, "F");
  doc.roundedRect(108, cursor.value, 86, 22, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Serviço", 20, cursor.value + 6);
  doc.text("Recebimento", 112, cursor.value + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(doc.splitTextToSize(record.eventType || record.packageName || "-", 78), 20, cursor.value + 12);
  doc.text(
    doc.splitTextToSize(
      [
        `Data: ${record.receiptDate ? formatDateBR(record.receiptDate) : formatDateBR(getTodayLocalISO())}`,
        `Forma: ${record.receiptMethod || "-"}`,
      ].join("\n"),
      78,
    ),
    112,
    cursor.value + 12,
  );
  cursor.value += 28;

  drawSectionTitle(doc, cursor, "Declaração");
  const previewLines = doc.splitTextToSize(previewText, 170);
  const previewHeight = Math.max(42, previewLines.length * 5 + 10);
  doc.setFillColor(243, 246, 250);
  doc.roundedRect(16, cursor.value, 178, previewHeight, 3, 3, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.2);
  doc.setTextColor(31, 41, 55);
  doc.text(previewLines, 20, cursor.value + 8);
  cursor.value += previewHeight + 8;

  drawCompanySignatureBlock(doc, cursor, studioName, settings, { caption: "Assinatura do recebedor" });
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(doc, settings);
  }
  doc.save(`recibo-${sanitizeFilePart(clientName, "cliente")}.pdf`);
}
