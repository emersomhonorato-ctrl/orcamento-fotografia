import jsPDF from "jspdf";

// As fontes padrão do PDF (Helvetica/Times) só conhecem os caracteres do
// Windows-1252. Emojis e símbolos fora disso saíam como lixo ("Ø=Üø").
// Aqui tiramos esses caracteres antes de escrever no PDF.
const CP1252_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
const REPLACE = { "−": "-", "‑": "-", "‐": "-", " ": " ", " ": " ", "→": "->", "✓": "-", "✔": "-", "✅": "-" };

export function pdfSafe(value) {
  if (Array.isArray(value)) return value.map(pdfSafe);
  if (typeof value !== "string") return value;
  let out = "";
  for (const ch of value) {
    if (REPLACE[ch]) out += REPLACE[ch];
    else if (ch.codePointAt(0) <= 0xff || CP1252_EXTRA.has(ch)) out += ch;
    else out += "\uE000";
  }
  if (!out.includes("\uE000")) return out;
  // Tira o espaço que sobrava onde havia emoji, sem mexer no resto do texto
  return out
    .replace(/^[ \t]*\uE000+[ \t]*/gm, "")
    .replace(/[ \t]*\uE000+[ \t]*$/gm, "")
    .replace(/[ \t]*\uE000+[ \t]*/g, " ");
}

export function makePdfSafe(doc) {
  const text = doc.text.bind(doc);
  const split = doc.splitTextToSize.bind(doc);
  const width = doc.getTextWidth.bind(doc);
  doc.text = (value, ...rest) => text(pdfSafe(value), ...rest);
  doc.splitTextToSize = (value, ...rest) => split(pdfSafe(value), ...rest);
  doc.getTextWidth = (value, ...rest) => width(pdfSafe(value), ...rest);
  return doc;
}

export function createPdf(...args) {
  return makePdfSafe(new jsPDF(...args));
}
