// Caixinhas de aceite (LGPD) usadas nos formulários públicos
export function LegalLinks({ className = "" }) {
  return (
    <p className={`text-center text-xs text-slate-500 ${className}`}>
      <a href="/privacidade" target="_blank" rel="noreferrer" className="underline hover:text-slate-800">Política de Privacidade</a>
      {" · "}
      <a href="/termos" target="_blank" rel="noreferrer" className="underline hover:text-slate-800">Termos de uso</a>
    </p>
  );
}

export default function LegalConsent({ privacy, marketing, onChange }) {
  return (
    <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm">
      <label className="flex cursor-pointer items-start gap-2.5">
        <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#7a1712]" checked={privacy} onChange={(event) => onChange({ privacy: event.target.checked })} />
        <span>
          Li e aceito a <a href="/privacidade" target="_blank" rel="noreferrer" className="font-medium text-[#7a1712] underline">Política de Privacidade</a> e os{" "}
          <a href="/termos" target="_blank" rel="noreferrer" className="font-medium text-[#7a1712] underline">Termos de uso</a>. <span className="text-[#b3261e]">*</span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-2.5">
        <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#7a1712]" checked={marketing} onChange={(event) => onChange({ marketing: event.target.checked })} />
        <span className="text-slate-600">Quero receber novidades, promoções e uma surpresa no meu aniversário 🎁 (opcional — dá para cancelar quando quiser).</span>
      </label>
    </div>
  );
}
