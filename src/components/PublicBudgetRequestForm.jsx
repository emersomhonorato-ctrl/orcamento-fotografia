import { useState } from "react";
import { supabase } from "@/supabase";

// Página pública: o cliente abre pelo link enviado no WhatsApp e pede um orçamento.
// Só faz INSERT na tabela budget_requests (o banco não permite ler pedidos sem login).

const STUDIO_NAME = "Emerson Honorato Retratos";
const SERVICES = [
  "Casamento",
  "Ensaio feminino",
  "Ensaio de casal",
  "Gestante",
  "Família",
  "Newborn / infantil",
  "Aniversário",
  "15 anos",
  "Formatura",
  "Evento corporativo",
  "Vídeo",
  "Outro",
];
const HOW_FOUND = ["Instagram", "Indicação", "Google", "Já sou cliente", "Outro"];

const emptyForm = {
  name: "",
  whatsapp: "",
  email: "",
  service: "",
  event_date: "",
  event_time: "",
  location: "",
  people: "",
  details: "",
  how_found: "",
  website: "", // armadilha para robôs (campo invisível)
};

function formatPhoneInput(value) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function Field({ label, hint, required, children }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-800">
        {label}
        {required ? <span className="text-[#b08a3c]"> *</span> : null}
      </span>
      {hint ? <span className="mt-0.5 block text-xs text-slate-500">{hint}</span> : null}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#c4a050] focus:ring-4 focus:ring-[#c4a050]/15";

export default function PublicBudgetRequestForm() {
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [errorMessage, setErrorMessage] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  const update = (field) => (event) => {
    const value = field === "whatsapp" ? formatPhoneInput(event.target.value) : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");

    if (form.website) {
      setStatus("sent"); // robô: finge sucesso e não grava nada
      return;
    }
    if (form.name.trim().length < 2) {
      setErrorMessage("Informe seu nome.");
      return;
    }
    if (form.whatsapp.replace(/\D/g, "").length < 10) {
      setErrorMessage("Informe um WhatsApp com DDD.");
      return;
    }
    if (!form.service) {
      setErrorMessage("Escolha o tipo de serviço.");
      return;
    }

    setStatus("sending");
    const payload = {
      name: form.name.trim().slice(0, 120),
      whatsapp: form.whatsapp.trim(),
      email: form.email.trim().slice(0, 160) || null,
      service: form.service,
      event_date: form.event_date || null,
      event_time: form.event_time.trim().slice(0, 30) || null,
      location: form.location.trim().slice(0, 160) || null,
      people: form.people.trim().slice(0, 60) || null,
      details: form.details.trim().slice(0, 2000) || null,
      how_found: form.how_found || null,
    };

    const { error } = await supabase.from("budget_requests").insert(payload);
    if (error) {
      setStatus("error");
      setErrorMessage("Não foi possível enviar agora. Tente novamente em instantes ou me chame no WhatsApp.");
      return;
    }
    setStatus("sent");
  }

  return (
    <div className="min-h-screen bg-[#f6f4ef] text-slate-900">
      <header className="bg-[#171b26] px-5 pb-16 pt-10 text-center text-white">
        <img src="/Emerson%20Honorato%20Retratos%20Logo.png" alt={STUDIO_NAME} className="mx-auto h-24 w-24 object-contain" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{STUDIO_NAME}</h1>
        <p className="mt-1 text-xs font-medium uppercase tracking-[0.28em] text-[#c4a050]">Pedido de orçamento</p>
      </header>

      <main className="mx-auto -mt-10 max-w-xl px-4 pb-12">
        <div className="rounded-[28px] bg-white p-6 shadow-[0_20px_50px_rgba(23,27,38,0.12)] sm:p-8">
          {status === "sent" ? (
            <div className="py-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-2xl">✓</div>
              <h2 className="mt-4 text-xl font-semibold">Pedido enviado!</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Obrigado, {form.name.trim().split(" ")[0] || "tudo certo"}! Recebi suas informações e vou te responder pelo WhatsApp com o orçamento o quanto antes.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <p className="text-sm leading-6 text-slate-600">
                Conte um pouco sobre o que você precisa. Leva menos de 2 minutos, e eu te respondo pelo WhatsApp.
              </p>

              <Field label="Seu nome" required>
                <input className={inputClass} value={form.name} onChange={update("name")} autoComplete="name" placeholder="Nome e sobrenome" />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="WhatsApp" required>
                  <input className={inputClass} value={form.whatsapp} onChange={update("whatsapp")} inputMode="tel" autoComplete="tel" placeholder="(48) 99999-9999" />
                </Field>
                <Field label="E-mail">
                  <input className={inputClass} value={form.email} onChange={update("email")} type="email" autoComplete="email" placeholder="opcional" />
                </Field>
              </div>

              <Field label="Tipo de serviço" required>
                <div className="flex flex-wrap gap-2">
                  {SERVICES.map((service) => (
                    <button
                      key={service}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, service }))}
                      className={`rounded-full border px-4 py-2 text-sm transition ${
                        form.service === service
                          ? "border-[#171b26] bg-[#171b26] text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:border-[#c4a050]"
                      }`}
                    >
                      {service}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Data desejada" hint="Se ainda não sabe, deixe em branco">
                  <input className={inputClass} type="date" min={today} value={form.event_date} onChange={update("event_date")} />
                </Field>
                <Field label="Horário" hint="Ex.: 16h, à tarde">
                  <input className={inputClass} value={form.event_time} onChange={update("event_time")} placeholder="opcional" />
                </Field>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Cidade / local">
                  <input className={inputClass} value={form.location} onChange={update("location")} placeholder="Ex.: Criciúma, salão X" />
                </Field>
                <Field label="Nº de pessoas / convidados">
                  <input className={inputClass} value={form.people} onChange={update("people")} placeholder="opcional" />
                </Field>
              </div>

              <Field label="Detalhes" hint="O que você imagina, duração, se quer álbum, vídeo, fotos impressas…">
                <textarea className={`${inputClass} min-h-[120px] resize-y`} value={form.details} onChange={update("details")} maxLength={2000} />
              </Field>

              <Field label="Como conheceu meu trabalho?">
                <select className={inputClass} value={form.how_found} onChange={update("how_found")}>
                  <option value="">Selecione (opcional)</option>
                  {HOW_FOUND.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </Field>

              {/* Campo invisível: pessoas não veem; robôs costumam preencher */}
              <input
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={update("website")}
                className="absolute left-[-9999px] h-0 w-0 opacity-0"
                aria-hidden="true"
              />

              {errorMessage ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p> : null}

              <button
                type="submit"
                disabled={status === "sending"}
                className="w-full rounded-2xl bg-[#171b26] px-5 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-[#232838] disabled:opacity-60"
              >
                {status === "sending" ? "Enviando…" : "Enviar pedido de orçamento"}
              </button>
              <p className="text-center text-xs text-slate-400">Seus dados são usados apenas para responder este pedido.</p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
