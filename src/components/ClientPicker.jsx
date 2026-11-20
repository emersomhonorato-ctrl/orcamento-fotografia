import { useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";

// Escolher cliente cadastrado: lista em ordem alfabética com busca por nome, telefone ou e-mail
const tirarAcento = (texto) => String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const soNumeros = (texto) => String(texto || "").replace(/\D/g, "");

export default function ClientPicker({ clients = [], value, onChange }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const caixa = useRef(null);
  const atual = clients.find((client) => client.id === value);

  const lista = useMemo(() => {
    const termo = tirarAcento(busca.trim());
    const digitos = soNumeros(busca);
    return [...clients]
      .filter((client) => {
        if (!termo) return true;
        if (tirarAcento(client.name).includes(termo) || tirarAcento(client.email).includes(termo)) return true;
        return digitos.length >= 3 && (soNumeros(client.whatsapp).includes(digitos) || soNumeros(client.phone).includes(digitos));
      })
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR", { sensitivity: "base" }));
  }, [clients, busca]);

  function escolher(id) {
    onChange(id);
    setAberto(false);
    setBusca("");
  }

  return (
    <div
      ref={caixa}
      className="relative"
      onBlur={(e) => {
        if (!caixa.current?.contains(e.relatedTarget)) setAberto(false);
      }}
    >
      <div className="flex h-10 items-center gap-2 rounded-2xl border border-input bg-background px-3 text-sm focus-within:ring-2 focus-within:ring-ring/40">
        <Search className="h-4 w-4 shrink-0 text-stone-400" />
        <input
          value={aberto ? busca : atual?.name || ""}
          placeholder={atual ? atual.name : "Buscar cliente pelo nome ou telefone"}
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
        {atual ? (
          <button type="button" title="Tirar cliente" className="rounded-full p-0.5 text-stone-400 hover:text-stone-700" onClick={() => escolher("")}>
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {aberto ? (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-2xl border border-stone-200 bg-white p-1 shadow-xl">
          {lista.length ? (
            lista.slice(0, 200).map((client) => (
              <button
                key={client.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(client.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-stone-100 ${client.id === value ? "bg-stone-100 font-semibold" : ""}`}
              >
                <span className="truncate">{client.name || "Sem nome"}</span>
                <span className="shrink-0 text-xs text-stone-400">{client.whatsapp || client.phone || ""}</span>
              </button>
            ))
          ) : (
            <p className="px-3 py-3 text-sm text-stone-500">Nenhum cliente com “{busca}”. Preencha o nome abaixo para cadastrar um novo.</p>
          )}
          {lista.length > 200 ? <p className="px-3 py-2 text-xs text-stone-400">Digite para achar mais rápido…</p> : null}
        </div>
      ) : null}
    </div>
  );
}
