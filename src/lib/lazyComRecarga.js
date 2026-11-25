import { lazy } from "react";

// Depois de uma atualização do app, quem estava com a versão antiga aberta tenta baixar arquivos
// de abas que não existem mais e a aba não abre. Aqui o app se recarrega sozinho (uma vez) e abre a versão nova.
const CHAVE = "eh-recarregou-versao";

export function recarregarParaVersaoNova() {
  try {
    const ultima = Number(sessionStorage.getItem(CHAVE) || 0);
    if (Date.now() - ultima < 30000) return false; // já tentou há pouco: não fica em loop
    sessionStorage.setItem(CHAVE, String(Date.now()));
  } catch {
    // sem sessionStorage: recarrega mesmo assim
  }
  window.location.reload();
  return true;
}

export function lazyComRecarga(importar) {
  return lazy(() =>
    importar().catch((erro) => {
      if (recarregarParaVersaoNova()) return new Promise(() => {}); // a página vai recarregar
      throw erro;
    })
  );
}

if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (event) => {
    if (recarregarParaVersaoNova()) event.preventDefault();
  });
}
