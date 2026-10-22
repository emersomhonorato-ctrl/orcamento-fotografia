// Pix "copia e cola" estático (padrão BR Code do Banco Central) com valor.

function field(id, value) {
  const text = String(value);
  return `${id}${String(text.length).padStart(2, "0")}${text}`;
}

function normalizeText(value, max) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .toUpperCase()
    .slice(0, max);
}

function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Normaliza a chave: CPF/CNPJ/telefone só dígitos (telefone com +55); e-mail e aleatória como estão. */
export function normalizePixKey(key) {
  const raw = String(key || "").trim();
  if (raw.includes("@")) return raw.toLowerCase();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) return raw.toLowerCase();
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return `+${digits}`;
  return digits;
}

export function buildPixPayload({ key, name, city, amount, txid = "***", description = "" }) {
  const merchantAccount = field("00", "br.gov.bcb.pix") + field("01", normalizePixKey(key)) + (description ? field("02", String(description).slice(0, 40)) : "");
  const safeTxid = String(txid || "***").replace(/[^a-zA-Z0-9]/g, "").slice(0, 25) || "***";
  const value = Number(amount || 0);
  const payload =
    field("00", "01") +
    field("26", merchantAccount) +
    field("52", "0000") +
    field("53", "986") +
    (value > 0 ? field("54", value.toFixed(2)) : "") +
    field("58", "BR") +
    field("59", normalizeText(name, 25) || "RECEBEDOR") +
    field("60", normalizeText(city, 15) || "BRASIL") +
    field("62", field("05", safeTxid)) +
    "6304";
  return payload + crc16(payload);
}

export function formatPixKey(key) {
  const digits = String(key || "").replace(/\D/g, "");
  if (digits.length === 14) return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (digits.length === 11 && !String(key).includes("@")) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return String(key || "");
}
