// Abre um link externo (WhatsApp, e-mail, páginas) sem tirar o usuário do app.
// No iPhone com o app instalado na tela inicial, window.open(..., "noopener") troca a própria
// tela do app pelo link e, ao voltar do WhatsApp, fica uma página em branco sem botão de voltar.
// Um link <a target="_blank"> é aberto fora do app (Safari/WhatsApp) e o app continua onde estava.
export function openExternal(url) {
  if (!url) return;
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
