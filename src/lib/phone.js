// Telefone do Brasil: formatação enquanto digita e conferência do número

// (48) 99999-9999 — no máximo 11 dígitos (DDD + número)
export function formatPhoneInput(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// No app: formata números do Brasil, mas deixa como está quem começa com + (número de fora)
export function formatPhoneLoose(value) {
  const text = String(value || "");
  if (text.trim().startsWith("+")) return text;
  const digits = text.replace(/\D/g, "");
  if (digits.length > 11) return text;
  return formatPhoneInput(text);
}

// Celular ou fixo do Brasil: DDD válido + 8 dígitos (fixo) ou 9 começando com 9 (celular)
export function isValidBrazilPhone(value) {
  const digits = String(value || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (!/^[1-9][1-9]\d{8,9}$/.test(digits)) return false;
  if (/^(\d)\1+$/.test(digits.slice(2))) return false;
  return digits.length === 10 ? /^[2-5]/.test(digits.slice(2)) : digits[2] === "9";
}

// Mensagem curta do que parece errado (vazio = número ok ou campo vazio)
export function phoneProblem(value) {
  const text = String(value || "").trim();
  if (!text || text.startsWith("+") || isValidBrazilPhone(text)) return "";
  const digits = text.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (digits.length < 10) return "Confira o número: falta o DDD ou algum dígito.";
  if (digits.length === 11 && digits[2] !== "9") return "Celular precisa começar com 9 depois do DDD.";
  if (digits.length === 10 && /^[6-9]/.test(digits.slice(2))) return "Celular precisa de 9 dígitos depois do DDD (falta o 9 na frente?).";
  if (/^(\d)\1+$/.test(digits.slice(2))) return "Esse número parece de teste (todos os dígitos iguais).";
  return "Esse número não parece um telefone válido do Brasil.";
}
