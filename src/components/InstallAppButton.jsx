import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

function isStandalone() {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: window-controls-overlay)").matches || window.navigator.standalone === true;
  } catch {
    return false;
  }
}

function detectPlatform() {
  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isMac = /Macintosh|Mac OS X/i.test(ua) && !isIOS;
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/i.test(ua);
  const isFirefox = /Firefox/i.test(ua);
  return { isIOS, isMac, isSafari, isFirefox };
}

// Botão "Instalar app": no Chrome/Edge (Mac e Windows) instala direto; no Safari/iPhone mostra o passo a passo
export default function InstallAppButton({ className = "" }) {
  const [promptEvent, setPromptEvent] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [showHelp, setShowHelp] = useState(false);
  const platform = detectPlatform();

  useEffect(() => {
    const onPrompt = (event) => {
      event.preventDefault();
      setPromptEvent(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function install() {
    if (promptEvent) {
      promptEvent.prompt();
      const choice = await promptEvent.userChoice.catch(() => null);
      if (choice?.outcome === "accepted") setInstalled(true);
      setPromptEvent(null);
      return;
    }
    setShowHelp(true);
  }

  const steps = platform.isIOS
    ? ["Abra este site no Safari.", "Toque no botão Compartilhar (quadrado com seta para cima).", "Escolha “Adicionar à Tela de Início” e confirme."]
    : platform.isMac && platform.isSafari
      ? ["No menu do Safari, clique em Arquivo.", "Escolha “Adicionar ao Dock…”.", "Confirme o nome “EH Estúdio” e clique em Adicionar."]
      : platform.isFirefox
        ? ["O Firefox não instala apps.", "Abra este mesmo endereço no Google Chrome ou no Microsoft Edge.", "Clique em “Instalar app” de novo."]
        : ["Na barra de endereço, clique no ícone de instalar (um monitor com uma seta) no canto direito.", "Ou abra o menu ⋮ → “Transmitir, salvar e compartilhar” → “Instalar página como app”.", "Confirme em Instalar. O app aparece no Dock (Mac) ou no Menu Iniciar (Windows)."];

  return (
    <>
      <Button variant="outline" onClick={install} className={className}>
        <Download className="mr-2 h-4 w-4" />
        Instalar app
      </Button>
      {showHelp ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowHelp(false)}>
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 text-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img src="/icons/icon-192.png" alt="" className="h-12 w-12 rounded-2xl" />
                <div>
                  <p className="text-lg font-semibold">Instalar o EH Estúdio</p>
                  <p className="text-sm text-slate-500">Abre numa janela própria, com ícone no computador.</p>
                </div>
              </div>
              <button type="button" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setShowHelp(false)}><X className="h-4 w-4" /></button>
            </div>
            <ol className="mt-5 space-y-3">
              {steps.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm leading-6">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
            <Button className="mt-6 w-full rounded-2xl" onClick={() => setShowHelp(false)}>Entendi</Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
