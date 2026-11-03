import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CloudUpload, ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { folderIdFromUrl, hasDriveToken, preloadDriveAuth, requestDriveToken, uploadPhotosToDrive } from "@/lib/driveUpload";

const CREATED_KEY = "eh-drive-folders";

function createdFolders() {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(CREATED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function rememberFolder(id) {
  try {
    const list = Array.from(createdFolders());
    list.push(id);
    window.localStorage.setItem(CREATED_KEY, JSON.stringify(list.slice(-300)));
  } catch {
    // sem armazenamento: só não dá para acrescentar fotos depois na mesma pasta
  }
}

// Botão "Importar fotos": cria a pasta no Drive com o nome do cadastro, envia as fotos e devolve o link
export default function DriveImportButton({ kind = "selecao", clientName, eventDate, currentUrl = "", onFolderReady, onUploaded }) {
  const inputRef = useRef(null);
  const [phase, setPhase] = useState("idle"); // idle | authorizing | ready | uploading | done | error
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [message, setMessage] = useState("");

  useEffect(() => {
    preloadDriveAuth();
  }, []);

  const currentFolder = folderIdFromUrl(currentUrl);
  const canAppend = Boolean(currentFolder) && createdFolders().has(currentFolder);

  async function start() {
    setMessage("");
    if (!String(clientName || "").trim()) {
      setPhase("error");
      setMessage("Preencha o nome do cliente antes: ele vira o nome da pasta no Drive.");
      return;
    }
    if (hasDriveToken()) {
      inputRef.current?.click();
      return;
    }
    setPhase("authorizing");
    try {
      await requestDriveToken();
      setPhase("ready");
    } catch (error) {
      setPhase("error");
      setMessage(error.message);
    }
  }

  async function handleFiles(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) {
      setPhase("idle");
      return;
    }
    setPhase("uploading");
    setProgress({ done: 0, total: files.length });
    let announced = false;
    try {
      const result = await uploadPhotosToDrive({
        kind,
        clientName,
        eventDate,
        files,
        existingFolderId: canAppend ? currentFolder : "",
        onProgress: ({ done, total, folderId }) => {
          setProgress({ done, total });
          if (!announced && folderId) {
            announced = true;
            if (!canAppend) rememberFolder(folderId);
            onFolderReady?.(`https://drive.google.com/drive/folders/${folderId}`);
          }
        },
      });
      setPhase("done");
      setMessage(
        result.failed.length
          ? `${files.length - result.failed.length} de ${files.length} fotos enviadas. Não foram: ${result.failed.slice(0, 5).join(", ")}${result.failed.length > 5 ? "…" : ""}. Clique em Importar fotos de novo e escolha só essas.`
          : `${files.length} foto${files.length > 1 ? "s" : ""} enviada${files.length > 1 ? "s" : ""} para o Drive. O link da pasta já está preenchido.`,
      );
      onUploaded?.(result);
    } catch (error) {
      setPhase("error");
      setMessage(error.message);
    }
  }

  const busy = phase === "authorizing" || phase === "uploading";
  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="space-y-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-3">
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
      <div className="flex flex-wrap items-center gap-2">
        {phase === "ready" ? (
          <Button type="button" className="rounded-2xl" onClick={() => inputRef.current?.click()}>
            <ImagePlus className="mr-2 h-4 w-4" />Escolher as fotos
          </Button>
        ) : (
          <Button type="button" variant="outline" className="rounded-2xl" disabled={busy} onClick={start}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CloudUpload className="mr-2 h-4 w-4" />}
            {phase === "authorizing" ? "Autorizando o Google…" : phase === "uploading" ? `Enviando ${progress.done} de ${progress.total}…` : canAppend ? "Importar mais fotos" : "Importar fotos"}
          </Button>
        )}
        <span className="text-xs text-slate-500">
          {phase === "ready"
            ? "Google autorizado. Agora escolha as fotos."
            : canAppend
              ? "As fotos novas entram na mesma pasta."
              : `Cria a pasta “${kind === "entrega" ? "Entrega" : "Seleção"} – ${String(clientName || "nome do cliente").trim()}” no seu Drive e preenche o link.`}
        </span>
      </div>
      {phase === "uploading" ? (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} /></div>
          <p className="text-xs text-slate-500">Deixe esta página aberta até terminar ({percent}%).</p>
        </div>
      ) : null}
      {message ? (
        <p className={`flex items-start gap-1.5 text-xs ${phase === "error" ? "text-red-700" : "text-emerald-700"}`}>
          {phase === "done" ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : null}{message}
        </p>
      ) : null}
    </div>
  );
}
