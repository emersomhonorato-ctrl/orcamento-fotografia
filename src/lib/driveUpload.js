// Envio de fotos para o Google Drive direto do navegador (autorização "drive.file":
// o app só enxerga as pastas e arquivos que ele mesmo criou).
export const GOOGLE_CLIENT_ID = "123079713322-uiruak461u3vnn2k9sgggi3mra2tadbn.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id&supportsAllDrives=true";
const ROOT_NAME = "EH Estúdio";

let token = null;
let tokenExpiresAt = 0;
let gisPromise = null;

function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        gisPromise = null;
        reject(new Error("Não foi possível carregar o login do Google. Confira a internet e tente de novo."));
      };
      document.head.appendChild(script);
    });
  }
  return gisPromise;
}

// Carrega o script do Google antes do clique, para o pedido de autorização abrir na hora
export function preloadDriveAuth() {
  loadGis().catch(() => {});
}

export function hasDriveToken() {
  return Boolean(token) && Date.now() < tokenExpiresAt - 60_000;
}

// Precisa ser chamado direto num clique (abre a janelinha do Google)
export function requestDriveToken() {
  return loadGis().then(
    () =>
      new Promise((resolve, reject) => {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: SCOPE,
          prompt: "",
          callback: (response) => {
            if (response?.access_token) {
              token = response.access_token;
              tokenExpiresAt = Date.now() + Number(response.expires_in || 3600) * 1000;
              resolve(token);
            } else {
              reject(new Error("O Google não liberou o acesso ao Drive."));
            }
          },
          error_callback: (error) => {
            reject(new Error(error?.type === "popup_closed" ? "A janela do Google foi fechada antes de autorizar." : "Não foi possível autorizar o Google Drive."));
          },
        });
        client.requestAccessToken();
      }),
  );
}

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) },
  });
  if (!response.ok) {
    if (response.status === 401) token = null;
    const detail = await response.text().catch(() => "");
    throw new Error(`Google Drive respondeu ${response.status}. ${detail.slice(0, 160)}`);
  }
  return response.status === 204 ? null : response.json();
}

function escapeQuery(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findOrCreateFolder(name, parentId, key) {
  const conditions = [
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
    `appProperties has { key = 'ehKey' and value = '${escapeQuery(key)}' }`,
  ];
  if (parentId) conditions.push(`'${parentId}' in parents`);
  const found = await api(`/files?q=${encodeURIComponent(conditions.join(" and "))}&fields=files(id,name)&pageSize=1`);
  if (found?.files?.[0]?.id) return found.files[0].id;
  const created = await api("/files?fields=id", {
    method: "POST",
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
      appProperties: { ehKey: key },
    }),
  });
  return created.id;
}

async function uploadOne(file, folderId) {
  const boundary = `eh${Math.random().toString(36).slice(2)}`;
  const metadata = { name: file.name, parents: [folderId] };
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`,
    file,
    `\r\n--${boundary}--`,
  ]);
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(UPLOAD, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
        body,
      });
      if (response.ok) return;
      if (response.status === 401) throw new Error("A autorização do Google expirou. Clique em Importar fotos de novo.");
      lastError = new Error(`Falha ao enviar ${file.name} (${response.status}).`);
    } catch (error) {
      lastError = error;
      if (/expirou/.test(error.message)) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
  }
  throw lastError;
}

function folderDate(isoDate) {
  const value = /^\d{4}-\d{2}-\d{2}$/.test(String(isoDate || "")) ? isoDate : new Date().toISOString().slice(0, 10);
  return value.split("-").reverse().join("-");
}

/**
 * Cria a pasta "EH Estúdio › Seleções|Entregas › <Tipo> – <Cliente> – <data>", envia as fotos,
 * compartilha como "qualquer pessoa com o link" e devolve o link da pasta.
 */
export async function uploadPhotosToDrive({ kind, clientName, eventDate, files, existingFolderId = "", onProgress }) {
  if (!hasDriveToken()) throw new Error("Autorize o Google Drive primeiro.");
  const list = Array.from(files || []).filter((file) => file && file.size > 0);
  if (!list.length) throw new Error("Nenhuma foto escolhida.");
  const isDelivery = kind === "entrega";

  let folderId = existingFolderId;
  if (!folderId) {
    const rootId = await findOrCreateFolder(ROOT_NAME, null, "root");
    const groupId = await findOrCreateFolder(isDelivery ? "Entregas" : "Seleções", rootId, isDelivery ? "entregas" : "selecoes");
    const name = `${isDelivery ? "Entrega" : "Seleção"} – ${String(clientName || "Cliente").trim()} – ${folderDate(eventDate)}`;
    const created = await api("/files?fields=id", {
      method: "POST",
      body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [groupId] }),
    });
    folderId = created.id;
    await api(`/files/${folderId}/permissions?fields=id`, { method: "POST", body: JSON.stringify({ role: "reader", type: "anyone" }) });
  }

  let done = 0;
  const failed = [];
  onProgress?.({ done, total: list.length, folderId });
  const queue = [...list];
  const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
    while (queue.length) {
      const file = queue.shift();
      try {
        await uploadOne(file, folderId);
      } catch (error) {
        if (/expirou/.test(error.message)) throw error;
        failed.push(file.name);
      }
      done += 1;
      onProgress?.({ done, total: list.length, folderId });
    }
  });
  await Promise.all(workers);
  return { folderId, url: `https://drive.google.com/drive/folders/${folderId}`, failed };
}

export function folderIdFromUrl(url) {
  const match = String(url || "").match(/folders\/([A-Za-z0-9_-]{10,})/);
  return match ? match[1] : "";
}
