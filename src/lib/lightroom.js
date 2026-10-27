// Gera a "Coleção inteligente" do Lightroom Classic (.lrsmcol) com as fotos escolhidas pelo cliente.
// No Lightroom: Biblioteca → painel Coleções → "+" → Importar predefinição de coleção inteligente.

function luaString(value) {
  return `"${String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, " ")}"`;
}

// "EME_1158.jpg" -> "EME_1158"
export function baseFileName(name = "") {
  return String(name).trim().replace(/\.[A-Za-z0-9]{2,5}$/, "");
}

export function newCollectionId() {
  const uuid = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14)}`;
  return uuid.toUpperCase();
}

export function buildLightroomCollection(title, fileNames = [], id = newCollectionId()) {
  const seen = new Set();
  const names = fileNames.map(baseFileName).filter((name) => name && !seen.has(name) && seen.add(name));
  const lines = [
    "s = {",
    `\tid = ${luaString(id)},`,
    `\tinternalName = ${luaString(title)},`,
    `\ttitle = ${luaString(title)},`,
    '\ttype = "LibrarySmartCollection",',
    "\tvalue = {",
  ];
  names.forEach((name) => {
    lines.push("\t\t{", '\t\t\tcriteria = "filename",', '\t\t\toperation = "contains",', `\t\t\tvalue = ${luaString(name)},`, "\t\t},");
  });
  lines.push('\t\tcombine = "union",', "\t},", "\tversion = 0,", "}", "");
  return lines.join("\n");
}

export function downloadTextFile(fileName, content, type = "application/octet-stream") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
