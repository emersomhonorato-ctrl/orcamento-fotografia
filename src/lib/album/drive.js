import { driveFolderId } from "@/lib/delivery";

// Lista as fotos da pasta do Drive com o tamanho de cada uma (para encaixar vertical em caixa vertical)
export async function listDrivePhotosWithSize(folderUrl, apiKey) {
  const folderId = driveFolderId(folderUrl);
  if (!folderId) throw new Error("Link da pasta do Drive inválido.");
  if (!apiKey) throw new Error("Cadastre a chave do Google (aba Seleção) para o app ler as fotos do Drive.");
  const files = [];
  let pageToken = "";
  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false and mimeType contains 'image/'`,
      fields: "nextPageToken, files(id, name, imageMediaMetadata(width, height, rotation))",
      pageSize: "1000",
      orderBy: "name_natural",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      key: apiKey,
    });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`);
    if (!response.ok) {
      if (response.status === 404) throw new Error("Pasta não encontrada. Confira o link e se ela está compartilhada como “Qualquer pessoa com o link”.");
      throw new Error(`Não consegui ler a pasta do Drive (${response.status}).`);
    }
    const data = await response.json();
    (data.files || []).forEach((file) => {
      const meta = file.imageMediaMetadata || {};
      const girada = [90, 270, 1, 3].includes(Number(meta.rotation));
      const w = Number(girada ? meta.height : meta.width) || 0;
      const h = Number(girada ? meta.width : meta.height) || 0;
      files.push({ id: file.id, name: file.name, ...(w && h ? { w, h } : {}) });
    });
    pageToken = data.nextPageToken || "";
    if (!pageToken) break;
  }
  return files.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
}

export const albumThumb = (id, size = 800) => `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`;
export const albumThumbAlt = (id, size = 800) => `https://lh3.googleusercontent.com/d/${id}=w${size}`;
