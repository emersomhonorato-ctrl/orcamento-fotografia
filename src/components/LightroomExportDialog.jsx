import { useState } from "react";
import { Check, Copy, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { baseFileName, buildLightroomCollection, downloadTextFile } from "@/lib/lightroom";

// Duas formas de achar no Lightroom as fotos escolhidas pelo cliente:
// 1) colar os nomes no Filtro da Biblioteca (funciona sempre); 2) importar a coleção inteligente.
export default function LightroomExportDialog({ title, fileName, names = [], onClose }) {
  const [copied, setCopied] = useState(false);
  const unique = [...new Set(names.map(baseFileName).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  const list = unique.join(", ");

  async function copy() {
    try {
      await navigator.clipboard.writeText(list);
    } catch {
      const area = document.getElementById("lightroom-names");
      area?.select();
      document.execCommand?.("copy");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-900">Lightroom — {title}</h3>
            <p className="text-xs text-slate-500">{unique.length} foto{unique.length === 1 ? "" : "s"} escolhida{unique.length === 1 ? "" : "s"}</p>
          </div>
          <button type="button" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Fechar"><X className="h-4 w-4" /></button>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
          <p className="text-sm font-semibold text-slate-900">1. Colar no filtro (mais fácil)</p>
          <textarea id="lightroom-names" readOnly value={list} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 font-mono text-xs text-slate-700" onFocus={(event) => event.target.select()} />
          <Button className="mt-2 w-full rounded-2xl" onClick={copy}>
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}{copied ? "Copiado!" : "Copiar os nomes"}
          </Button>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs leading-5 text-slate-700">
            <li>No Lightroom, abra a pasta do ensaio em <strong>Biblioteca</strong>.</li>
            <li>No <strong>Filtro da biblioteca</strong> (tecla <strong>\</strong>), escolha <strong>Texto › Nome do arquivo › Contém</strong>.</li>
            <li>Cole os nomes: aparecem só as escolhidas.</li>
            <li>Selecione todas (<strong>⌘A</strong>) e crie uma coleção com elas, se quiser.</li>
          </ol>
        </div>

        <div className="mt-3 rounded-2xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-900">2. Coleção inteligente</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">Em <strong>Coleções › + › Importar predefinição de coleção inteligente</strong>, escolha o arquivo baixado.</p>
          <Button variant="outline" className="mt-2 w-full rounded-2xl" onClick={() => downloadTextFile(fileName, buildLightroomCollection(title, unique))}>
            <Download className="mr-2 h-4 w-4" />Baixar coleção (.lrsmcol)
          </Button>
        </div>

        <p className="mt-3 text-[11px] leading-5 text-slate-500">
          As duas formas procuram pelo <strong>nome do arquivo</strong> (ex.: {unique[0] || "EME_1158"}). Se no Lightroom as fotos têm outro nome (renomeadas na importação ou na exportação das prévias), elas não aparecem: use nas prévias o mesmo nome do arquivo original.
        </p>
      </div>
    </div>
  );
}
