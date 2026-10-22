import jsPDF from "jspdf";
import { formatCurrency, formatDateBR, getItemsTotal, getTodayLocalISO, normalizeItems } from "./formatters";

// ---------------------------------------------------------------------------
// Identidade visual compartilhada pelos PDFs (orçamento, recibo, contrato, agenda)
// ---------------------------------------------------------------------------

export const PDF_COLORS = {
  ink: [17, 24, 39],
  text: [51, 65, 85],
  muted: [100, 116, 139],
  faint: [148, 163, 184],
  line: [226, 232, 240],
  soft: [248, 250, 252],
  navy: [23, 27, 38],
  gold: [196, 160, 80],
  goldSoft: [253, 248, 236],
  green: [21, 128, 61],
  greenSoft: [240, 253, 244],
};

const PAGE = { width: 210, height: 297, marginX: 16, contentWidth: 178, footerTop: 281, bodyBottom: 272 };

function setColor(doc, kind, rgb) {
  if (kind === "text") doc.setTextColor(...rgb);
  if (kind === "fill") doc.setFillColor(...rgb);
  if (kind === "draw") doc.setDrawColor(...rgb);
}

function getImageFormat(dataUrl = "") {
  return /^data:image\/jpe?g/i.test(dataUrl) ? "JPEG" : "PNG";
}

function getImageRatio(doc, dataUrl) {
  try {
    const props = doc.getImageProperties(dataUrl);
    if (props?.width && props?.height) return props.width / props.height;
  } catch {
    // ignora e usa proporção padrão
  }
  return 1;
}

/** Adiciona imagem com compressão; nunca derruba o PDF se a imagem for inválida. */
export function addPdfImage(doc, dataUrl, x, y, w, h, alias) {
  if (!dataUrl) return false;
  try {
    doc.addImage(dataUrl, getImageFormat(dataUrl), x, y, w, h, alias, "FAST");
    return true;
  } catch {
    return false;
  }
}

/** Desenha imagem cabendo numa caixa, mantendo a proporção. */
export function addPdfImageFit(doc, dataUrl, x, y, maxW, maxH, alias, align = "left") {
  if (!dataUrl) return null;
  const ratio = getImageRatio(doc, dataUrl);
  let w = maxW;
  let h = w / ratio;
  if (h > maxH) {
    h = maxH;
    w = h * ratio;
  }
  const drawX = align === "center" ? x + (maxW - w) / 2 : align === "right" ? x + maxW - w : x;
  return addPdfImage(doc, dataUrl, drawX, y + (maxH - h), w, h, alias) ? { w, h, x: drawX } : null;
}

/**
 * Reduz logo e assinatura antes de gerar PDFs (no navegador).
 * Um logo de 1.500–5.000 px virava 9–95 MB dentro do PDF; reduzido fica com poucos KB.
 */
