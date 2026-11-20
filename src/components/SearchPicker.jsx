import { useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";

// Lista com busca: digita parte do nome (ou telefone, categoria...) e escolhe. Sempre em ordem alfabética.
const tirarAcento = (texto) => String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const soNumeros = (texto) => String(texto || "").replace(/\D/g, "");

export default function SearchPicker({ options = [], value = "", onChange, placeholder = "Buscar…", emptyText = "Nada encontrado.", clearable = true, keepEmpty = false, className = "" }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const caixa = useRef(null);
  const atual = options.find((option) => option.id === value);

  const lista = useMemo(() => {
    const termo = tirarAcento(busca.trim());
    const digitos = soNumeros(busca);
    return [...options]
      .filter((option) => {
        if (!termo) return true;
        if (tirarAcento(`${option.label} ${option.search || ""}`).includes(termo)) return true;
        return digitos.length >= 3 && soNumeros(option.search).includes(digitos);
      })
      .sort((a, b) => String(a.label || "").localeCompare(String(b.label || ""), "pt-BR", { sensitivity: "base" }));
  }, [options, busca]);

  function escolher(id) {
    onChange(id);
    setAberto(false);
    setBusca("");
  }

  const mostrarAtual = atual && !keepEmpty;

  return (
    <div
      ref={caixa}
      className={`relative ${className}`}
      onBlur={(e) => {
        if (!caixa.current?.contains(e.relatedTarget)) setAberto(false);
      }}
    >
      <div className="flex h-10 items-center gap-2 rounded-2xl border border-input bg-background px-3 text-sm focus-within:ring-2 focus-within:ring-ring/40">
        <Search className="h-4 w-4 shrink-0 text-stone-400" />
        <input
          value={aberto ? busca : mostrarAtual ? atual.label : ""}
          placeholder={mostrarAtual ? atual.label : placeholder}
          onFocus={() => setAberto(true)}
          onChange={(e) => {
            setBusca(e.target.value);
            setAberto(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && aberto && lista[0]) {
              e.preventDefault();
              escolher(lista[0].id);
            }
            if (e.key === "Escape") setAberto(false);
          }}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-stone-400"
        />
        {mostrarAtual && clearable ? (
          <button type="button" title="Limpar" className="rounded-full p-0.5 text-stone-400 hover:text-stone-700" onClick={() => escolher("")}>
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {aberto ? (
        <div className="absolute z-50 mt-1 max-h-72 w-full min-w-[260px] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-1 shadow-xl">
          {lista.length ? (
            lista.slice(0, 200).map((option) => (
              <button
                key={option.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(option.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-stone-100 ${option.id === value ? "bg-stone-100 font-semibold" : ""}`}
              >
                <span className="truncate">{option.label || "Sem nome"}</span>
                {option.hint ? <span className="shrink-0 text-xs text-stone-400">{option.hint}</span> : null}
              </button>
            ))
          ) : (
            <p className="px-3 py-3 text-sm text-stone-500">{emptyText}</p>
          )}
          {lista.length > 200 ? <p className="px-3 py-2 text-xs text-stone-400">Digite para achar mais rápido…</p> : null}
        </div>
      ) : null}
    </div>
  );
}
