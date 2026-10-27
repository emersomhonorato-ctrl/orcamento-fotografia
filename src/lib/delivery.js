// Utilidades da entrega de fotos (Google Drive)

export const DELIVERY_PUBLIC_BASE = "https://orcamento.emersonhonoratoretratos.com.br/entrega/";
export const STUDIO_WHATSAPP = "5548999652317";
export const COVER_BUCKET = "entregas";

// Extrai o ID da pasta (ou arquivo) de um link do Google Drive
export function driveFolderId(url = "") {
  const text = String(url).trim();
  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]{10,})/,
    /[?&]id=([a-zA-Z0-9_-]{10,})/,
    /\/d\/([a-zA-Z0-9_-]{10,})/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return "";
}

export function isDriveFolder(url = "") {
  return /drive\.google\.com\/(drive\/(u\/\d+\/)?folders\/|open\?id=)/.test(String(url));
}

// Galeria embutida do Drive (funciona quando a pasta está compartilhada como "Qualquer pessoa com o link")
export function driveEmbedUrl(url = "") {
  const id = driveFolderId(url);
  return id && isDriveFolder(url) ? `https://drive.google.com/embeddedfolderview?id=${id}#grid` : "";
}

export function slugify(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// Link difícil de adivinhar: nome-do-cliente + código aleatório
export function makeDeliverySlug(name = "") {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  const code = Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 8);
  const base = slugify(String(name).split(/\s+/).slice(0, 2).join(" ")) || "fotos";
  return `${base}-${code}`;
}

export function formatDateBR(dateKey) {
  if (!dateKey) return "";
  const [y, m, d] = String(dateKey).slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : "";
}

// Reduz a foto de capa antes de enviar (carrega rápido no celular)
export function compressImage(file, maxSize = 1800, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Falha ao processar a imagem"))), "image/jpeg", quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Imagem inválida"));
    };
    img.src = url;
  });
}

// Ponto da foto que fica sempre visível no recorte (ex.: o rosto). Formato "50% 35%".
export const DEFAULT_COVER_FOCUS = "50% 35%";
export function coverFocusStyle(focus) {
  const value = /^\d{1,3}% \d{1,3}%$/.test(String(focus || "")) ? focus : DEFAULT_COVER_FOCUS;
  return { objectPosition: value };
}
export function focusFromClick(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = Math.round(Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)));
  const y = Math.round(Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100)));
  return `${x}% ${y}%`;
}
