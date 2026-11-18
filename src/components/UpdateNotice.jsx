import { useEffect, useState } from "react";

// Mostra "Nova versão disponível" quando o app foi publicado de novo
// enquanto esta janela estava aberta. Compara o arquivo principal do app
// (/assets/index-XXXX.js) desta janela com o da versão no ar.
function currentBundle() {
  const script = document.querySelector('script[type="module"][src*="/assets/"]');
  return script ? new URL(script.getAttribute("src"), window.location.origin).pathname : "";
}

async function liveBundle() {
  const response = await fetch(`/?versao=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) return "";
  const html = await response.text();
  const match = html.match(/<script[^>]+type="module"[^>]+src="([^"]*\/assets\/[^"]+\.js)"/) || html.match(/src="(\/assets\/index-[^"]+\.js)"/);
  return match ? new URL(match[1], window.location.origin).pathname : "";
}

export default function UpdateNotice() {
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    const mine = currentBundle();
    if (!mine) return undefined;
    let stopped = false;
    const check = async () => {
      if (stopped || document.visibilityState === "hidden") return;
      try {
        const live = await liveBundle();
        if (!stopped && live && live !== mine) setHasUpdate(true);
      } catch {
        // sem internet: tenta de novo depois
      }
    };
    const timer = window.setInterval(check, 3 * 60 * 1000);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const first = window.setTimeout(check, 20 * 1000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.clearTimeout(first);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  if (!hasUpdate) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-[9999] flex justify-center px-4 print:hidden">
      <div className="flex max-w-md items-center gap-3 rounded-2xl bg-[#171b26] px-4 py-3 text-sm text-white shadow-2xl">
        <span className="text-lg" aria-hidden="true">✨</span>
        <p className="flex-1 leading-5">
          <strong>Nova versão disponível.</strong> Atualize para usar as últimas melhorias.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl bg-[#c4a050] px-3 py-1.5 font-semibold text-[#171b26] hover:bg-[#d4b060]"
        >
          Atualizar
        </button>
        <button type="button" onClick={() => setHasUpdate(false)} className="px-1 text-white/60 hover:text-white" aria-label="Fechar">
          ×
        </button>
      </div>
    </div>
  );
}
