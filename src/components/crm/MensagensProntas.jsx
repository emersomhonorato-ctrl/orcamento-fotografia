import { useState } from "react";
import { MessageCircle, RotateCcw, Save } from "lucide-react";
import { openExternal } from "@/lib/openExternal";
import { buildWhatsAppLink } from "@/utils/whatsappMessages";
import { MENSAGENS_PADRAO, mensagemSugerida, preencherMensagem, textoDaMensagem } from "@/lib/crmMensagens";

// Mensagens prontas no painel do cliente: escolhe, revisa e manda pelo WhatsApp
export default function MensagensProntas({ cliente, registros, etapa, crm, onChangeCrm }) {
  const sugerida = mensagemSugerida(etapa, registros);
  const [escolhida, setEscolhida] = useState(null); // { id, texto }
  const [aviso, setAviso] = useState("");

  function abrir(id) {
    setAviso("");
    setEscolhida({ id, texto: preencherMensagem(textoDaMensagem(id, crm), cliente, registros) });
  }
  function salvarComoPadrao() {
    // guarda o modelo com {nome} no lugar do nome do cliente, para servir para todos
    const primeiro = String(cliente.name || "").split(" ")[0];
    const modelo = primeiro ? escolhida.texto.split(primeiro).join("{nome}") : escolhida.texto;
    onChangeCrm({ ...crm, templates: { ...(crm.templates || {}), [escolhida.id]: modelo } });
    setAviso("Salvo como padrão para todos os clientes.");
  }
  function voltarPadrao() {
    const templates = { ...(crm.templates || {}) };
    delete templates[escolhida.id];
    onChangeCrm({ ...crm, templates });
    const original = MENSAGENS_PADRAO.find((m) => m.id === escolhida.id)?.texto || "";
    setEscolhida({ ...escolhida, texto: preencherMensagem(original, cliente, registros) });
    setAviso("Voltou para o texto original.");
  }

  const ordem = [...MENSAGENS_PADRAO].sort((a, b) => (a.id === sugerida ? -1 : b.id === sugerida ? 1 : 0));

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {ordem.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => abrir(m.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${escolhida?.id === m.id ? "border-[#7f274f] bg-[#7f274f] text-white" : m.id === sugerida ? "border-emerald-400 bg-emerald-50 text-emerald-800" : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"}`}
          >
            {m.id === sugerida ? "⭐ " : ""}{m.titulo}{crm.templates?.[m.id] ? " ✎" : ""}
          </button>
        ))}
      </div>
      {!escolhida ? <p className="mt-2 text-xs text-stone-500">⭐ é a mais indicada para a etapa em que o cliente está.</p> : null}
      {escolhida ? (
        <div className="mt-3 rounded-2xl border border-stone-200 bg-white p-3">
          <textarea value={escolhida.texto} onChange={(e) => setEscolhida({ ...escolhida, texto: e.target.value })} rows={7} className="w-full rounded-xl border border-stone-200 p-2.5 text-sm leading-6 text-stone-800" />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!cliente.whatsapp}
              onClick={() => openExternal(buildWhatsAppLink(cliente.whatsapp, escolhida.texto))}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              <MessageCircle className="h-4 w-4" />Enviar no WhatsApp
            </button>
            <button type="button" onClick={salvarComoPadrao} className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50">
              <Save className="h-4 w-4" />Salvar como padrão
            </button>
            {crm.templates?.[escolhida.id] ? (
              <button type="button" onClick={voltarPadrao} className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50">
                <RotateCcw className="h-4 w-4" />Texto original
              </button>
            ) : null}
          </div>
          {!cliente.whatsapp ? <p className="mt-2 text-xs text-red-700">Este cliente não tem WhatsApp cadastrado.</p> : null}
          {aviso ? <p className="mt-2 text-xs text-emerald-700">{aviso}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
