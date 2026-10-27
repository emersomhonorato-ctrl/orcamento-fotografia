import { useEffect, useRef, useState } from "react";
import { FileText, LogOut, MoreHorizontal, Plus, RefreshCw, Save, Upload } from "lucide-react";
import InstallAppButton from "@/components/InstallAppButton";

const SERIF = { fontFamily: "'Cormorant Garamond', Georgia, 'Times New Roman', serif" };

function useSerifFont() {
  useEffect(() => {
    const id = "eh-serif-font";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&display=swap";
    document.head.appendChild(link);
  }, []);
}

function syncTone(status = "") {
  if (/conflito/i.test(status)) return "bg-red-500";
  if (/sincronizando|carregando/i.test(status)) return "bg-amber-400";
  if (/supabase/i.test(status)) return "bg-emerald-500";
  return "bg-stone-400";
}

function syncLabel(status = "") {
  if (/conflito/i.test(status)) return "Conflito de dados";
  if (/sincronizando/i.test(status)) return "Salvando…";
  if (/carregando/i.test(status)) return "Carregando…";
  if (/supabase/i.test(status)) return "Salvo na nuvem";
  return "Só neste aparelho";
}

// Barra do topo: nome do estúdio, estado da nuvem, ações principais e menu "Mais"
export default function StudioHeader({ syncStatus, syncMessage, onNewEvent, onNewBudget, onBackup, onSync, onImport, onLogout }) {
  useSerifFont();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-100";

  return (
    <header className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-stone-200 pb-5">
      <div className="flex min-w-0 basis-full items-center gap-3 sm:basis-auto sm:flex-1">
        <img src="/icons/icon-192.png" alt="" className="h-10 w-10 shrink-0 rounded-xl" />
        <div className="min-w-0">
          <h1 className="truncate text-[1.7rem] font-semibold leading-none text-stone-900" style={SERIF}>
            Emerson Honorato Retratos
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-stone-500" title={syncMessage || syncStatus}>
            <span className={`h-1.5 w-1.5 rounded-full ${syncTone(syncStatus)}`} />
            {syncLabel(syncStatus)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={onNewBudget} className="inline-flex h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700 hover:bg-stone-50">
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">Novo orçamento</span>
          <span className="sm:hidden">Orçamento</span>
        </button>
        <button type="button" onClick={onNewEvent} className="studio-primary inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium text-white">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo agendamento</span>
          <span className="sm:hidden">Agendar</span>
        </button>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            aria-label="Mais opções"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {open ? (
            <div className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-stone-200 bg-white p-1.5 shadow-lg">
              <button type="button" className={item} onClick={() => { setOpen(false); onSync?.(); }}><RefreshCw className="h-4 w-4 text-stone-400" />Sincronizar agora</button>
              <button type="button" className={item} onClick={() => { setOpen(false); onBackup?.(); }}><Save className="h-4 w-4 text-stone-400" />Baixar backup</button>
              <label className={`${item} cursor-pointer`}>
                <Upload className="h-4 w-4 text-stone-400" />Importar backup
                <input type="file" accept="application/json" className="hidden" onChange={(event) => { setOpen(false); onImport?.(event); }} />
              </label>
              <InstallAppButton className={`${item} h-auto justify-start border-0 bg-transparent font-normal shadow-none`} />
              {onLogout ? (
                <>
                  <div className="my-1 h-px bg-stone-100" />
                  <button type="button" className={item} onClick={() => { setOpen(false); onLogout(); }}><LogOut className="h-4 w-4 text-stone-400" />Sair</button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