export async function preparePdfImages(settings = {}) {
  if (typeof document === "undefined" || typeof Image === "undefined") return settings;

  const shrink = (dataUrl, maxSide) =>
    new Promise((resolve) => {
      if (!dataUrl || !String(dataUrl).startsWith("data:image")) {
        resolve(dataUrl);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        if (scale >= 1 && dataUrl.length < 400000) {
          resolve(dataUrl);
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        try {
          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });

  const [logoDataUrl, signatureDataUrl] = await Promise.all([
    shrink(settings.logoDataUrl, 600),
    shrink(settings.signatureDataUrl, 900),
  ]);

  return { ...settings, logoDataUrl, signatureDataUrl };
}

/** Cabeçalho completo (1ª página) ou compacto (páginas seguintes). Retorna o nome do estúdio. */
export function drawPdfHeader(doc, settings = {}, subtitle = "", options = {}) {
  const { compact = false } = options;
  const studioName = settings.studioName || "Emerson Honorato Retratos";

  if (compact) {
    setColor(doc, "fill", PDF_COLORS.navy);
    doc.rect(0, 0, PAGE.width, 20, "F");
    let textX = PAGE.marginX;
    if (settings.logoDataUrl) {
      setColor(doc, "fill", [255, 255, 255]);
      doc.circle(PAGE.marginX + 6, 10, 6.4, "F");
      addPdfImage(doc, settings.logoDataUrl, PAGE.marginX + 1.2, 5.2, 9.6, 9.6, "studio-logo");
      textX = PAGE.marginX + 16;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    setColor(doc, "text", [255, 255, 255]);
    doc.text(studioName, textX, 11.6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    setColor(doc, "text", [180, 188, 204]);
    doc.text(String(subtitle).toUpperCase(), PAGE.width - PAGE.marginX, 11.6, { align: "right" });
    return studioName;
  }

  const contacts = [settings.studioPhone, settings.studioEmail, settings.studioInstagram, settings.studioCity]
    .filter((value) => String(value || "").trim())
    .join("   •   ");

  setColor(doc, "fill", PDF_COLORS.navy);
  doc.rect(0, 0, PAGE.width, 42, "F");
  setColor(doc, "fill", PDF_COLORS.gold);
  doc.rect(0, 42, PAGE.width, 0.9, "F");

  let textX = PAGE.marginX;
  if (settings.logoDataUrl) {
    // Selo branco atrás do logo: logos escuros ficavam invisíveis no fundo escuro.
    setColor(doc, "fill", [255, 255, 255]);
    doc.circle(PAGE.marginX + 13, 21, 13, "F");
    addPdfImage(doc, settings.logoDataUrl, PAGE.marginX + 2.5, 10.5, 21, 21, "studio-logo");
    textX = PAGE.marginX + 32;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  setColor(doc, "text", [255, 255, 255]);
  doc.text(studioName, textX, 18.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setColor(doc, "text", PDF_COLORS.gold);
  if (typeof doc.setCharSpace === "function") doc.setCharSpace(0.9);
  doc.text(String(subtitle).toUpperCase(), textX, 26);
  if (typeof doc.setCharSpace === "function") doc.setCharSpace(0);

  if (contacts) {
    doc.setFontSize(8);
    setColor(doc, "text", [180, 188, 204]);
    doc.text(doc.splitTextToSize(contacts, PAGE.width - textX - PAGE.marginX)[0], textX, 33.5);
  }

  return studioName;
}

/** Rodapé com mensagem, referência do documento e "Página X de Y". Chamar depois de montar todas as páginas. */
export function drawPdfFooters(doc, settings = {}, reference = "") {
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    setColor(doc, "draw", PDF_COLORS.line);
    doc.setLineWidth(0.3);
    doc.line(PAGE.marginX, PAGE.footerTop, PAGE.width - PAGE.marginX, PAGE.footerTop);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    setColor(doc, "text", PDF_COLORS.faint);
    const left = [settings.pdfFooter || "Obrigado pela oportunidade.", reference].filter(Boolean).join("   •   ");
    doc.text(doc.splitTextToSize(left, 140)[0], PAGE.marginX, PAGE.footerTop + 5.5);
    doc.text(`Página ${page} de ${total}`, PAGE.width - PAGE.marginX, PAGE.footerTop + 5.5, { align: "right" });
  }
}

// ---------------------------------------------------------------------------
// Utilidades de texto
// ---------------------------------------------------------------------------

function clean(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ ([.,;:!?])/g, "$1")
    .trim();
}

function has(value) {
  const text = clean(value).toLowerCase();
  return Boolean(text) && !["-", "a definir", "não informado", "nao informado", "a combinar"].includes(text);
}

function sanitizeFilePart(value, fallback) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return normalized || fallback;
}

function shortCode(record = {}) {
  const raw = String(record.id || "").replace(/[^a-zA-Z0-9]/g, "");
  return (raw.slice(-5) || "00000").toUpperCase();
}

function isoFromDateLike(value) {
  if (!value) return "";
  const date = new Date(String(value).includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDaysISO(iso, days) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + Number(days || 0));
  return isoFromDateLike(date.toISOString());
}

function formatTaxId(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (digits.length === 14) return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return clean(value);
}

function formatPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return clean(value);
}

/** Separa um texto livre em parágrafos e listas (linhas iniciadas por -, *, •). */
function parseRichText(text) {
  const blocks = [];
  clean(text)
    .split("\n")
    .map((line) => line.trim())
    .forEach((line) => {
      if (!line) {
        blocks.push({ type: "gap" });
        return;
      }
      const bullet = line.match(/^[-*•–]\s*(.+)$/);
      if (bullet) blocks.push({ type: "bullet", text: bullet[1].trim() });
      else blocks.push({ type: "para", text: line });
    });
  return blocks;
}

const UNITS = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const TENS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const HUNDREDS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function hundredsToWords(n) {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const parts = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) parts.push(HUNDREDS[h]);
  if (rest) {
    if (rest < 20) parts.push(UNITS[rest]);
    else {
      const t = Math.floor(rest / 10);
      const u = rest % 10;
      parts.push(u ? `${TENS[t]} e ${UNITS[u]}` : TENS[t]);
    }
  }
  return parts.join(" e ");
}

function integerToWords(n) {
  if (n === 0) return "zero";
  const groups = [
    { value: 1e9, singular: "bilhão", plural: "bilhões" },
    { value: 1e6, singular: "milhão", plural: "milhões" },
    { value: 1e3, singular: "mil", plural: "mil" },
  ];
  const parts = [];
  let rest = n;
  groups.forEach(({ value, singular, plural }) => {
    const amount = Math.floor(rest / value);
    if (amount) {
      parts.push(value === 1e3 && amount === 1 ? "mil" : `${hundredsToWords(amount)} ${amount === 1 ? singular : plural}`);
      rest %= value;
    }
  });
  if (rest) parts.push(hundredsToWords(rest));
  if (parts.length > 1) {
    const last = n % 1000;
    const joiner = last > 0 && (last < 100 || last % 100 === 0) ? " e " : " ";
    return parts.slice(0, -1).join(" ") + joiner + parts[parts.length - 1];
  }
  return parts[0];
}

/** 1234,5 -> "mil duzentos e trinta e quatro reais e cinquenta centavos" */
export function currencyToWordsBR(value) {
  const cents = Math.round(Math.abs(Number(value || 0)) * 100);
  const reais = Math.floor(cents / 100);
  const centavos = cents % 100;
  const parts = [];
  if (reais > 0) {
    const big = reais >= 1e6 && reais % 1e6 === 0;
    parts.push(`${integerToWords(reais)}${big ? " de" : ""} ${reais === 1 ? "real" : "reais"}`);
  }
  if (centavos > 0) parts.push(`${integerToWords(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  return parts.length ? parts.join(" e ") : "zero real";
}

// ---------------------------------------------------------------------------
// Blocos de layout
// ---------------------------------------------------------------------------

function createLayout(doc, settings, subtitle) {
  const state = { y: 52 };
  const ensure = (height) => {
    if (state.y + height <= PAGE.bodyBottom) return false;
    doc.addPage();
    drawPdfHeader(doc, settings, subtitle, { compact: true });
    state.y = 30;
    return true;
  };
  return { state, ensure };
}

function sectionTitle(doc, layout, title) {
  layout.ensure(16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.4);
  setColor(doc, "text", PDF_COLORS.gold);
  if (typeof doc.setCharSpace === "function") doc.setCharSpace(0.6);
  doc.text(String(title).toUpperCase(), PAGE.marginX, layout.state.y);
  if (typeof doc.setCharSpace === "function") doc.setCharSpace(0);
  setColor(doc, "draw", PDF_COLORS.line);
  doc.setLineWidth(0.3);
  doc.line(PAGE.marginX, layout.state.y + 2.2, PAGE.width - PAGE.marginX, layout.state.y + 2.2);
  layout.state.y += 7.2;
}

/** Linha de campos rotulados (ex.: Nº / Emissão / Válida até). */
function fieldRow(doc, layout, fields, options = {}) {
  const { fill = PDF_COLORS.soft, height = 15, gap = 4 } = options;
  const visible = fields.filter(Boolean);
  if (!visible.length) return;
  const width = (PAGE.contentWidth - gap * (visible.length - 1)) / visible.length;
  const valueLines = visible.map((field) => {
    doc.setFont("helvetica", field.strong === false ? "normal" : "bold");
    doc.setFontSize(field.size || 10);
    return doc.splitTextToSize(String(field.value || "-"), width - 8).slice(0, 3);
  });
  const rowHeight = Math.max(height, ...valueLines.map((lines) => 10 + lines.length * 4.6));
  layout.ensure(rowHeight + 3);

  visible.forEach((field, index) => {
    const x = PAGE.marginX + index * (width + gap);
    setColor(doc, "fill", field.fill || fill);
    doc.roundedRect(x, layout.state.y, width, rowHeight, 2.5, 2.5, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.4);
    setColor(doc, "text", field.labelColor || PDF_COLORS.muted);
    doc.text(String(field.label).toUpperCase(), x + 4, layout.state.y + 5.6);
    doc.setFont("helvetica", field.strong === false ? "normal" : "bold");
    doc.setFontSize(field.size || 10);
    setColor(doc, "text", field.color || PDF_COLORS.ink);
    doc.text(valueLines[index], x + 4, layout.state.y + 11);
  });
  layout.state.y += rowHeight + 3;
}

function richText(doc, layout, text, options = {}) {
  const { size = 10, color = PDF_COLORS.text, lineHeight = 4.9, x = PAGE.marginX, width = PAGE.contentWidth } = options;
  const blocks = parseRichText(text);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  setColor(doc, "text", color);

  blocks.forEach((block, index) => {
    if (block.type === "gap") {
      if (index > 0 && blocks[index - 1].type !== "gap") layout.state.y += 2;
      return;
    }
    const indent = block.type === "bullet" ? 5 : 0;
    const lines = doc.splitTextToSize(block.text, width - indent);
    lines.forEach((line, lineIndex) => {
      if (layout.ensure(lineHeight)) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(size);
        setColor(doc, "text", color);
      }
      if (block.type === "bullet" && lineIndex === 0) {
        setColor(doc, "text", PDF_COLORS.gold);
        doc.text("•", x + 0.6, layout.state.y);
        setColor(doc, "text", color);
      }
      doc.text(line, x + indent, layout.state.y);
      layout.state.y += lineHeight;
    });
    layout.state.y += 1.2;
  });
}

function labeledParagraph(doc, layout, label, text, options = {}) {
  const { x = PAGE.marginX, width = PAGE.contentWidth } = options;
  if (!has(text)) return;
  layout.ensure(14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.6);
  setColor(doc, "text", PDF_COLORS.ink);
  doc.text(label, x, layout.state.y);
  layout.state.y += 4.6;
  richText(doc, layout, text, { size: 9.4, lineHeight: 4.5, x, width });
  layout.state.y += 1.6;
}

function measureLabeledParagraphs(doc, entries, width) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.4);
  return entries
    .filter(([, text]) => has(text))
    .reduce((sum, [, text]) => {
      const lines = parseRichText(text).reduce((count, block) => (block.type === "gap" ? count : count + doc.splitTextToSize(block.text, width - 5).length), 0);
      return sum + 4.6 + lines * 4.5 + 2.8;
    }, 0);
}

function itemsTable(doc, layout, items) {
  const col = { name: PAGE.marginX + 4, qty: 128, unit: 158, total: PAGE.width - PAGE.marginX - 4 };
  const drawHead = () => {
    setColor(doc, "fill", PDF_COLORS.navy);
    doc.roundedRect(PAGE.marginX, layout.state.y, PAGE.contentWidth, 8, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.6);
    setColor(doc, "text", [255, 255, 255]);
    doc.text("ITEM", col.name, layout.state.y + 5.3);
    doc.text("QTD", col.qty, layout.state.y + 5.3, { align: "center" });
    doc.text("VALOR UNIT.", col.unit, layout.state.y + 5.3, { align: "right" });
    doc.text("TOTAL", col.total, layout.state.y + 5.3, { align: "right" });
    layout.state.y += 8;
  };

  layout.ensure(24);
  drawHead();

  items.forEach((item, index) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.6);
    const nameLines = doc.splitTextToSize(clean(item.name) || `Item ${index + 1}`, 100);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.4);
    const descText = clean(item.description);
    const descLines = has(descText) && descText !== clean(item.name) ? doc.splitTextToSize(descText.replace(/\n+/g, " "), 104).slice(0, 4) : [];
    const rowHeight = 5 + nameLines.length * 4.4 + descLines.length * 3.9 + 3;

    if (layout.ensure(rowHeight)) drawHead();

    if (index % 2 === 1) {
      setColor(doc, "fill", PDF_COLORS.soft);
      doc.rect(PAGE.marginX, layout.state.y, PAGE.contentWidth, rowHeight, "F");
    }

    let y = layout.state.y + 5.6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.6);
    setColor(doc, "text", PDF_COLORS.ink);
    doc.text(nameLines, col.name, y);
    const quantity = Number(item.quantity || 1);
    const unitPrice = Number(item.unitPrice || 0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.2);
    setColor(doc, "text", PDF_COLORS.text);
    doc.text(String(quantity).replace(".", ","), col.qty, y, { align: "center" });
    doc.text(formatCurrency(unitPrice), col.unit, y, { align: "right" });
    doc.setFont("helvetica", "bold");
    setColor(doc, "text", PDF_COLORS.ink);
    doc.text(formatCurrency(quantity * unitPrice), col.total, y, { align: "right" });

    y += nameLines.length * 4.4 - 0.4;
    if (descLines.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.4);
      setColor(doc, "text", PDF_COLORS.muted);
      doc.text(descLines, col.name, y);
    }

    layout.state.y += rowHeight;
    setColor(doc, "draw", PDF_COLORS.line);
    doc.setLineWidth(0.25);
    doc.line(PAGE.marginX, layout.state.y, PAGE.width - PAGE.marginX, layout.state.y);
  });
  layout.state.y += 4;
}

function totalBox(doc, layout, label, value, caption = "", options = {}) {
  const { advance = true } = options;
  const height = caption ? 21 : 17;
  if (advance) layout.ensure(height + 4);
  const width = 82;
  const x = PAGE.width - PAGE.marginX - width;
  setColor(doc, "fill", PDF_COLORS.navy);
  doc.roundedRect(x, layout.state.y, width, height, 3, 3, "F");
  setColor(doc, "fill", PDF_COLORS.gold);
  doc.rect(x + 6, layout.state.y, width - 12, 0.8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.6);
  setColor(doc, "text", PDF_COLORS.gold);
  doc.text(String(label).toUpperCase(), x + 6, layout.state.y + 6.5);
  doc.setFontSize(16);
  setColor(doc, "text", [255, 255, 255]);
  doc.text(value, x + width - 6, layout.state.y + 13.2, { align: "right" });
  if (caption) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.4);
    setColor(doc, "text", [180, 188, 204]);
    doc.text(doc.splitTextToSize(caption, width - 12)[0], x + width - 6, layout.state.y + 18, { align: "right" });
  }
  if (advance) layout.state.y += height + 6;
  return height;
}

function calloutBox(doc, layout, title, text, options = {}) {
  const { fill = PDF_COLORS.goldSoft, accent = PDF_COLORS.gold } = options;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.4);
  const lines = doc.splitTextToSize(text, PAGE.contentWidth - 14);
  const height = 11 + lines.length * 4.6;
  layout.ensure(height + 4);
  setColor(doc, "fill", fill);
  doc.roundedRect(PAGE.marginX, layout.state.y, PAGE.contentWidth, height, 3, 3, "F");
  setColor(doc, "fill", accent);
  doc.roundedRect(PAGE.marginX, layout.state.y, 1.6, height, 0.8, 0.8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.2);
  setColor(doc, "text", PDF_COLORS.ink);
  doc.text(title, PAGE.marginX + 7, layout.state.y + 6.8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.4);
  setColor(doc, "text", PDF_COLORS.text);
  doc.text(lines, PAGE.marginX + 7, layout.state.y + 12);
  layout.state.y += height + 6;
}

function signatureBlock(doc, layout, settings, name, caption, options = {}) {
  const { x = 60, width = 90, documentLine = "", compact = false, skipEnsure = false } = options;
  const imageHeight = settings.signatureDataUrl ? (compact ? 12 : 16) : 0;
  if (!skipEnsure) layout.ensure(imageHeight + 22);
  if (settings.signatureDataUrl) {
    addPdfImageFit(doc, settings.signatureDataUrl, x + 10, layout.state.y, width - 20, imageHeight, "studio-signature", "center");
  }
  layout.state.y += imageHeight + (settings.signatureDataUrl ? 1 : 12);
  setColor(doc, "draw", PDF_COLORS.faint);
  doc.setLineWidth(0.3);
  doc.line(x, layout.state.y, x + width, layout.state.y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.2);
  setColor(doc, "text", PDF_COLORS.ink);
  doc.text(name, x + width / 2, layout.state.y + 5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  setColor(doc, "text", PDF_COLORS.muted);
  doc.text([caption, documentLine].filter(Boolean), x + width / 2, layout.state.y + 9.2, { align: "center" });
  layout.state.y += documentLine ? 16 : 12;
}

// ---------------------------------------------------------------------------
// ORÇAMENTO
// ---------------------------------------------------------------------------

function buildBudgetItems(record) {
  const items = normalizeItems(record.items || []).map((item, index) => {
    const source = Array.isArray(record.items) ? record.items[index] || {} : {};
    return { ...item, description: clean(source.description || item.description || "") };
  });
  if (items.length) return items;
  const amount = Number(record.computedAmount || record.amount || 0);
  return [{ id: "single", name: record.packageName || record.eventType || "Serviço fotográfico", description: "", quantity: 1, unitPrice: amount }];
}

export function generateBudgetPDF(record = {}, settings = {}) {
  const doc = new jsPDF();
  const subtitle = "Proposta comercial";
  const studioName = drawPdfHeader(doc, settings, subtitle);
  const layout = createLayout(doc, settings, subtitle);

  const items = buildBudgetItems(record);
  const total = getItemsTotal(items) || Number(record.computedAmount || record.amount || 0);
  const validityDays = Number(record.budgetValidityDays || settings.budgetValidityDays || 7);
  const issueISO = isoFromDateLike(record.budgetSentAt) || getTodayLocalISO();
  const validUntilISO = addDaysISO(issueISO, validityDays);
  const number = clean(record.budgetNumber) || `ORC-${issueISO.slice(0, 4)}-${shortCode(record)}`;
  const clientName = clean(record.clientName) || "Cliente";
  const timeRange = [record.startTime, record.endTime].filter(has).join(" às ");

  // Identificação da proposta
  fieldRow(doc, layout, [
    { label: "Proposta nº", value: number, size: 9.6 },
    { label: "Emitida em", value: formatDateBR(issueISO), size: 9.6 },
    { label: "Válida até", value: formatDateBR(validUntilISO), size: 9.6, fill: PDF_COLORS.goldSoft, labelColor: [146, 108, 33] },
  ]);
  layout.state.y += 4;

  // Cliente e evento
  sectionTitle(doc, layout, "Para");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  setColor(doc, "text", PDF_COLORS.ink);
  doc.text(doc.splitTextToSize(clientName, PAGE.contentWidth), PAGE.marginX, layout.state.y + 1);
  layout.state.y += 6;
  const contact = [formatPhone(record.whatsapp || record.phone), clean(record.email)].filter(has).join("   •   ");
  if (contact) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setColor(doc, "text", PDF_COLORS.muted);
    doc.text(contact, PAGE.marginX, layout.state.y);
    layout.state.y += 5;
  }
  layout.state.y += 2;

  fieldRow(doc, layout, [
    { label: "Serviço", value: clean(record.eventType || record.packageName) || "Serviço fotográfico" },
    { label: "Data", value: has(record.eventDate) ? formatDateBR(record.eventDate) : "A combinar", strong: has(record.eventDate) },
    { label: "Horário", value: timeRange || "A combinar", strong: Boolean(timeRange) },
    { label: "Local", value: has(record.location) ? clean(record.location) : "A combinar", strong: has(record.location) },
  ], { height: 14 });
  layout.state.y += 3;

  // Descrição
  const description = clean(record.budgetDescription || record.serviceDescriptionSnapshot);
  if (has(description)) {
    sectionTitle(doc, layout, "Sobre o serviço");
    richText(doc, layout, description);
    layout.state.y += 2;
  }

  const scope = clean(record.serviceItemsSnapshot);
  if (has(scope) && scope !== description) {
    sectionTitle(doc, layout, "O que está incluso");
    const scopeText = parseRichText(scope).some((block) => block.type === "bullet")
      ? scope
      : scope.split(/\n+/).map((line) => `- ${line}`).join("\n");
    richText(doc, layout, scopeText);
    layout.state.y += 2;
  }

  const deliveries = [
    Number(record.editedPhotosCount) ? `${record.editedPhotosCount} fotos tratadas` : "",
    Number(record.onlinePhotosCount) && Number(record.onlinePhotosCount) !== Number(record.editedPhotosCount)
      ? `${record.onlinePhotosCount} fotos digitais`
      : "",
    has(record.photoSize) ? `tamanho ${clean(record.photoSize)}` : "",
  ].filter(Boolean).join(" • ");

  // Investimento
  sectionTitle(doc, layout, "Investimento");
  itemsTable(doc, layout, items);

  // Condições (esquerda) + total (direita), lado a lado para economizar página
  const paymentTerms = clean(record.contractPaymentMethod || settings.paymentTerms);
  const deliveryTerms = clean(record.contractDeliveryTerms);
  const notes = clean(record.notes);
  const deliveryText = [deliveries, deliveryTerms].filter(has).join("\n");
  const conditions = [["Forma de pagamento", paymentTerms], ["Entrega", deliveryText], ["Observações", notes]];
  const leftWidth = PAGE.contentWidth - 82 - 8;
  const conditionsHeight = measureLabeledParagraphs(doc, conditions, leftWidth);
  const signatureHeight = settings.signatureDataUrl ? 27 : 26;
  layout.ensure(Math.max(conditionsHeight + 6, 17 + 8 + signatureHeight));
  const zoneTop = layout.state.y;
  const boxHeight = totalBox(doc, layout, "Investimento total", formatCurrency(total), "", { advance: false });
  layout.state.y = zoneTop + boxHeight + 8;
  signatureBlock(doc, layout, settings, clean(settings.studioResponsible) || studioName, studioName, {
    compact: true,
    x: PAGE.width - PAGE.marginX - 82,
    width: 82,
    skipEnsure: true,
  });
  const rightEnd = layout.state.y;
  layout.state.y = zoneTop + 3.4;
  conditions.forEach(([label, text]) => labeledParagraph(doc, layout, label, text, { width: leftWidth }));
  layout.state.y = Math.max(layout.state.y, rightEnd) + 2;

  // Como confirmar
  const channels = [
    has(settings.studioPhone) ? `WhatsApp ${formatPhone(settings.studioPhone)}` : "WhatsApp",
    has(settings.studioEmail) ? `e-mail ${clean(settings.studioEmail)}` : "",
  ].filter(Boolean).join(" ou ");
  calloutBox(
    doc,
    layout,
    "Como confirmar",
    `Para garantir a data, basta responder esta proposta pelo ${channels}. A reserva é confirmada com o pagamento do sinal. Esta proposta é válida até ${formatDateBR(validUntilISO)}; depois disso, valores e disponibilidade podem mudar.`,
  );


  drawPdfFooters(doc, settings, `Proposta ${number}`);
  doc.save(`orcamento-${sanitizeFilePart(clientName, "cliente")}.pdf`);
}

// ---------------------------------------------------------------------------
// RECIBO
// ---------------------------------------------------------------------------

export function generateReceiptPDF(record = {}, settings = {}) {
  const doc = new jsPDF();
  const subtitle = "Recibo de pagamento";
  const studioName = drawPdfHeader(doc, settings, subtitle);
  const layout = createLayout(doc, settings, subtitle);

  const clientName = clean(record.clientName) || "Cliente";
  const received = Number(record.amountPaid || 0);
  const totalService = Number(record.computedAmount || record.amount || 0);
  const balance = Math.max(Number(record.balance ?? totalService - received) || 0, 0);
  const receiptISO = isoFromDateLike(record.receiptDate) || getTodayLocalISO();
  const number = `REC-${receiptISO.slice(0, 4)}-${shortCode(record)}`;
  const method = clean(record.receiptMethod);
  const reference = clean(record.receiptReference);
  const service = clean(record.eventType || record.packageName) || "serviço fotográfico";
  const city = clean(settings.contractCity || settings.studioCity);

  fieldRow(doc, layout, [
    { label: "Recibo nº", value: number, size: 9.6 },
    { label: "Data do recebimento", value: formatDateBR(receiptISO), size: 9.6 },
    { label: "Forma de pagamento", value: has(method) ? method : "Não informada", size: 9.6, strong: has(method) },
  ]);
  layout.state.y += 6;

  // Valor em destaque
  layout.ensure(30);
  setColor(doc, "fill", PDF_COLORS.navy);
  doc.roundedRect(PAGE.marginX, layout.state.y, PAGE.contentWidth, 26, 3, 3, "F");
  setColor(doc, "fill", PDF_COLORS.gold);
  doc.rect(PAGE.marginX + 8, layout.state.y, PAGE.contentWidth - 16, 0.8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  setColor(doc, "text", PDF_COLORS.gold);
  doc.text("VALOR RECEBIDO", PAGE.marginX + 8, layout.state.y + 8);
  doc.setFontSize(20);
  setColor(doc, "text", [255, 255, 255]);
  doc.text(formatCurrency(received), PAGE.marginX + 8, layout.state.y + 17.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.6);
  setColor(doc, "text", [180, 188, 204]);
  const words = `(${currencyToWordsBR(received)})`;
  doc.text(doc.splitTextToSize(words, 92), PAGE.width - PAGE.marginX - 8, layout.state.y + 13, { align: "right" });
  layout.state.y += 34;

  // Declaração
  sectionTitle(doc, layout, "Declaração");
  const cpf = has(record.clientCpf) ? `, CPF/CNPJ ${formatTaxId(record.clientCpf)},` : "";
  const eventPart = has(record.eventDate) ? `, com data em ${formatDateBR(record.eventDate)}` : "";
  const referencePart = has(reference) ? ` (${reference.replace(/[.]$/, "")})` : "";
  const declaration =
    `Declaro que recebi de ${clientName}${cpf} a importância de ${formatCurrency(received)} (${currencyToWordsBR(received)}), ` +
    `referente ao serviço de ${service}${eventPart}${referencePart}, dando por este recibo a devida quitação do valor recebido.`;
  richText(doc, layout, declaration, { size: 10.4, lineHeight: 5.4, color: PDF_COLORS.ink });
  layout.state.y += 4;

  // Resumo financeiro
  sectionTitle(doc, layout, "Resumo do serviço");
  fieldRow(doc, layout, [
    { label: "Valor total do serviço", value: formatCurrency(totalService) },
    { label: "Total pago até agora", value: formatCurrency(received) },
    balance > 0
      ? { label: "Saldo restante", value: formatCurrency(balance), fill: PDF_COLORS.goldSoft, labelColor: [146, 108, 33] }
      : { label: "Situação", value: "Quitado", fill: PDF_COLORS.greenSoft, labelColor: PDF_COLORS.green, color: PDF_COLORS.green },
  ]);
  layout.state.y += 10;

  // Local, data e assinatura
  layout.ensure(48);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.6);
  setColor(doc, "text", PDF_COLORS.text);
  doc.text(`${city ? `${city}, ` : ""}${formatDateBR(receiptISO)}.`, PAGE.width / 2, layout.state.y, { align: "center" });
  layout.state.y += 8;
  const studioDoc = has(settings.studioDocument) ? `CPF/CNPJ ${formatTaxId(settings.studioDocument)}` : "";
  signatureBlock(doc, layout, settings, clean(settings.studioResponsible) || studioName, studioName, { documentLine: studioDoc });

  drawPdfFooters(doc, settings, `Recibo ${number}`);
  doc.save(`recibo-${sanitizeFilePart(clientName, "cliente")}.pdf`);
}
