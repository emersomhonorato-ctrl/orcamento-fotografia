import { useCallback, useEffect, useMemo, useState } from "react";
import { CreditCard, Copy, Eye, KeyRound, Plus, RefreshCw, Send, Trash2, X, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/supabase";
import { buildWhatsAppLink } from "@/utils/whatsappMessages";
import { formatDateBR } from "@/lib/delivery";
import { PAY_PUBLIC_BASE, PAYMENT_STATUS, brl, installmentLabel, methodLabel } from "@/lib/payments";

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const EMPTY = {
  event_id: "",
  client_name: "",
  client_whatsapp: "",
  client_email: "",
  description: "",
  amount: "",
  max_installments: "12",
  expires_at: "",
};

function parseMoney(value) {
  const text = String(value ?? "").trim().replace(/[^\d,.-]/g, "");
  if (!text) return 0;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  return Math.round(Number(normalized) * 100) / 100 || 0;
}

export default function PaymentsAdmin({ records = [] }) {
  const [items, setItems] = useState([]);
  const [state, setState] = useState("loading");
  const [mp, setMp] = useState(null);
  const [tokenDraft, setTokenDraft] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [form, setForm] = useState(null);
  const [filter, setFilter] = useState("todas");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    const [{ data, error }, statusRes] = await Promise.all([
      supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.rpc("admin_mp_status"),
    ]);
    if (error) {
      setState(/does not exist|PGRST205|42P01/i.test(`${error.code} ${error.message}`) ? "missing" : "error");
      return;
    }
    setItems(data || []);
    if (!statusRes.error) setMp(statusRes.data || { configured: false });
    setState("ready");
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    const interval = setInterval(load, 60000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [load]);

  const agendaOptions = useMemo(
    () =>
      (records || [])
        .filter((item) => item.status !== "Cancelado")
        .sort((a, b) => String(b.eventDate || b.createdAt || "").localeCompare(String(a.eventDate || a.createdAt || "")))
        .slice(0, 120),
    [records],
  );

  const summary = useMemo(() => {
    const monthKey = new Date().toISOString().slice(0, 7);
    const paid = items.filter((item) => item.status === "pago");
    const month = paid.filter((item) => String(item.paid_at || "").slice(0, 7) === monthKey);
    return {
      waiting: items.filter((item) => item.status === "pendente").reduce((sum, item) => sum + Number(item.amount || 0), 0),
      monthGross: month.reduce((sum, item) => sum + Number(item.paid_amount || item.amount || 0), 0),
      monthNet: month.reduce((sum, item) => sum + Number(item.net_amount || item.paid_amount || item.amount || 0), 0),
      monthCount: month.length,
    };
  }, [items]);

  const visible = items.filter((item) => (filter === "todas" ? true : filter === "pagas" ? item.status === "pago" : item.status === "pendente"));

  async function saveToken() {
    const token = String(tokenDraft || "").trim();
    setBusy("token");
    setMessage("");
    const { data, error } = await supabase.rpc("admin_set_mp_token", { p_token: token });
    setBusy("");
    if (error) return setMessage(error.message);
    setMp(data);
    setTokenDraft(null);
    setMessage(token ? "Pronto! Pagamento com cartão ativado ✅" : "Chave removida. O botão de cartão some das páginas.");
  }

  function fillFromEvent(eventId) {
    const record = agendaOptions.find((item) => String(item.id) === String(eventId));
    if (!record) return setForm((current) => ({ ...current, event_id: "" }));
    const remaining = Math.max(0, Number(record.amount || 0) - Number(record.amountPaid || 0));
    setForm((current) => ({
      ...current,
      event_id: String(record.id),
      client_name: record.clientName || current.client_name,
      client_whatsapp: record.whatsapp || record.phone || current.client_whatsapp,
      client_email: record.email || current.client_email,
      description:
        current.description ||
        [record.eventType || "Serviço fotográfico", record.eventDate ? formatDateBR(record.eventDate) : ""].filter(Boolean).join(" — "),
      amount: current.amount || (remaining ? String(remaining).replace(".", ",") : ""),
    }));
  }

  async function create() {
    const amount = parseMoney(form.amount);
    const name = form.client_name.trim();
    const description = form.description.trim();
    if (!name) return setMessage("Coloque o nome do cliente.");
    if (!description) return setMessage("Descreva o que está sendo cobrado (ex.: Sinal do casamento).");
    if (amount < 1) return setMessage("Coloque um valor de pelo menos R$ 1,00.");
    setBusy("create");
    setMessage("");
    const { data, error } = await supabase
      .from("payments")
      .insert({
        kind: "avulso",
        event_id: form.event_id || null,
        client_name: name,
        client_whatsapp: form.client_whatsapp.trim() || null,
        client_email: form.client_email.trim() || null,
        description,
        amount,
        max_installments: Math.min(12, Math.max(1, Number(form.max_installments) || 1)),
        expires_at: form.expires_at ? new Date(`${form.expires_at}T23:59:00`).toISOString() : null,
      })
      .select()
      .single();
    setBusy("");
    if (error) return setMessage(`Não consegui criar a cobrança: ${error.message}`);
    setForm(null);
    setItems((current) => [data, ...current]);
    setMessage("Cobrança criada! Agora é só enviar o link pelo WhatsApp.");
  }

  function linkFor(item) {
    return `${PAY_PUBLIC_BASE}${item.slug}`;
  }

  async function copy(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 1800);
    } catch {
      window.prompt("Copie:", text);
    }
  }

  function sendWhatsApp(item) {
    const first = String(item.client_name).trim().split(/\s+/)[0];
    const text = [
      `Oi, ${first}! Tudo bem? 😊`,
      `Segue o link para pagamento de *${item.description}* — *${brl(item.amount)}*.`,
      `Você pode pagar no cartão (${installmentLabel(item.amount, item.max_installments)}) ou Pix, na página segura do Mercado Pago:`,
      linkFor(item),
      "Assim que pagar, eu já recebo a confirmação automaticamente. Obrigado! 📸",
    ].join("\n\n");
    const url = item.client_whatsapp ? buildWhatsAppLink(item.client_whatsapp, text) : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener");
  }

  async function refresh(item) {
    setBusy(`r-${item.id}`);
    const { data, error } = await supabase.rpc("admin_payment_refresh", { p_id: item.id });
    setBusy("");
    if (error) return setMessage(error.message);
    setMessage(
      data === "pago"
        ? `${item.client_name}: pagamento confirmado ✅`
        : data === "sem pagamento"
          ? `${item.client_name}: ainda não pagou.`
          : `${item.client_name}: ${data}`,
    );
    load();
  }

  async function cancel(item) {
    if (!window.confirm(`Cancelar a cobrança de ${item.client_name}? O link deixa de funcionar.`)) return;
    const { error } = await supabase.from("payments").update({ status: "cancelado", updated_at: new Date().toISOString() }).eq("id", item.id);
    if (error) return setMessage(error.message);
    load();
  }

  async function remove(item) {
    if (!window.confirm(`Excluir a cobrança de ${item.client_name}?`)) return;
    const { error } = await supabase.from("payments").delete().eq("id", item.id);
    if (error) return setMessage(error.message);
    setItems((current) => current.filter((row) => row.id !== item.id));
  }

  if (state === "loading") return <p className="py-10 text-center text-slate-500">Carregando cobranças…</p>;
  if (state === "missing") return <p className="py-10 text-center text-amber-700">A tabela de cobranças ainda não foi criada no banco.</p>;
  if (state === "error") return <p className="py-10 text-center text-red-700">Não foi possível carregar as cobranças agora.</p>;

  return (
    <div className="space-y-6">
      <Card className="rounded-[28px] border-sky-100 shadow-sm">
        <CardContent className="space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-600 text-white"><CreditCard className="h-5 w-5" /></span>
            <div className="flex-1">
              <p className="font-semibold text-slate-900">Pagamento com cartão — Mercado Pago</p>
              <p className="text-sm text-slate-500">
                {mp?.configured
                  ? `Ativado${mp.account ? ` • conta ${mp.account}` : ""} • chave terminando em ${mp.tail}${mp.test ? " (chave de TESTE)" : ""}`
                  : "Ainda não ativado. Cole o Access Token do Mercado Pago para liberar o botão de cartão."}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${mp?.configured ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
              {mp?.configured ? "Ativo" : "Desligado"}
            </span>
            {tokenDraft === null ? (
              <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setTokenDraft("")}>
                <KeyRound className="mr-1.5 h-3.5 w-3.5" />{mp?.configured ? "Trocar chave" : "Colar chave"}
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => setShowHelp((v) => !v)}>Como pegar a chave</Button>
          </div>

          {tokenDraft !== null ? (
            <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-slate-50 p-3">
              <div className="min-w-[260px] flex-1 space-y-1">
                <Label>Access Token (começa com APP_USR-)</Label>
                <Input type="password" autoComplete="off" className="rounded-2xl font-mono" placeholder="APP_USR-…" value={tokenDraft} onChange={(e) => setTokenDraft(e.target.value)} />
              </div>
              <Button className="rounded-2xl" disabled={busy === "token" || !tokenDraft.trim()} onClick={saveToken}>{busy === "token" ? "Conferindo…" : "Salvar e ativar"}</Button>
              {mp?.configured ? (
                <Button variant="outline" className="rounded-2xl text-red-700" disabled={busy === "token"} onClick={() => { if (window.confirm("Desligar o pagamento com cartão?")) { setTokenDraft(""); setTimeout(saveToken, 0); } }}>Desligar</Button>
              ) : null}
              <Button variant="ghost" className="rounded-2xl" onClick={() => setTokenDraft(null)}><X className="h-4 w-4" /></Button>
              <p className="w-full text-xs text-slate-500">A chave fica guardada só no banco de dados, nunca aparece para o cliente nem nesta tela depois de salva.</p>
            </div>
          ) : null}

          {showHelp ? (
            <ol className="list-decimal space-y-1 rounded-2xl bg-sky-50/70 p-4 pl-8 text-sm leading-6 text-slate-700">
              <li>Entre em <a className="font-medium text-sky-700 underline" href="https://www.mercadopago.com.br/developers/panel/app" target="_blank" rel="noopener noreferrer">mercadopago.com.br/developers/panel/app</a> com a conta do Mercado Pago do estúdio.</li>
              <li>Clique em <strong>Criar aplicação</strong>. Nome: “EH Estúdio”. Tipo de pagamento: <strong>Pagamentos online</strong> → <strong>Checkout Pro</strong>.</li>
              <li>Dentro da aplicação, abra <strong>Credenciais de produção</strong> (pode pedir para preencher o ramo do negócio e o site: use orcamento.emersonhonoratoretratos.com.br).</li>
              <li>Copie o <strong>Access Token</strong> (o texto longo que começa com <code>APP_USR-</code>) — não é a “Public Key”.</li>
              <li>Volte aqui, clique em <strong>Colar chave</strong>, cole e clique em <strong>Salvar e ativar</strong>.</li>
            </ol>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Recebido no mês</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{brl(summary.monthGross)}</p>
          <p className="text-xs text-slate-500">{summary.monthCount} pagamento{summary.monthCount === 1 ? "" : "s"}</p>
        </div>
        <div className="rounded-3xl border border-sky-100 bg-sky-50/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Cai na conta (sem taxas)</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{brl(summary.monthNet)}</p>
          <p className="text-xs text-slate-500">valor líquido do mês</p>
        </div>
        <div className="rounded-3xl border border-amber-100 bg-amber-50/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Aguardando pagamento</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{brl(summary.waiting)}</p>
          <p className="text-xs text-slate-500">links enviados e não pagos</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[
          ["todas", "Todas"],
          ["abertas", "Aguardando"],
          ["pagas", "Pagas"],
        ].map(([value, label]) => (
          <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full px-4 py-1.5 text-sm font-medium ${filter === value ? "bg-slate-900 text-white" : "bg-white text-slate-600 shadow-sm"}`}>{label}</button>
        ))}
        <div className="flex-1" />
        <Button className="rounded-2xl" disabled={!mp?.configured} title={mp?.configured ? "" : "Ative o Mercado Pago primeiro"} onClick={() => setForm({ ...EMPTY, expires_at: addDays(7) })}>
          <Plus className="mr-1.5 h-4 w-4" />Nova cobrança
        </Button>
      </div>

      {message ? <p className="rounded-2xl bg-slate-50 px-4 py-2 text-sm text-slate-700">{message}</p> : null}

      {form ? (
        <Card className="rounded-[28px] border-slate-200 shadow-sm">
          <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Puxar dados da agenda/orçamento (opcional)</Label>
              <select className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm" value={form.event_id} onChange={(e) => fillFromEvent(e.target.value)}>
                <option value="">— Digitar manualmente —</option>
                {agendaOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.eventDate ? formatDateBR(item.eventDate) : "sem data"} — {item.clientName || "Sem nome"} — {item.eventType || "Serviço"}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1"><Label>Nome do cliente</Label><Input className="rounded-2xl" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></div>
            <div className="space-y-1"><Label>WhatsApp</Label><Input className="rounded-2xl" value={form.client_whatsapp} onChange={(e) => setForm({ ...form, client_whatsapp: e.target.value })} /></div>
            <div className="space-y-1 sm:col-span-2"><Label>O que está cobrando</Label><Input className="rounded-2xl" placeholder="Ex.: Sinal do casamento 14/03/2027" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="space-y-1"><Label>Valor (R$)</Label><Input className="rounded-2xl" inputMode="decimal" placeholder="Ex.: 1.500,00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div className="space-y-1">
              <Label>Parcelar em até</Label>
              <select className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm" value={form.max_installments} onChange={(e) => setForm({ ...form, max_installments: e.target.value })}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n === 1 ? "1x (só à vista)" : `${n}x`}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1"><Label>E-mail (opcional)</Label><Input className="rounded-2xl" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} /></div>
            <div className="space-y-1"><Label>Link vale até</Label><Input type="date" className="rounded-2xl" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} /></div>
            <p className="text-xs text-slate-500 sm:col-span-2">As taxas do Mercado Pago (e dos juros do parcelamento, conforme sua configuração lá) são descontadas do valor que cai na sua conta.</p>
            <div className="flex gap-2 sm:col-span-2">
              <Button className="rounded-2xl" disabled={busy === "create"} onClick={create}>{busy === "create" ? "Criando…" : "Criar cobrança"}</Button>
              <Button variant="outline" className="rounded-2xl" onClick={() => setForm(null)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!visible.length ? (
        <p className="rounded-3xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
          {items.length ? "Nada nesse filtro." : "Nenhuma cobrança ainda. As reservas de ensaio pagas no cartão também aparecem aqui."}
        </p>
      ) : (
        <div className="space-y-3">
          {visible.map((item) => {
            const expired = item.status === "pendente" && item.expires_at && new Date(item.expires_at) < new Date();
            const status = PAYMENT_STATUS[expired ? "vencido" : item.status] || PAYMENT_STATUS.pendente;
            return (
              <Card key={item.id} className="rounded-[24px] border-slate-100 shadow-sm">
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-[220px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${status.className}`}>{status.label}</span>
                      {item.kind === "booking" ? <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">Reserva de ensaio</span> : null}
                      <span className="font-semibold text-slate-900">{item.client_name}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Criada {formatDateBR(String(item.created_at).slice(0, 10))}
                      {item.status === "pago" && item.paid_at
                        ? ` • paga ${new Date(item.paid_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}${item.payment_method ? ` no ${methodLabel(item.payment_method)}` : ""}${Number(item.installments) > 1 ? ` em ${item.installments}x` : ""}`
                        : item.mp_status && item.mp_status !== "approved"
                          ? ` • tentativa: ${item.mp_status === "rejected" ? "cartão recusado" : item.mp_status === "in_process" || item.mp_status === "pending" ? "em análise" : item.mp_status}`
                          : ""}
                    </p>
                    {item.note ? <p className="mt-1 rounded-xl bg-amber-50 px-2 py-1 text-xs text-amber-900">⚠️ {item.note}</p> : null}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900">{brl(item.amount)}</p>
                    {item.status === "pago" && item.net_amount ? <p className="text-xs text-slate-500">cai {brl(item.net_amount)}</p> : <p className="text-xs text-slate-400">até {item.max_installments}x</p>}
                  </div>
                  <div className="flex w-full flex-wrap gap-1.5 sm:w-auto">
                    {item.status === "pendente" && !expired ? (
                      <>
                        <Button size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={() => sendWhatsApp(item)}><Send className="mr-1.5 h-3.5 w-3.5" />WhatsApp</Button>
                        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => copy(linkFor(item), item.id)}><Copy className="mr-1.5 h-3.5 w-3.5" />{copied === item.id ? "Copiado!" : "Link"}</Button>
                        <Button size="sm" variant="ghost" className="rounded-xl" title="Conferir no Mercado Pago agora" disabled={busy === `r-${item.id}`} onClick={() => refresh(item)}><RefreshCw className={`h-3.5 w-3.5 ${busy === `r-${item.id}` ? "animate-spin" : ""}`} /></Button>
                        <Button size="sm" variant="ghost" className="rounded-xl" title="Cancelar cobrança" onClick={() => cancel(item)}><XCircle className="h-3.5 w-3.5" /></Button>
                      </>
                    ) : null}
                    <Button size="sm" variant="ghost" className="rounded-xl" title="Ver como o cliente vê" onClick={() => window.open(`${window.location.origin}/pagar/${item.slug}`, "_blank", "noopener")}><Eye className="h-3.5 w-3.5" /></Button>
                    {item.status !== "pago" ? <Button size="sm" variant="ghost" className="rounded-xl text-red-600" title="Excluir" onClick={() => remove(item)}><Trash2 className="h-3.5 w-3.5" /></Button> : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
