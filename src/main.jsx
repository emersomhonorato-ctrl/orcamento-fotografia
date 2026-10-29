import { Component, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import PublicBudgetRequestForm from "./components/PublicBudgetRequestForm.jsx";
import PublicChristmasBooking from "./components/PublicChristmasBooking.jsx";
import PublicPhotoDelivery from "./components/PublicPhotoDelivery.jsx";
import PublicBudgetApproval from "./components/PublicBudgetApproval.jsx";
import PublicContractSign from "./components/PublicContractSign.jsx";
import PublicPhotoSelection from "./components/PublicPhotoSelection.jsx";
import PublicPayment from "./components/PublicPayment.jsx";

// Formulário público de pedido (fora do login):
// https://orcamento.emersonhonoratoretratos.com.br/pedido  (ou /?pedido)
// Agenda pública de ensaios temáticos: https://orcamento.emersonhonoratoretratos.com.br/ensaio (também /natal)
const isPublicChristmasBooking = /^\/(natal|ensaio|ensaios)\/?$/i.test(window.location.pathname);
// Entrega de fotos: https://orcamento.emersonhonoratoretratos.com.br/entrega/<codigo>
const deliveryMatch = window.location.pathname.match(/^\/entrega\/([a-z0-9-]{4,80})\/?$/i);
// Aprovação de orçamento: https://orcamento.emersonhonoratoretratos.com.br/orcamento/<codigo>
// Contrato para assinar: https://orcamento.emersonhonoratoretratos.com.br/contrato/<codigo>
const contractMatch = window.location.pathname.match(/^\/contrato\/([a-z0-9-]{4,80})\/?$/i);
const budgetMatch = window.location.pathname.match(/^\/orcamento\/([a-z0-9-]{4,80})\/?$/i);
// Escolha de fotos: https://orcamento.emersonhonoratoretratos.com.br/selecao/<codigo>
const selectionMatch = window.location.pathname.match(/^\/selecao\/([a-z0-9-]{4,80})\/?$/i);
// Pagamento: https://orcamento.emersonhonoratoretratos.com.br/pagar/<codigo>
const paymentMatch = window.location.pathname.match(/^\/pagar\/([a-z0-9-]{4,80})\/?$/i);
const isPublicRequestForm =
  /^\/pedido\/?$/i.test(window.location.pathname) || new URLSearchParams(window.location.search).has("pedido");

class PreviewErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slate-100 px-6 py-10 text-slate-900">
          <div className="mx-auto max-w-3xl rounded-[28px] border border-red-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-500">Preview error</p>
            <h1 className="mt-3 text-2xl font-semibold">O preview React encontrou um erro</h1>
            <p className="mt-3 text-sm text-slate-600">
              Isso não altera a versão segura. O erro abaixo ajuda a gente a corrigir só o código local.
            </p>
            <pre className="mt-5 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-sm leading-6 text-slate-100">
              {String(this.state.error?.stack || this.state.error?.message || this.state.error)}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PreviewErrorBoundary>
      {paymentMatch ? <PublicPayment slug={paymentMatch[1].toLowerCase()} /> : selectionMatch ? <PublicPhotoSelection slug={selectionMatch[1].toLowerCase()} /> : deliveryMatch ? <PublicPhotoDelivery slug={deliveryMatch[1].toLowerCase()} /> : contractMatch ? <PublicContractSign slug={contractMatch[1].toLowerCase()} /> : budgetMatch ? <PublicBudgetApproval slug={budgetMatch[1].toLowerCase()} /> : isPublicChristmasBooking ? <PublicChristmasBooking /> : isPublicRequestForm ? <PublicBudgetRequestForm /> : <App />}
    </PreviewErrorBoundary>
  </StrictMode>,
);

// App instalável (Mac, Windows, celular): registra o service worker só na versão publicada
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
