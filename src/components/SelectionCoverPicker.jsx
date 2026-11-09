import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const PAGE = 60;
const thumb = (id, size) => `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`;

// Janela para escolher a foto de capa da seleção entre as fotos da pasta
export default function SelectionCoverPicker({ item, onPick, onClose }) {
  const photos = Array.isArray(item.photos) ? item.photos : [];
  const [limit, setLimit] = useState(PAGE);
  const [chosen, setChosen] = useState(item.cover_id || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await onPick(chosen);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-slate-900">Capa — {item.client_name}</h3>
            <p className="text-xs text-slate-500">Toque na foto que vai ser a capa. Ela aparece no cartão e no topo da página do cliente.</p>
          </div>
          <button type="button" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Fechar"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {photos.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">Esta seleção ainda não tem fotos. Salve a seleção com a pasta do Drive primeiro.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
              {photos.slice(0, limit).map((photo) => {
                const active = chosen === photo.id;
                return (
                  <button key={photo.id} type="button" onClick={() => setChosen(photo.id)} className={`relative overflow-hidden rounded-xl bg-slate-100 ring-offset-2 ${active ? "ring-4 ring-[#7f274f]" : "hover:opacity-90"}`} title={photo.name}>
                    <img src={thumb(photo.id, 300)} alt={photo.name} loading="lazy" referrerPolicy="no-referrer" className="aspect-square w-full object-cover" />
                    {active ? <span className="absolute right-1.5 top-1.5 rounded-full bg-[#7f274f] p-1 text-white"><Check className="h-3.5 w-3.5" /></span> : null}
                  </button>
                );
              })}
            </div>
          )}
          {photos.length > limit ? (
            <div className="mt-3 text-center">
              <Button variant="outline" className="rounded-2xl" onClick={() => setLimit((value) => value + PAGE)}>Mostrar mais fotos ({photos.length - limit} restantes)</Button>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3">
          {chosen ? <img src={thumb(chosen, 120)} alt="" referrerPolicy="no-referrer" className="h-10 w-10 rounded-lg object-cover" /> : null}
          <span className="flex-1 text-xs text-slate-500">{chosen ? "Capa escolhida" : "Nenhuma capa: o app escolhe uma sozinho"}</span>
          {item.cover_id ? <Button variant="ghost" className="rounded-2xl text-slate-600" disabled={saving} onClick={() => { setChosen(""); }}>Tirar capa</Button> : null}
          <Button className="rounded-2xl" disabled={saving || chosen === (item.cover_id || "")} onClick={save}>{saving ? "Salvando…" : "Salvar capa"}</Button>
        </div>
      </div>
    </div>
  );
}
