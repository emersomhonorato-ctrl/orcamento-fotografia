import { driveFolderId } from "@/lib/delivery";

// Lista as fotos de uma pasta pública do Google Drive (precisa de uma chave de API do Google com a "Google Drive API" ativada)
export async function listDriveImages(folderUrl, apiKey) {
  const folderId = driveFolderId(folderUrl);
  if (!folderId) throw new Error("Link da pasta do Drive inválido.");
  if (!apiKey) throw new Error("Cadastre a chave do Google (no topo desta aba) para o app ler as fotos do Drive.");
  const files = [];
  let pageToken = "";
  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false and mimeType contains 'image/'`,
      fields: "nextPageToken, files(id, name)",
      pageSize: "1000",
      orderBy: "name_natural",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      key: apiKey,
    });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`);
    if (!response.ok) {
      let detail = "";
      try {
        detail = (await response.json())?.error?.message || "";
      } catch {
        /* sem detalhe */
      }
      if (response.status === 404) throw new Error("Pasta não encontrada. Confira o link e se ela está compartilhada como “Qualquer pessoa com o link”.");
      if (response.status === 403 || response.status === 400) {
        throw new Error(`O Google recusou a chave. Confira se a “Google Drive API” está ativada e se a chave está certa.${detail ? ` (${detail})` : ""}`);
      }
      throw new Error(`Erro ao ler o Drive (${response.status}). ${detail}`);
    }
    const data = await response.json();
    (data.files || []).forEach((file) => files.push({ id: file.id, name: file.name }));
    pageToken = data.nextPageToken || "";
    if (!pageToken) break;
  }
  return files.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
}
