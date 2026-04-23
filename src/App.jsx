import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Briefcase,
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock3,
  FileText,
  Image as ImageIcon,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Save,
  Search,
  Trash2,
  User,
  Wallet,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import ClientModal from "@/components/ClientModal";
import EventModal from "@/components/EventModal";
import ServiceModal from "@/components/ServiceModal";
import {
  EVENT_STATUS_OPTIONS,
  PAYMENT_OPTIONS,
  STORAGE_KEY,
  defaultSettings,
  defaultForm,
  defaultServiceForm,
  deriveRecordType,
  emptyClient,
  getDefaultStatus,
  getStatusOptions,
  getSuggestedContractTemplate,
  normalizeAppState,
  normalizeClient,
  normalizeRecord,
  normalizeService,
  readLocalAppState,
  robustContractTemplate,
} from "@/lib/appModel";
import { loadAppState, saveAppState } from "@/lib/appState";
import { supabase } from "@/supabase";
import { generateBudgetPDF, generateContractPDF, generateEventPDF, generateReceiptPDF } from "@/utils/pdfGenerator";
import {
  buildCommunicationMessage,
  buildCommunicationSubject,
  buildEmailTemplate,
  combineDateTime,
  diffInDays,
  formatCurrency,
  formatDateBR,
  getItemsTotal,
  getTodayLocalISO,
  isConflict,
  normalizeItems,
} from "@/utils/formatters";

const AUTH_ENABLED = String(import.meta.env.VITE_AUTH_ENABLED || "false").trim().toLowerCase() === "true";
const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || "emersomhonorato@gmail.com").trim().toLowerCase();

function StatusBadge({ value }) {
  const map = {
    Pendente: "bg-amber-100 text-amber-800 border-amber-200",
    Confirmado: "bg-blue-100 text-blue-800 border-blue-200",
    "Em negociação": "bg-sky-100 text-sky-800 border-sky-200",
    Aprovado: "bg-emerald-100 text-emerald-800 border-emerald-200",
    Concluído: "bg-emerald-100 text-emerald-800 border-emerald-200",
    Cancelado: "bg-red-100 text-red-800 border-red-200",
    Pago: "bg-emerald-100 text-emerald-800 border-emerald-200",
    "Entrada paga": "bg-violet-100 text-violet-800 border-violet-200",
    Atrasado: "bg-red-100 text-red-800 border-red-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
        map[value] || "bg-slate-100 text-slate-800 border-slate-200"
      }`}
    >
      {value}
    </span>
  );
}

function MetricCard({ title, value, subtitle, icon }) {
  const IconComponent = icon;
  const displayValue = String(value ?? "");
  const valueClassName = displayValue.length > 10 ? "text-[1.55rem]" : displayValue.length > 7 ? "text-[1.8rem]" : "text-[2rem]";

  return (
    <Card className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_16px_38px_rgba(15,23,42,0.09)]">
      <CardContent className="p-0">
        <div className="h-px w-full bg-gradient-to-r from-[#f3d675] via-[#f6df95] to-transparent" />
        <div className="relative min-h-[210px] px-7 py-6">
          <div className="absolute right-7 top-8 flex h-[54px] w-[54px] items-center justify-center rounded-full border border-[#f3d675] bg-white shadow-[0_8px_18px_rgba(243,214,117,0.12)]">
            <IconComponent className="h-5 w-5 text-slate-600" />
          </div>
          <div className="min-w-0 pr-20">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">{title}</p>
            <p className={`mt-5 whitespace-nowrap font-semibold leading-none tracking-tight text-slate-900 ${valueClassName}`}>{value}</p>
            {subtitle ? <p className="mt-4 max-w-[15ch] text-[13px] leading-6 text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CalendarMini({ events, selectedDate, onSelectDate }) {
  const today = getTodayLocalISO();
  const baseDate = useMemo(() => {
    return selectedDate ? new Date(`${selectedDate}T12:00:00`) : new Date(`${today}T12:00:00`);
  }, [selectedDate, today]);

  const month = baseDate.getMonth();
  const year = baseDate.getFullYear();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekDay = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const days = [];
  for (let i = 0; i < startWeekDay; i += 1) days.push(null);
  for (let day = 1; day <= totalDays; day += 1) days.push(day);

  const eventCountByDate = useMemo(() => {
    const next = new Map();
    events.forEach((event) => {
      if (!event.eventDate || event.recordType !== "evento") return;
      next.set(event.eventDate, (next.get(event.eventDate) || 0) + 1);
    });
    return next;
  }, [events]);

  const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(baseDate);

  function isoForDay(day) {
    const monthValue = String(month + 1).padStart(2, "0");
    const dayValue = String(day).padStart(2, "0");
    return `${year}-${monthValue}-${dayValue}`;
  }

  return (
    <Card className="studio-panel rounded-3xl border-0 shadow-sm backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg capitalize">
          <CalendarDays className="h-5 w-5" />
          {monthName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500">
          {["D", "S", "T", "Q", "Q", "S", "S"].map((dayLabel, index) => (
            <div key={`${dayLabel}-${index}`}>{dayLabel}</div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-2">
          {days.map((day, index) => {
            if (!day) return <div key={`empty-${index}`} className="h-10 rounded-xl" />;

            const iso = isoForDay(day);
            const count = eventCountByDate.get(iso) || 0;
            const active = selectedDate === iso;
            const isToday = iso === today;

            return (
              <button
                key={iso}
                type="button"
                onClick={() => onSelectDate(iso)}
                className={`relative h-10 rounded-xl border text-sm font-medium transition hover:scale-[1.02] ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : isToday
                      ? "border-slate-300 bg-slate-100 text-slate-900"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {day}
                {count > 0 ? (
                  <span
                    className={`absolute bottom-1 right-1 inline-flex h-2.5 w-2.5 rounded-full ${
                      active ? "bg-white" : "bg-slate-900"
                    }`}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function buildClientMatchKey(client = {}) {
  const email = String(client.email || "").trim().toLowerCase();
  if (email) return `email:${email}`;

  const phone = String(client.phone || client.whatsapp || "").replace(/\D/g, "");
  if (phone) return `phone:${phone}`;

  const name = String(client.name || client.clientName || "").trim().toLowerCase();
  if (name) return `name:${name}`;

  return `id:${client.id || crypto.randomUUID()}`;
}

function normalizePhoneDigits(value = "") {
  return String(value || "").replace(/\D/g, "");
}

export default function App() {
  const [appState, setAppState] = useState(readLocalAppState);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(AUTH_ENABLED);
  const [authError, setAuthError] = useState("");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [clientForm, setClientForm] = useState(emptyClient);
  const [serviceForm, setServiceForm] = useState(defaultServiceForm);
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState(getTodayLocalISO());
  const [selectedMonth, setSelectedMonth] = useState(getTodayLocalISO().slice(0, 7));
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [typeFilter, setTypeFilter] = useState("Todos");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedContractId, setSelectedContractId] = useState("");
  const [selectedReceiptId, setSelectedReceiptId] = useState("");
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [hasHydratedRemote, setHasHydratedRemote] = useState(false);
  const [syncStatus, setSyncStatus] = useState("Carregando dados");
  const [syncMessage, setSyncMessage] = useState("Verificando local e nuvem.");

  const { events, clients, services, settings } = appState;
  const userEmail = session?.user?.email?.toLowerCase() || "";
  const isAuthorized = !AUTH_ENABLED || (Boolean(session?.user) && (!ADMIN_EMAIL || userEmail === ADMIN_EMAIL));

  useEffect(() => {
    if (!AUTH_ENABLED) return undefined;

    let mounted = true;

    async function bootstrapAuth() {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        setSession(initialSession);
        setAuthError("");
      } catch (error) {
        if (!mounted) return;
        setAuthError(error?.message || "Não foi possível validar a sessão no Supabase.");
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
      }
    }

    bootstrapAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authLoading || !isAuthorized) return undefined;

    let alive = true;

    async function hydrate() {
      const result = await loadAppState();
      if (!alive) return;

      if (result.data) {
        setAppState(normalizeAppState(result.data));
      }

      setSyncStatus(result.source === "supabase" ? "Sincronizado com Supabase" : "Usando armazenamento local");
      setSyncMessage(result.message);
      setHasHydratedRemote(true);
    }

    hydrate();

    return () => {
      alive = false;
    };
  }, [authLoading, isAuthorized]);

  useEffect(() => {
    if (!isAuthorized) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  }, [appState, isAuthorized]);

  useEffect(() => {
    if (!hasHydratedRemote || !isAuthorized) return undefined;

    const timer = window.setTimeout(async () => {
      const result = await saveAppState(appState);
      setSyncStatus(result.source === "supabase" ? "Sincronizado com Supabase" : "Usando armazenamento local");
      setSyncMessage(result.message);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [appState, hasHydratedRemote, isAuthorized]);

  const eventTypes = useMemo(() => services.map((service) => service.name).filter(Boolean), [services]);

  const monthLabel = useMemo(() => {
    return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
      new Date(`${selectedMonth}-01T12:00:00`),
    );
  }, [selectedMonth]);

  const records = useMemo(() => events.map(normalizeRecord), [events]);

  const enrichedRecords = useMemo(() => {
    return records.map((record) => {
      const computedAmount = record.items.length > 0 ? getItemsTotal(record.items) : Number(record.amount || 0);

      return {
        ...record,
        computedAmount,
        hasConflict: record.recordType === "evento" ? records.some((other) => isConflict(record, other)) : false,
        daysLeft: diffInDays(record.eventDate),
        balance: Math.max(computedAmount - Number(record.amountPaid || 0), 0),
      };
    });
  }, [records]);

  const onlyEvents = useMemo(
    () => enrichedRecords.filter((record) => record.recordType === "evento"),
    [enrichedRecords],
  );

  const onlyBudgets = useMemo(
    () => enrichedRecords.filter((record) => record.recordType === "orcamento"),
    [enrichedRecords],
  );

  const filteredEvents = useMemo(() => {
    return onlyEvents
      .filter((record) => {
        const haystack = [
          record.clientName,
          record.email,
          record.phone,
          record.whatsapp,
          record.eventType,
          record.location,
          record.notes,
          record.packageName,
          record.budgetDescription,
        ]
          .join(" ")
          .toLowerCase();

        const matchesSearch = haystack.includes(search.toLowerCase());
        const matchesStatus = statusFilter === "Todos" ? true : record.status === statusFilter;
        const matchesType = typeFilter === "Todos" ? true : record.eventType === typeFilter;
        return matchesSearch && matchesStatus && matchesType;
      })
      .sort((a, b) => {
        const aDate = combineDateTime(a.eventDate, a.startTime || "00:00")?.getTime() || 0;
        const bDate = combineDateTime(b.eventDate, b.startTime || "00:00")?.getTime() || 0;
        return aDate - bDate;
      });
  }, [onlyEvents, search, statusFilter, typeFilter]);

  const selectedDayEvents = useMemo(
    () => onlyEvents.filter((record) => record.eventDate === selectedDate),
    [onlyEvents, selectedDate],
  );

  const nextUpcomingEvent = useMemo(() => {
    return filteredEvents[0] || null;
  }, [filteredEvents]);

  const selectedDayRevenue = useMemo(
    () => selectedDayEvents.reduce((sum, record) => sum + Number(record.computedAmount || record.amount || 0), 0),
    [selectedDayEvents],
  );

  const uniqueClientsFromEvents = useMemo(() => {
    const safeClients = Array.isArray(clients) ? clients : [];
    const safeRecords = Array.isArray(records) ? records : [];
    const fromRegistered = safeClients.filter(Boolean).map((client) => normalizeClient(client));
    const registeredKeys = new Set(fromRegistered.map((client) => buildClientMatchKey(client)));

    const eventDerived = Array.from(
      new Map(
        safeRecords.filter(Boolean).map((record) => [
          record.clientId || record.email || `${record.clientName}-${record.phone}`,
          {
            id: record.clientId || record.id,
            name: record.clientName,
            cpf: record.clientCpf || "",
            email: record.email,
            phone: record.phone,
            whatsapp: record.whatsapp,
            city: "",
            address: record.clientAddress || "",
            instagram: "",
            notes: record.notes,
          },
        ]),
      ).values(),
    ).map((client) => normalizeClient(client));

    const merged = new Map();

    eventDerived.forEach((client) => {
      merged.set(buildClientMatchKey(client), client);
    });

    fromRegistered.forEach((client) => {
      const key = buildClientMatchKey(client);
      merged.set(key, { ...(merged.get(key) || {}), ...client });
    });

    return Array.from(merged.values())
      .filter((client) => client && typeof client === "object")
      .map((client) => {
        const normalizedClient = normalizeClient(client);

        return {
          ...normalizedClient,
          isRegistered: registeredKeys.has(buildClientMatchKey(normalizedClient)),
        };
      });
  }, [clients, records]);

  const budgetPipeline = useMemo(() => {
    return {
      pending: onlyBudgets.filter((record) => record.status === "Pendente").length,
      negotiation: onlyBudgets.filter((record) => record.status === "Em negociação").length,
      approved: onlyBudgets.filter((record) => record.status === "Aprovado").length,
      canceled: onlyBudgets.filter((record) => record.status === "Cancelado").length,
    };
  }, [onlyBudgets]);

  const commercialActions = useMemo(() => {
    const reminderDays = Number(settings.reminderDaysBefore || 0);
    const agendaActions = onlyEvents
      .filter((record) => {
        if (record.status === "Cancelado") return false;
        if (record.daysLeft === 0) return settings.reminderSameDay && !record.sameDayReminderSent;
        if (reminderDays > 0 && record.daysLeft === reminderDays) return !record.reminderSent;
        return false;
      })
      .map((record) => ({
        id: `event-${record.id}`,
        type: record.daysLeft === 0 ? "lembrete_hoje" : "lembrete",
        title: record.daysLeft === 0 ? "Lembrete de hoje" : "Lembrete agendado",
        description: `${record.clientName} · ${record.eventType} · ${record.eventDate ? formatDateBR(record.eventDate) : "Sem data"}`,
        record,
      }));

    const budgetActions = onlyBudgets
      .filter((record) => ["Pendente", "Em negociação"].includes(record.status))
      .slice(0, 4)
      .map((record) => ({
        id: `budget-${record.id}`,
        type: "proposta",
        title: "Follow-up de proposta",
        description: `${record.clientName} · ${record.eventType || "Orçamento"} · ${formatCurrency(record.computedAmount)}`,
        record,
      }));

    const paymentActions = onlyEvents
      .filter((record) => record.status !== "Cancelado" && Number(record.balance || 0) > 0)
      .slice(0, 4)
      .map((record) => ({
        id: `payment-${record.id}`,
        type: "cobranca",
        title: "Cobrança pendente",
        description: `${record.clientName} · saldo ${formatCurrency(record.balance)}`,
        record,
      }));

    return [...agendaActions, ...budgetActions, ...paymentActions].slice(0, 6);
  }, [onlyEvents, onlyBudgets, settings.reminderDaysBefore, settings.reminderSameDay]);

  const contractRecords = useMemo(
    () => enrichedRecords.filter((record) => record.clientName || record.eventType || record.packageName),
    [enrichedRecords],
  );

  const receiptRecords = useMemo(
    () => onlyEvents.filter((record) => Number(record.amountPaid || 0) > 0),
    [onlyEvents],
  );

  const selectedContract = useMemo(() => {
    return contractRecords.find((record) => record.id === selectedContractId) || contractRecords[0] || null;
  }, [contractRecords, selectedContractId]);

  const selectedReceipt = useMemo(() => {
    return receiptRecords.find((record) => record.id === selectedReceiptId) || receiptRecords[0] || null;
  }, [receiptRecords, selectedReceiptId]);

  const contractPreview = useMemo(() => {
    if (!selectedContract) return "";

    const template = settings.contractTemplate || "";
    if (!template.trim()) return "";

    const amountValue = Number(selectedContract.computedAmount || selectedContract.amount || 0);
    const amountPaidValue = Number(selectedContract.amountPaid || 0);
    const balanceValue = Math.max(amountValue - amountPaidValue, 0);
    const fallback = (value, emptyValue = "a combinar") => {
      const normalized = String(value ?? "").trim();
      return normalized || emptyValue;
    };
    const startHour = selectedContract.startTime ? Number(selectedContract.startTime.split(":")[0] || 0) : null;
    const startMinute = selectedContract.startTime ? Number(selectedContract.startTime.split(":")[1] || 0) : null;
    const endHour = selectedContract.endTime ? Number(selectedContract.endTime.split(":")[0] || 0) : null;
    const endMinute = selectedContract.endTime ? Number(selectedContract.endTime.split(":")[1] || 0) : null;
    const hasDuration = Number.isFinite(startHour) && Number.isFinite(startMinute) && Number.isFinite(endHour) && Number.isFinite(endMinute);
    const eventDuration = hasDuration
      ? (() => {
          const startTotal = startHour * 60 + startMinute;
          const endTotal = endHour * 60 + endMinute;
          const diffMinutes = Math.max(endTotal - startTotal, 0);
          const hours = diffMinutes / 60;
          return hours > 0 ? String(hours).replace(".5", ",5") : "a combinar";
        })()
      : "a combinar";
    const rawCurrency = (value) => formatCurrency(value).replace(/^R\$\s?/, "");
    const deliveryTerms = (selectedContract.contractDeliveryTerms || "").trim();
    const prazoEntrega = deliveryTerms.match(/\d+/)?.[0] || String(selectedContract.recommendedDeliveryDays || "15");
    const quantidadeFotos = String(selectedContract.editedPhotosCount || selectedContract.onlinePhotosCount || selectedContract.printedPhotosCount || selectedContract.digitalPhotosCount || "a combinar");
    const formaEntrega = (() => {
      if (!deliveryTerms) return "galeria online";

      const sanitized = deliveryTerms
        .replace(/\b(em|até)\s+\d+\s*(dias?|dias úteis|uteis)\b/gi, "")
        .replace(/\b\d+\s*(dias?|dias úteis|uteis)\b/gi, "")
        .replace(/[.,;:-]\s*$/g, "")
        .trim();

      return sanitized || "galeria online";
    })();
    const dataPagamento = balanceValue > 0 ? "na quitação do saldo" : formatDateBR(getTodayLocalISO());
    const companyAddress = settings.contractCity || settings.studioCity || settings.studioAddress || "Endereço do estúdio a definir";
    const clientAddress = selectedContract.clientAddress || selectedContract.location || "Endereço a informar";
    const eventDate = selectedContract.eventDate ? formatDateBR(selectedContract.eventDate) : "a combinar";
    const eventType = selectedContract.eventType || selectedContract.packageName || "ensaio fotográfico";
    const eventLocation = selectedContract.location || "local a combinar";
    const clientName = selectedContract.clientName || "Cliente não informado";
    const clientCpf = selectedContract.clientCpf || "não informado";
    const clientEmail = selectedContract.email || "não informado";
    const clientPhone = selectedContract.whatsapp || selectedContract.phone || "não informado";
    const paymentTerms = selectedContract.contractPaymentMethod || settings.paymentTerms || "Forma de pagamento a combinar.";
    const contractCity = settings.contractCity || settings.studioCity || "Cidade não informada";
    const contractForum = settings.contractForum || contractCity;
    const imageAuthorization = settings.contractImageAuthorization
      || "O CONTRATANTE autoriza o uso das imagens para portfólio e divulgação, salvo manifestação contrária por escrito.";
    const matchedService = services.find(
      (service) => service.name === selectedContract.eventType || service.name === selectedContract.packageName,
    );
    const serviceDescription = fallback(
      selectedContract.serviceDescriptionSnapshot
      || matchedService?.workDescription
      || matchedService?.itemDescription
      || selectedContract.budgetDescription,
      "Descrição específica do serviço a definir em proposta ou briefing aprovado.",
    );
    const serviceItemsBlock = (() => {
      const explicitLines = [
        selectedContract.serviceItemsSnapshot,
        matchedService?.itemDescription,
        selectedContract.serviceDescriptionSnapshot,
        matchedService?.workDescription,
        selectedContract.budgetDescription,
      ]
        .filter(Boolean)
        .flatMap((text) =>
          String(text)
            .split(/\n+/)
            .map((line) => line.trim())
            .filter(Boolean),
        );

      const uniqueLines = Array.from(new Set(explicitLines));

      if (uniqueLines.length > 0) {
        return uniqueLines.map((line) => `- ${line}`).join("\n");
      }

      return [
        "- Cobertura fotográfica conforme tempo contratado",
        "- Direção durante o ensaio/evento",
        "- Seleção e tratamento profissional das imagens",
        "- Entrega digital das fotografias em alta resolução",
      ].join("\n");
    })();

    const replacements = {
      studioName: fallback(settings.studioName, "Emerson Honorato Retratos"),
      studioResponsible: fallback(settings.studioResponsible, "Emerson Honorato"),
      studioDocument: fallback(settings.studioDocument, "não informado"),
      studioPhone: fallback(settings.studioPhone, "não informado"),
      studioEmail: fallback(settings.studioEmail, "não informado"),
      studioCity: fallback(settings.studioCity, contractCity),
      clientName,
      clientCpf,
      clientEmail,
      clientPhone,
      clientAddress,
      eventType,
      eventDate,
      startTime: fallback(selectedContract.startTime),
      endTime: fallback(selectedContract.endTime),
      location: eventLocation,
      amount: formatCurrency(amountValue),
      amountPaid: formatCurrency(amountPaidValue),
      balance: formatCurrency(balanceValue),
      paymentTerms: paymentTerms,
      contractPaymentMethod: paymentTerms,
      contractDeliveryTerms: fallback(deliveryTerms),
      notes: fallback(selectedContract.contractNotes || selectedContract.notes, "Sem observações adicionais."),
      currentDate: formatDateBR(getTodayLocalISO()),
      contractCity,
      contractForum,
      packageName: fallback(selectedContract.packageName, eventType),
      NOME_EMPRESA: fallback(settings.studioName, "Emerson Honorato Retratos"),
      RESPONSAVEL_EMPRESA: fallback(settings.studioResponsible, "Emerson Honorato"),
      DOCUMENTO_EMPRESA: fallback(settings.studioDocument, "não informado"),
      TELEFONE_EMPRESA: fallback(settings.studioPhone, "não informado"),
      EMAIL_EMPRESA: fallback(settings.studioEmail, "não informado"),
      ENDERECO_EMPRESA: companyAddress,
      NOME_CLIENTE: clientName,
      CPF_CLIENTE: clientCpf,
      CLIENTE_TELEFONE: clientPhone,
      CLIENTE_EMAIL: clientEmail,
      ENDERECO_CLIENTE: clientAddress,
      TIPO_EVENTO: eventType,
      DATA_EVENTO: eventDate,
      LOCAL_EVENTO: eventLocation,
      HORAS_EVENTO: eventDuration,
      QUANTIDADE_FOTOS: quantidadeFotos,
      FORMA_ENTREGA: formaEntrega,
      PRAZO_ENTREGA: prazoEntrega,
      VALOR_TOTAL: rawCurrency(amountValue),
      VALOR_SINAL: rawCurrency(amountPaidValue),
      DATA_PAGAMENTO: dataPagamento,
      FORMA_PAGAMENTO_CONTRATO: paymentTerms,
      CONDICAO_PAGAMENTO_CONTRATO: paymentTerms,
      AUTORIZACAO_IMAGEM: imageAuthorization,
      DESCRICAO_SERVICO: serviceDescription,
      ITENS_SERVICO_CONTRATADO: serviceItemsBlock,
      CIDADE: contractCity,
      DATA_ATUAL: formatDateBR(getTodayLocalISO()),
    };

    return template.replace(/\{\{(\w+)\}\}|\{([A-Z_]+)\}/g, (_match, camelKey, legacyKey) => {
      const key = camelKey || legacyKey;
      return replacements[key] ?? "";
    });
  }, [selectedContract, settings, services]);

  const contractPreviewBlocks = useMemo(() => {
    if (!contractPreview) return [];

    let seenFirstBody = false;

    return contractPreview
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        if (index === 0) {
          return { type: "title", text: line };
        }

        if (/^\d+\.\s/.test(line) || line === "ASSINATURAS") {
          return { type: "section", text: line };
        }

        if (line.endsWith(":") && line.length <= 42) {
          return { type: "label", text: line };
        }

        if (!seenFirstBody) {
          seenFirstBody = true;
          return { type: "intro", text: line };
        }

        if (line.length <= 68 && !/[.!?]$/.test(line) && !/[,:;]$/.test(line)) {
          return { type: "bullet", text: line };
        }

        return { type: "body", text: line };
      });
  }, [contractPreview]);

  const metrics = useMemo(() => {
    const [selectedYear, selectedMonthNumber] = selectedMonth.split("-").map(Number);

    const monthEvents = onlyEvents.filter((record) => {
      if (!record.eventDate) return false;
      const date = new Date(`${record.eventDate}T12:00:00`);
      return date.getMonth() === selectedMonthNumber - 1 && date.getFullYear() === selectedYear;
    });

    const totalRevenue = onlyEvents.reduce((sum, record) => sum + Number(record.computedAmount || record.amount || 0), 0);
    const received = onlyEvents.reduce((sum, record) => sum + Number(record.amountPaid || 0), 0);
    const pending = Math.max(totalRevenue - received, 0);
    const potentialRevenue = onlyBudgets
      .filter((record) => record.status !== "Cancelado")
      .reduce((sum, record) => sum + Number(record.computedAmount || record.amount || 0), 0);

    const conversionBase = onlyEvents.length + onlyBudgets.length;
    const conversionRate = conversionBase > 0 ? Math.round((onlyEvents.length / conversionBase) * 100) : 0;

    return {
      totalEvents: onlyEvents.length,
      monthEvents: monthEvents.length,
      confirmedEvents: onlyEvents.filter((record) => ["Confirmado", "Concluído"].includes(record.status)).length,
      totalRevenue,
      received,
      pending,
      openBudgets: onlyBudgets.filter((record) => ["Pendente", "Em negociação"].includes(record.status)).length,
      potentialRevenue,
      conversionRate,
      totalClients: uniqueClientsFromEvents.length,
      totalServices: services.length,
    };
  }, [onlyBudgets, onlyEvents, selectedMonth, services.length, uniqueClientsFromEvents.length]);

  function changeSelectedMonth(direction) {
    const baseDate = new Date(`${selectedMonth}-01T12:00:00`);
    baseDate.setMonth(baseDate.getMonth() + direction);
    const year = baseDate.getFullYear();
    const month = String(baseDate.getMonth() + 1).padStart(2, "0");
    const nextMonth = `${year}-${month}`;

    setSelectedMonth(nextMonth);
    setSelectedDate(`${nextMonth}-01`);
  }

  function updateAppState(partial) {
    setAppState((current) => normalizeAppState({ ...current, ...partial }));
  }

  const findMatchingClient = useCallback((candidate = {}, ignoreId = "") => {
    const candidateEmail = String(candidate.email || "").trim().toLowerCase();
    const candidatePhone = normalizePhoneDigits(candidate.phone || candidate.whatsapp || "");
    const candidateWhatsapp = normalizePhoneDigits(candidate.whatsapp || candidate.phone || "");
    const candidateName = String(candidate.name || candidate.clientName || "").trim().toLowerCase();

    return clients.find((client) => {
      if (ignoreId && client.id === ignoreId) return false;

      const clientEmail = String(client.email || "").trim().toLowerCase();
      const clientPhone = normalizePhoneDigits(client.phone || "");
      const clientWhatsapp = normalizePhoneDigits(client.whatsapp || "");
      const clientName = String(client.name || "").trim().toLowerCase();

      if (candidateEmail && clientEmail && candidateEmail === clientEmail) return true;
      if (candidatePhone && (candidatePhone === clientPhone || candidatePhone === clientWhatsapp)) return true;
      if (candidateWhatsapp && (candidateWhatsapp === clientPhone || candidateWhatsapp === clientWhatsapp)) return true;
      if (candidateName && clientName && candidateName === clientName && (candidatePhone || candidateWhatsapp || candidateEmail)) return true;

      return false;
    }) || null;
  }, [clients]);

  const matchedFormClient = (() => {
    if (form.clientId) {
      return clients.find((client) => client.id === form.clientId) || null;
    }

    return findMatchingClient({
      name: form.clientName,
      email: form.email,
      phone: form.phone,
      whatsapp: form.whatsapp,
    });
  })();

  function buildServiceBudgetItem(service) {
    if (!service) return null;

    return {
      id: crypto.randomUUID(),
      type: "Serviço",
      name: service.name || "",
      description: service.itemDescription || service.workDescription || "",
      quantity: 1,
      unitPrice: Number(service.price || 0),
    };
  }

  function shouldAutofillServiceItem(items = []) {
    if (!Array.isArray(items) || items.length === 0) return true;

    return items.every((item) => {
      const normalized = item && typeof item === "object" ? item : {};
      const quantity = Number(normalized.quantity || 0);
      const unitPrice = Number(normalized.unitPrice || 0);

      return !String(normalized.name || "").trim() &&
        !String(normalized.description || "").trim() &&
        quantity <= 1 &&
        unitPrice === 0;
    });
  }

  function getServiceSuggestedStatus(service, recordType) {
    if (!service) return "";
    return recordType === "orcamento" ? service.defaultBudgetStatus || "Pendente" : service.defaultEventStatus || "Confirmado";
  }

  function getServiceSuggestedNotes(service, recordType) {
    if (!service) return "";
    return recordType === "orcamento"
      ? service.defaultBudgetNotes || service.defaultNotes || ""
      : service.defaultEventNotes || service.defaultNotes || "";
  }

  function shouldApplySuggestedStatus(currentStatus, recordType) {
    const baseline = getDefaultStatus(recordType);
    return !String(currentStatus || "").trim() || currentStatus === baseline;
  }

  function shouldApplySuggestedPaymentStatus(currentPaymentStatus) {
    return !String(currentPaymentStatus || "").trim() || currentPaymentStatus === "Pendente";
  }

  function buildServiceDeliveryTerms(service, currentTerms = "") {
    if (!service) return currentTerms;
    if (String(service.contractDeliveryTerms || "").trim()) return service.contractDeliveryTerms;
    if (Number(service.recommendedDeliveryDays || 0) > 0) {
      return `Entrega em galeria online no prazo de até ${Number(service.recommendedDeliveryDays)} dias.`;
    }
    return currentTerms;
  }

  function resetEventForm() {
    setForm(defaultForm);
  }

  function resetClientForm() {
    setClientForm(emptyClient);
  }

  function resetServiceForm() {
    setServiceForm(defaultServiceForm);
  }

  function openNewEventModal(prefilledDate = "") {
    const firstService = services[0];
    const initialItem = buildServiceBudgetItem(firstService);
    const suggestedNotes = getServiceSuggestedNotes(firstService, "evento");
    setForm({
      ...defaultForm,
      recordType: "evento",
      eventDate: prefilledDate || selectedDate || getTodayLocalISO(),
      eventType: firstService?.name || "",
      amount: firstService?.price ? String(firstService.price) : "",
      budgetDescription: firstService?.workDescription || "",
      packageName: firstService?.name || "",
      serviceDescriptionSnapshot: firstService?.workDescription || "",
      serviceItemsSnapshot: firstService?.itemDescription || "",
      onlinePhotosCount: String(firstService?.onlinePhotosCount || ""),
      editedPhotosCount: String(firstService?.editedPhotosCount || ""),
      photoSize: firstService?.photoSize || "",
      contractPaymentMethod: firstService?.contractPaymentMethod || settings.paymentTerms || "",
      contractDeliveryTerms: buildServiceDeliveryTerms(firstService, ""),
      contractNotes: firstService?.defaultContractNotes || "",
      notes: suggestedNotes,
      budgetValidityDays: firstService?.defaultBudgetValidityDays ? String(firstService.defaultBudgetValidityDays) : "",
      recommendedDeliveryDays: firstService?.recommendedDeliveryDays ? String(firstService.recommendedDeliveryDays) : "",
      receiptReference: firstService?.defaultReceiptReference || "",
      receiptMethod: firstService?.defaultReceiptMethod || "",
      status: getServiceSuggestedStatus(firstService, "evento"),
      paymentStatus: firstService?.defaultPaymentStatus || "Pendente",
      items: initialItem ? [initialItem] : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setIsEventModalOpen(true);
  }

  function openNewBudgetModal() {
    setForm({
      ...defaultForm,
      recordType: "orcamento",
      eventType: "",
      amount: "",
      budgetDescription: "",
      packageName: "",
      serviceDescriptionSnapshot: "",
      serviceItemsSnapshot: "",
      onlinePhotosCount: "",
      editedPhotosCount: "",
      photoSize: "",
      contractPaymentMethod: settings.paymentTerms || "",
      contractDeliveryTerms: "",
      contractNotes: "",
      notes: "",
      budgetValidityDays: String(settings.budgetValidityDays || 7),
      recommendedDeliveryDays: "",
      receiptReference: "",
      receiptMethod: "",
      status: "Pendente",
      paymentStatus: "Pendente",
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setIsEventModalOpen(true);
  }

  function editEvent(record) {
    setForm({
      ...defaultForm,
      ...record,
      amount: String(record.computedAmount || record.amount || ""),
      amountPaid: String(record.amountPaid || ""),
      onlinePhotosCount: String(record.onlinePhotosCount || ""),
      editedPhotosCount: String(record.editedPhotosCount || ""),
      photoSize: record.photoSize || "",
      contractNotes: record.contractNotes || "",
      digitalPhotosCount: String(record.digitalPhotosCount || ""),
      printedPhotosCount: String(record.printedPhotosCount || ""),
      items: normalizeItems(record.items || []),
    });
    setIsEventModalOpen(true);
  }

  function saveEvent() {
    if (!form.clientName || !form.eventType) {
      alert("Preencha pelo menos cliente e tipo de trabalho.");
      return;
    }

    if (form.recordType === "evento" && !form.eventDate) {
      alert("Informe a data do agendamento.");
      return;
    }

    const items = normalizeItems(form.items || []);
    const totalFromItems = getItemsTotal(items);
    const recordType = deriveRecordType(form);
    const statusOptions = getStatusOptions(recordType);
    const matchedClient = findMatchingClient({
      name: form.clientName,
      email: form.email,
      phone: form.phone,
      whatsapp: form.whatsapp,
    });

    const payload = normalizeRecord({
      ...form,
      id: form.id || crypto.randomUUID(),
      clientId: matchedClient?.id || form.clientId || "",
      clientName: matchedClient?.name || form.clientName,
      clientCpf: matchedClient?.cpf || form.clientCpf,
      clientAddress: matchedClient?.address || form.clientAddress,
      email: matchedClient?.email || form.email,
      phone: matchedClient?.phone || form.phone,
      whatsapp: matchedClient?.whatsapp || form.whatsapp,
      recordType,
      amount: Number(totalFromItems > 0 ? totalFromItems : form.amount || 0),
      amountPaid: Number(form.amountPaid || 0),
      serviceDescriptionSnapshot: form.serviceDescriptionSnapshot || form.budgetDescription || "",
      serviceItemsSnapshot: form.serviceItemsSnapshot || "",
      onlinePhotosCount: Number(form.onlinePhotosCount || 0),
      editedPhotosCount: Number(form.editedPhotosCount || 0),
      photoSize: form.photoSize || "",
      budgetValidityDays: Number(form.budgetValidityDays || 0),
      recommendedDeliveryDays: Number(form.recommendedDeliveryDays || 0),
      digitalPhotosCount: Number(form.digitalPhotosCount || 0),
      printedPhotosCount: Number(form.printedPhotosCount || 0),
      items,
      status: statusOptions.includes(form.status) ? form.status : getDefaultStatus(recordType),
      eventDate: recordType === "orcamento" ? form.eventDate || "" : form.eventDate,
      createdAt: form.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    updateAppState({
      events: appState.events.some((item) => item.id === payload.id)
        ? appState.events.map((item) => (item.id === payload.id ? payload : item))
        : [...appState.events, payload],
    });

    setIsEventModalOpen(false);
    resetEventForm();
  }

  function getRecordForBudgetPDF(record) {
    const service = services.find((item) => item.name === record.eventType || item.name === record.packageName);

    return {
      ...record,
      onlinePhotosCount: record.onlinePhotosCount || service?.onlinePhotosCount || 0,
      editedPhotosCount: record.editedPhotosCount || service?.editedPhotosCount || 0,
      photoSize: record.photoSize || service?.photoSize || "",
      budgetValidityDays: record.budgetValidityDays || service?.defaultBudgetValidityDays || settings.budgetValidityDays || 7,
    };
  }

  function getRecordForEventPDF(record) {
    const service = services.find((item) => item.name === record.eventType || item.name === record.packageName);

    return {
      ...record,
      contractPaymentMethod: record.contractPaymentMethod || service?.contractPaymentMethod || settings.paymentTerms || "",
      contractDeliveryTerms: record.contractDeliveryTerms || service?.contractDeliveryTerms || "",
      onlinePhotosCount: record.onlinePhotosCount || service?.onlinePhotosCount || 0,
      editedPhotosCount: record.editedPhotosCount || service?.editedPhotosCount || 0,
      photoSize: record.photoSize || service?.photoSize || "",
      recommendedDeliveryDays: record.recommendedDeliveryDays || service?.recommendedDeliveryDays || 0,
      receiptMethod: record.receiptMethod || service?.defaultReceiptMethod || "",
      serviceDescriptionSnapshot: record.serviceDescriptionSnapshot || service?.workDescription || record.budgetDescription || "",
    };
  }

  function removeEvent(id) {
    updateAppState({
      events: appState.events.filter((item) => item.id !== id),
    });
  }

  function markCommunicationSent(record, kind) {
    if (!record?.id) return;
    if (kind !== "lembrete" && kind !== "lembrete_hoje") return;

    updateRecordFields(record.id, kind === "lembrete_hoje" ? { sameDayReminderSent: true } : { reminderSent: true });
  }

  function approveBudget(record) {
    updateAppState({
      events: appState.events.map((item) => {
        if (item.id !== record.id) return item;

        return normalizeRecord({
          ...item,
          recordType: "evento",
          status: "Confirmado",
          paymentStatus: item.paymentStatus || "Pendente",
          eventDate: item.eventDate || getTodayLocalISO(),
          updatedAt: new Date().toISOString(),
        });
      }),
    });

    setActiveTab("agenda");
  }

  function markAsPaid(record) {
    updateAppState({
      events: appState.events.map((item) =>
        item.id === record.id
          ? {
              ...item,
              amountPaid: Number(record.computedAmount || record.amount || 0),
              paymentStatus: "Pago",
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    });
  }

  function updateRecordFields(recordId, fields) {
    updateAppState({
      events: appState.events.map((item) =>
        item.id === recordId
          ? normalizeRecord({
              ...item,
              ...fields,
              updatedAt: new Date().toISOString(),
            })
          : item,
      ),
    });
  }

  function openNewClientModal() {
    setClientForm(emptyClient);
    setIsClientModalOpen(true);
  }

  function editClient(client) {
    setClientForm(normalizeClient(client));
    setIsClientModalOpen(true);
  }

  function saveClient() {
    if (!clientForm.name) {
      alert("Informe pelo menos o nome do cliente.");
      return;
    }

    const matchedClient = findMatchingClient(clientForm, clientForm.id || "");
    const payload = normalizeClient({
      ...matchedClient,
      ...clientForm,
      id: clientForm.id || matchedClient?.id || crypto.randomUUID(),
    });

    updateAppState({
      clients: appState.clients.some((item) => item.id === payload.id)
        ? appState.clients.map((item) => (item.id === payload.id ? payload : item))
        : [...appState.clients, payload],
    });

    setIsClientModalOpen(false);
    resetClientForm();
  }

  function removeClient(id) {
    updateAppState({
      clients: appState.clients.filter((item) => item.id !== id),
    });
  }

  function openNewServiceModal() {
    setServiceForm(defaultServiceForm);
    setIsServiceModalOpen(true);
  }

  function editService(service) {
    setServiceForm({ ...normalizeService(service), price: String(service.price || "") });
    setIsServiceModalOpen(true);
  }

  function saveService() {
    if (!serviceForm.name) {
      alert("Informe o nome do trabalho.");
      return;
    }

    const payload = normalizeService({
      ...serviceForm,
      id: serviceForm.id || crypto.randomUUID(),
      price: Number(serviceForm.price || 0),
      onlinePhotosCount: Number(serviceForm.onlinePhotosCount || 0),
      editedPhotosCount: Number(serviceForm.editedPhotosCount || 0),
      photoSize: serviceForm.photoSize || "",
      contractPaymentMethod: serviceForm.contractPaymentMethod || "",
      contractDeliveryTerms: serviceForm.contractDeliveryTerms || "",
      defaultNotes: serviceForm.defaultNotes || "",
      defaultReceiptReference: serviceForm.defaultReceiptReference || "",
      defaultEventStatus: serviceForm.defaultEventStatus || "Confirmado",
      defaultBudgetStatus: serviceForm.defaultBudgetStatus || "Pendente",
      defaultPaymentStatus: serviceForm.defaultPaymentStatus || "Pendente",
      defaultEventNotes: serviceForm.defaultEventNotes || "",
      defaultBudgetNotes: serviceForm.defaultBudgetNotes || "",
      defaultContractNotes: serviceForm.defaultContractNotes || "",
      defaultBudgetValidityDays: Number(serviceForm.defaultBudgetValidityDays || 0),
      defaultReceiptMethod: serviceForm.defaultReceiptMethod || "",
      recommendedDeliveryDays: Number(serviceForm.recommendedDeliveryDays || 0),
    });

    updateAppState({
      services: appState.services.some((item) => item.id === payload.id)
        ? appState.services.map((item) => (item.id === payload.id ? payload : item))
        : [...appState.services, payload],
    });

    setIsServiceModalOpen(false);
    resetServiceForm();
  }

  function removeService(id) {
    updateAppState({
      services: appState.services.filter((item) => item.id !== id),
    });
  }

  function applyClientToEvent(clientId) {
    const client = clients.find((item) => item.id === clientId);

    setForm((current) => ({
      ...current,
      clientId,
      clientName: client?.name || current.clientName,
      clientCpf: client?.cpf || current.clientCpf,
      clientAddress: client?.address || current.clientAddress,
      email: client?.email || current.email,
      phone: client?.phone || current.phone,
      whatsapp: client?.whatsapp || current.whatsapp,
      notes: current.notes || client?.notes || "",
    }));
  }

  function applyServiceToEvent(serviceName) {
    const service = services.find((item) => item.name === serviceName);
    const nextItem = buildServiceBudgetItem(service);

    setForm((current) => ({
      ...current,
      eventType: serviceName,
      packageName: service?.name || current.packageName,
      amount: service ? String(service.price) : current.amount,
      budgetDescription: service?.workDescription || current.budgetDescription,
      serviceDescriptionSnapshot: service?.workDescription || current.serviceDescriptionSnapshot,
      serviceItemsSnapshot: service?.itemDescription || current.serviceItemsSnapshot,
      onlinePhotosCount: service ? String(service.onlinePhotosCount || "") : current.onlinePhotosCount,
      editedPhotosCount: service ? String(service.editedPhotosCount || "") : current.editedPhotosCount,
      photoSize: service?.photoSize || current.photoSize,
      contractPaymentMethod: service?.contractPaymentMethod || current.contractPaymentMethod,
      contractDeliveryTerms: buildServiceDeliveryTerms(service, current.contractDeliveryTerms),
      contractNotes: current.contractNotes || service?.defaultContractNotes || "",
      notes: current.notes || getServiceSuggestedNotes(service, current.recordType) || "",
      budgetValidityDays: current.budgetValidityDays || (current.recordType === "orcamento" && service?.defaultBudgetValidityDays ? String(service.defaultBudgetValidityDays) : current.budgetValidityDays),
      recommendedDeliveryDays: current.recommendedDeliveryDays || (service?.recommendedDeliveryDays ? String(service.recommendedDeliveryDays) : ""),
      receiptReference: current.receiptReference || service?.defaultReceiptReference || "",
      receiptMethod: current.receiptMethod || service?.defaultReceiptMethod || "",
      status: shouldApplySuggestedStatus(current.status, current.recordType)
        ? getServiceSuggestedStatus(service, current.recordType)
        : current.status,
      paymentStatus: shouldApplySuggestedPaymentStatus(current.paymentStatus)
        ? service?.defaultPaymentStatus || current.paymentStatus
        : current.paymentStatus,
      items: nextItem && shouldAutofillServiceItem(current.items) ? [nextItem] : current.items,
    }));
  }

  function addEmptyItem(type = "Serviço") {
    setForm((current) => ({
      ...current,
      items: [
        ...(current.items || []),
        {
          id: crypto.randomUUID(),
          type,
          name: "",
          description: "",
          quantity: 1,
          unitPrice: 0,
        },
      ],
    }));
  }

  function addServiceItem(serviceId) {
    const service = services.find((item) => item.id === serviceId);
    if (!service) return;

    setForm((current) => ({
      ...current,
      items: [
        ...(current.items || []),
        {
          id: crypto.randomUUID(),
          type: "Serviço",
          name: service.name,
          description: service.itemDescription || "",
          quantity: 1,
          unitPrice: Number(service.price || 0),
        },
      ],
    }));
  }

  function updateItem(itemId, field, value) {
    setForm((current) => ({
      ...current,
      items: (current.items || []).map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: field === "quantity" || field === "unitPrice" ? Number(value || 0) : value,
            }
          : item,
      ),
    }));
  }

  function removeItem(itemId) {
    setForm((current) => ({
      ...current,
      items: (current.items || []).filter((item) => item.id !== itemId),
    }));
  }

  function duplicateItem(itemId) {
    const original = (form.items || []).find((item) => item.id === itemId);
    if (!original) return;

    setForm((current) => ({
      ...current,
      items: [
        ...(current.items || []),
        {
          ...original,
          id: crypto.randomUUID(),
          name: original.name ? `${original.name} (cópia)` : "",
        },
      ],
    }));
  }

  function sendWhatsApp(record, kind = "confirmacao") {
    const phone = (record.whatsapp || record.phone || "").replace(/\D/g, "");
    if (!phone) {
      alert("Este cliente não possui telefone ou WhatsApp cadastrado.");
      return;
    }

    const text = encodeURIComponent(buildCommunicationMessage(record, settings, kind));
    window.open(`https://wa.me/55${phone}?text=${text}`, "_blank");
    markCommunicationSent(record, kind);
  }

  function sendEmail(record, kind = "confirmacao") {
    if (!record.email) {
      alert("Este cliente não possui e-mail cadastrado.");
      return;
    }

    const subject = encodeURIComponent(buildCommunicationSubject(record, settings, kind));
    const body = encodeURIComponent(buildCommunicationMessage(record, settings, kind));
    window.open(`mailto:${record.email}?subject=${subject}&body=${body}`, "_blank");
    markCommunicationSent(record, kind);
  }

  function handleLogoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      updateAppState({
        settings: { ...settings, logoDataUrl: String(reader.result || "") },
      });
    };
    reader.readAsDataURL(file);
  }

  function handleSignatureUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      updateAppState({
        settings: { ...settings, signatureDataUrl: String(reader.result || "") },
      });
    };
    reader.readAsDataURL(file);
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(appState, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `backup-agenda-master-${getTodayLocalISO()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function importBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const parsed = JSON.parse(String(loadEvent.target?.result || "{}"));
        setAppState(normalizeAppState(parsed));
        alert("Backup importado com sucesso.");
      } catch {
        alert("Arquivo inválido.");
      }
    };
    reader.readAsText(file);
  }

  async function handleManualSync() {
    setSyncStatus("Sincronizando...");
    setSyncMessage("Enviando dados atuais para o Supabase.");
    const result = await saveAppState(appState);
    setSyncStatus(result.source === "supabase" ? "Sincronizado com Supabase" : "Usando armazenamento local");
    setSyncMessage(result.message);
  }

  const currentStatusOptions = getStatusOptions(form.recordType);
  const formItemsTotal = getItemsTotal(form.items || []);
  const displayFormTotal = formItemsTotal > 0 ? formItemsTotal : Number(form.amount || 0);

  function getAgendaMessageType(record) {
    if (record.daysLeft === 0) return "lembrete_hoje";
    if (Number(settings.reminderDaysBefore || 0) > 0 && record.daysLeft === Number(settings.reminderDaysBefore || 0)) return "lembrete";
    if (Number(record.balance || 0) > 0) return "cobranca";
    return "confirmacao";
  }

  function getAgendaMessageLabel(record) {
    const type = getAgendaMessageType(record);
    if (type === "lembrete_hoje") return "Lembrete hoje";
    if (type === "lembrete") return "Lembrete";
    if (type === "cobranca") return "Cobrar saldo";
    return "WhatsApp";
  }

  async function handleLogin(event) {
    event.preventDefault();
    setAuthError("");
    setIsSubmittingLogin(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginForm.email.trim(),
      password: loginForm.password,
    });

    if (error) {
      setAuthError(error.message || "Não foi possível entrar.");
      setIsSubmittingLogin(false);
      return;
    }

    const nextEmail = data.user?.email?.toLowerCase() || "";
    if (ADMIN_EMAIL && nextEmail !== ADMIN_EMAIL) {
      await supabase.auth.signOut();
      setAuthError(`Este sistema aceita apenas o admin ${ADMIN_EMAIL}.`);
      setIsSubmittingLogin(false);
      return;
    }

    setIsSubmittingLogin(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setHasHydratedRemote(false);
    setSyncStatus("Sessão encerrada");
    setSyncMessage("Faça login novamente para acessar o sistema.");
  }

  if (AUTH_ENABLED && authLoading) {
    return (
      <div className="studio-shell min-h-screen text-slate-900" data-theme-color={settings.themeColor || "classico"}>
        <div className="mx-auto flex min-h-screen w-full max-w-[1480px] items-center justify-center p-6">
          <Card className="studio-panel w-full max-w-md rounded-[32px] border-0 shadow-xl">
            <CardContent className="p-8 text-center">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Verificando acesso</p>
              <h1 className="mt-4 text-3xl font-bold text-slate-900">Entrando no sistema</h1>
              <p className="mt-3 text-slate-600">Aguarde enquanto validamos sua sessão.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (AUTH_ENABLED && !session?.user) {
    return (
      <div className="studio-shell min-h-screen text-slate-900" data-theme-color={settings.themeColor || "classico"}>
        <div className="mx-auto flex min-h-screen w-full max-w-[1480px] items-center justify-center p-6">
          <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.15fr,0.85fr]">
            <div className="studio-hero rounded-[36px] px-8 py-10 text-white">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-medium uppercase tracking-[0.25em]">
                <Camera className="h-4 w-4" />
                Acesso restrito
              </div>
              <h1 className="mt-6 text-4xl font-bold tracking-tight">Emerson Honorato Retratos</h1>
              <p className="mt-4 max-w-xl text-base text-slate-200">
                Faça login com o e-mail e a senha do administrador para abrir agenda, clientes, orçamentos e configuração do estúdio.
              </p>
              <div className="mt-8 space-y-3 text-sm text-slate-200">
                <div className="rounded-2xl bg-white/10 px-4 py-3">Acesso protegido por sessão de usuário.</div>
                <div className="rounded-2xl bg-white/10 px-4 py-3">Seu domínio continua o mesmo, mas agora só abre com login.</div>
                {ADMIN_EMAIL ? (
                  <div className="rounded-2xl bg-white/10 px-4 py-3">Admin liberado: {ADMIN_EMAIL}</div>
                ) : (
                  <div className="rounded-2xl bg-white/10 px-4 py-3">Sem filtro de e-mail admin configurado.</div>
                )}
              </div>
            </div>

            <Card className="studio-panel rounded-[32px] border-0 shadow-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-3xl font-bold text-slate-900">Login do administrador</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 p-6 pt-2">
                <form className="space-y-5" onSubmit={handleLogin}>
                  <div className="space-y-2">
                    <Label htmlFor="login-email">E-mail</Label>
                    <Input
                      id="login-email"
                      type="email"
                      value={loginForm.email}
                      onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                      className="rounded-2xl"
                      placeholder="admin@seudominio.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Senha</Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={loginForm.password}
                      onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                      className="rounded-2xl"
                      placeholder="Digite sua senha"
                    />
                  </div>
                {authError ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {authError}
                  </div>
                ) : null}
                  <Button type="submit" className="w-full rounded-2xl" disabled={isSubmittingLogin}>
                    {isSubmittingLogin ? "Entrando..." : "Entrar"}
                  </Button>
                </form>
                <p className="text-sm text-slate-500">
                  Para ativar o acesso por usuário e senha, defina `VITE_AUTH_ENABLED=true` e crie o usuário administrador no Supabase em `Authentication` &gt; `Users`.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (AUTH_ENABLED && !isAuthorized) {
    return (
      <div className="studio-shell min-h-screen text-slate-900" data-theme-color={settings.themeColor || "classico"}>
        <div className="mx-auto flex min-h-screen w-full max-w-[1480px] items-center justify-center p-6">
          <Card className="studio-panel w-full max-w-lg rounded-[32px] border-0 shadow-xl">
            <CardContent className="space-y-4 p-8">
              <h1 className="text-3xl font-bold text-slate-900">Acesso negado</h1>
              <p className="text-slate-600">
                Este sistema está configurado para aceitar apenas o admin {ADMIN_EMAIL}.
              </p>
              <Button onClick={handleLogout} className="rounded-2xl">Sair</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="studio-shell min-h-screen text-slate-900" data-theme-color={settings.themeColor || "classico"}>
      <div className="mx-auto w-full max-w-[1480px] p-4 md:p-8 2xl:px-10">
        <div className="studio-hero mb-8 flex flex-col gap-4 rounded-[32px] px-6 py-8 text-white md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2 text-xs font-medium uppercase tracking-[0.28em] backdrop-blur">
              <Camera className="h-4 w-4" />
              Sistema do estúdio
            </div>
            <h1 className="font-heading text-4xl font-bold tracking-tight md:text-6xl">Emerson Honorato Retratos</h1>
            <p className="mt-4 max-w-4xl text-base leading-8 text-slate-200 md:text-[1.12rem]">
              Uma central elegante para agenda, clientes, serviços e propostas comerciais com PDF refinado, marca própria e leitura rápida do financeiro.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <Badge className="rounded-full bg-white/10 text-white hover:bg-white/10">{syncStatus}</Badge>
              <span>{syncMessage}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => openNewEventModal()} className="rounded-2xl bg-white text-slate-900 hover:bg-slate-100">
              <Plus className="mr-2 h-4 w-4" />
              Novo agendamento
            </Button>
            <Button variant="outline" onClick={openNewBudgetModal} className="rounded-2xl border-white/20 bg-transparent text-white hover:bg-white/10">
              <FileText className="mr-2 h-4 w-4" />
              Novo orçamento
            </Button>
            <Button variant="outline" onClick={exportBackup} className="rounded-2xl border-white/20 bg-transparent text-white hover:bg-white/10">
              <Save className="mr-2 h-4 w-4" />
              Backup
            </Button>
            <Button variant="outline" onClick={handleManualSync} className="rounded-2xl border-white/20 bg-transparent text-white hover:bg-white/10">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Sincronizar
            </Button>
            <label className="inline-flex cursor-pointer items-center rounded-2xl border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
              Importar
              <input type="file" accept="application/json" className="hidden" onChange={importBackup} />
            </label>
            {AUTH_ENABLED ? (
              <Button variant="outline" onClick={handleLogout} className="rounded-2xl border-white/20 bg-transparent text-white hover:bg-white/10">
                <User className="mr-2 h-4 w-4" />
                Sair
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center gap-3 rounded-[24px] border border-white/70 bg-white/80 px-4 py-3 shadow-[0_18px_50px_rgba(40,52,84,0.08)] backdrop-blur">
            <Search className="h-4 w-4 text-slate-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar cliente, serviço, local ou observações"
              className="border-0 p-0 shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] rounded-[22px] border-white/70 bg-white/80 shadow-[0_18px_50px_rgba(40,52,84,0.08)]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos os status</SelectItem>
                {EVENT_STATUS_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[220px] rounded-[22px] border-white/70 bg-white/80 shadow-[0_18px_50px_rgba(40,52,84,0.08)]">
                <SelectValue placeholder="Serviço" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos os serviços</SelectItem>
                {eventTypes.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 rounded-[24px] border border-white/70 bg-white/80 p-2 shadow-[0_18px_50px_rgba(40,52,84,0.08)] backdrop-blur">
            <Button type="button" variant="outline" className="rounded-2xl" onClick={() => changeSelectedMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[190px] rounded-2xl border border-amber-100 bg-gradient-to-r from-amber-50 to-white px-4 py-2 text-center text-sm font-semibold capitalize text-slate-700">
              {monthLabel}
            </div>
            <Button type="button" variant="outline" className="rounded-2xl" onClick={() => changeSelectedMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <input
            type="month"
            value={selectedMonth}
            onChange={(event) => {
              setSelectedMonth(event.target.value);
              setSelectedDate(`${event.target.value}-01`);
            }}
            className="rounded-[22px] border border-white/70 bg-white/80 px-4 py-2 text-sm shadow-[0_18px_50px_rgba(40,52,84,0.08)]"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-4">
          <MetricCard title="Eventos totais" value={metrics.totalEvents} subtitle="Agendamentos ativos" icon={CalendarDays} />
          <MetricCard title="Eventos do mês" value={metrics.monthEvents} subtitle={monthLabel} icon={Clock3} />
          <MetricCard title="Receita prevista" value={formatCurrency(metrics.totalRevenue)} subtitle="Agenda confirmada" icon={Wallet} />
          <MetricCard title="Recebido" value={formatCurrency(metrics.received)} subtitle="Pagamentos lançados" icon={CheckCircle2} />
          <MetricCard title="A receber" value={formatCurrency(metrics.pending)} subtitle="Saldo pendente" icon={AlertTriangle} />
          <MetricCard title="Orçamentos abertos" value={metrics.openBudgets} subtitle="Em andamento" icon={FileText} />
          <MetricCard title="Clientes" value={metrics.totalClients} subtitle="Base cadastrada" icon={User} />
          <MetricCard title="Serviços" value={metrics.totalServices} subtitle="Tabela ativa" icon={Briefcase} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
          <TabsList className="studio-tabs grid w-full grid-cols-4 rounded-2xl p-1 shadow-sm md:grid-cols-8">
            <TabsTrigger value="dashboard" className="rounded-xl">Dashboard</TabsTrigger>
            <TabsTrigger value="agenda" className="rounded-xl">Agenda</TabsTrigger>
            <TabsTrigger value="orcamentos" className="rounded-xl">Orçamentos</TabsTrigger>
            <TabsTrigger value="clientes" className="rounded-xl">Clientes</TabsTrigger>
            <TabsTrigger value="servicos" className="rounded-xl">Serviços</TabsTrigger>
            <TabsTrigger value="contratos" className="rounded-xl">Contratos</TabsTrigger>
            <TabsTrigger value="recibos" className="rounded-xl">Recibos</TabsTrigger>
            <TabsTrigger value="configuracoes" className="rounded-xl">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <div className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
                <div className="overflow-hidden rounded-[34px] border border-rose-200/70 bg-gradient-to-br from-[#fff8fa] via-white to-[#fff4f7] p-6 shadow-[0_28px_70px_rgba(99,32,67,0.14)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full border border-rose-200 bg-white/90 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-700">
                      Dashboard
                    </span>
                    <span className="inline-flex rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600">
                      Visão executiva
                    </span>
                  </div>

                  {nextUpcomingEvent ? (
                    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr,280px]">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-500">Próximo compromisso</p>
                        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
                          {nextUpcomingEvent.clientName}
                        </h2>
                        <p className="mt-2 text-base text-slate-500">{nextUpcomingEvent.eventType}</p>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          <div className="rounded-[24px] border border-rose-100/80 bg-white/90 px-4 py-4 shadow-[0_12px_26px_rgba(99,32,67,0.05)]">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-400">Data</p>
                            <p className="mt-2 text-sm font-medium text-slate-800">
                              {nextUpcomingEvent.eventDate ? formatDateBR(nextUpcomingEvent.eventDate) : "A combinar"}
                            </p>
                          </div>
                          <div className="rounded-[24px] border border-rose-100/80 bg-white/90 px-4 py-4 shadow-[0_12px_26px_rgba(99,32,67,0.05)]">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-400">Horário</p>
                            <p className="mt-2 text-sm font-medium text-slate-800">{nextUpcomingEvent.startTime || "Sem horário"}</p>
                          </div>
                          <div className="rounded-[24px] border border-rose-100/80 bg-white/90 px-4 py-4 shadow-[0_12px_26px_rgba(99,32,67,0.05)]">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-400">Valor</p>
                            <p className="mt-2 text-sm font-medium text-slate-800">{formatCurrency(nextUpcomingEvent.computedAmount)}</p>
                          </div>
                        </div>

                        <div className="mt-4 rounded-[24px] border border-rose-100/80 bg-white/85 px-4 py-4 shadow-[0_12px_26px_rgba(99,32,67,0.05)]">
                          <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                            <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-rose-500" />{nextUpcomingEvent.location || "Local a combinar"}</span>
                            <span className="inline-flex items-center gap-2"><Wallet className="h-4 w-4 text-rose-500" />Pago {formatCurrency(nextUpcomingEvent.amountPaid || 0)}</span>
                          </div>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <Button onClick={() => editEvent(nextUpcomingEvent)} className="rounded-2xl bg-[#7f274f] text-white hover:bg-[#692040]">
                            <Pencil className="mr-2 h-4 w-4" />
                            Revisar agendamento
                          </Button>
                          <Button variant="outline" className="rounded-2xl" onClick={() => generateEventPDF(getRecordForEventPDF(nextUpcomingEvent), settings)}>
                            <FileText className="mr-2 h-4 w-4" />
                            PDF agenda
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-[28px] border border-[#7f274f] bg-gradient-to-br from-[#6b2746] via-[#7c3153] to-[#9a4565] p-5 text-white shadow-[0_20px_44px_rgba(107,39,70,0.28)]">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-rose-100/85">Dia selecionado</p>
                        <p className="mt-3 text-2xl font-semibold">{selectedDate ? formatDateBR(selectedDate) : "Hoje"}</p>
                        <div className="mt-5 space-y-3">
                          <div className="rounded-[22px] bg-white/10 px-4 py-3 backdrop-blur">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-rose-100/80">Compromissos</p>
                            <p className="mt-2 text-2xl font-semibold">{selectedDayEvents.length}</p>
                          </div>
                          <div className="rounded-[22px] bg-white/10 px-4 py-3 backdrop-blur">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-rose-100/80">Receita do dia</p>
                            <p className="mt-2 text-2xl font-semibold">{formatCurrency(selectedDayRevenue)}</p>
                          </div>
                          <div className="rounded-[22px] bg-white/10 px-4 py-3 backdrop-blur">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-rose-100/80">Conversão</p>
                            <p className="mt-2 text-2xl font-semibold">{metrics.conversionRate}%</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6 rounded-[28px] border border-dashed border-rose-200 bg-white/70 p-8 text-center text-slate-500">
                      <p className="font-medium text-slate-700">Nenhum compromisso agendado ainda</p>
                      <p className="mt-2 text-sm">Crie seu primeiro evento para começar a visualizar o painel executivo do estúdio.</p>
                      <Button onClick={() => openNewEventModal(selectedDate)} className="mt-4 rounded-2xl bg-[#7f274f] text-white hover:bg-[#692040]">
                        <Plus className="mr-2 h-4 w-4" />
                        Novo agendamento
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid gap-6">
                  <CalendarMini events={onlyEvents} selectedDate={selectedDate} onSelectDate={setSelectedDate} />

                  <Card className="studio-panel rounded-[30px] border-0 bg-white/90 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <CalendarDays className="h-5 w-5" />
                        Compromissos do dia
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedDayEvents.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
                          <p className="font-medium text-slate-700">Nenhum evento neste dia</p>
                          <p className="mt-2 text-sm">Escolha outro dia no calendário ou crie um novo agendamento.</p>
                        </div>
                      ) : (
                        selectedDayEvents.slice(0, 3).map((record) => (
                          <div key={record.id} className="rounded-[24px] border border-rose-100/80 bg-gradient-to-r from-white to-[#fff9fb] px-4 py-4 shadow-[0_10px_24px_rgba(99,32,67,0.05)]">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{record.clientName}</p>
                                <p className="mt-1 text-xs text-slate-500">{record.eventType}</p>
                              </div>
                              <StatusBadge value={record.status} />
                            </div>
                            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                              <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{record.startTime || "Sem horário"}</span>
                              <span className="inline-flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" />{formatCurrency(record.computedAmount)}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <Card className="studio-panel rounded-[30px] border-0 bg-white/90 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">Pipeline de orçamentos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-[22px] border border-amber-200/60 bg-gradient-to-r from-amber-50 to-white p-4">
                      <span className="text-sm font-medium text-amber-800">Pendentes</span>
                      <strong className="text-2xl text-amber-900">{budgetPipeline.pending}</strong>
                    </div>
                    <div className="flex items-center justify-between rounded-[22px] border border-sky-200/60 bg-gradient-to-r from-sky-50 to-white p-4">
                      <span className="text-sm font-medium text-sky-800">Confirmados</span>
                      <strong className="text-2xl text-sky-900">{budgetPipeline.approved}</strong>
                    </div>
                    <div className="flex items-center justify-between rounded-[22px] border border-rose-200/60 bg-gradient-to-r from-rose-50 to-white p-4">
                      <span className="text-sm font-medium text-rose-800">Cancelados</span>
                      <strong className="text-2xl text-rose-900">{budgetPipeline.canceled}</strong>
                    </div>
                  </CardContent>
                </Card>

                <Card className="studio-panel rounded-[30px] border-0 bg-white/90 shadow-sm md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg">Resumo financeiro</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-[24px] border border-rose-100/70 bg-gradient-to-br from-white to-[#fff8fa] p-5 shadow-[0_10px_24px_rgba(99,32,67,0.05)]">
                      <p className="text-sm text-slate-500">Receita potencial</p>
                      <p className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(metrics.potentialRevenue)}</p>
                    </div>
                    <div className="rounded-[24px] border border-rose-100/70 bg-gradient-to-br from-white to-[#fff8fa] p-5 shadow-[0_10px_24px_rgba(99,32,67,0.05)]">
                      <p className="text-sm text-slate-500">Conversão estimada</p>
                      <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.conversionRate}%</p>
                    </div>
                    <div className="rounded-[24px] border border-rose-100/70 bg-gradient-to-br from-white to-[#fff8fa] p-5 shadow-[0_10px_24px_rgba(99,32,67,0.05)]">
                      <p className="text-sm text-slate-500">Confirmados e concluídos</p>
                      <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.confirmedEvents}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="studio-panel rounded-[30px] border-0 bg-white/90 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Ações comerciais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {commercialActions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
                      <p className="font-medium text-slate-700">Nenhuma ação pendente agora</p>
                      <p className="mt-2 text-sm">Quando houver lembretes, follow-ups de proposta ou cobranças, eles aparecem aqui.</p>
                    </div>
                  ) : (
                    commercialActions.map((action) => (
                      <div key={action.id} className="flex flex-col gap-3 rounded-[24px] border border-rose-100/80 bg-gradient-to-r from-white to-[#fff9fb] px-4 py-4 shadow-[0_10px_24px_rgba(99,32,67,0.05)] lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{action.title}</p>
                          <p className="mt-1 break-words text-sm text-slate-500">{action.description}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" className="rounded-2xl" onClick={() => sendWhatsApp(action.record, action.type)}>
                            <Bell className="mr-2 h-4 w-4" />
                            WhatsApp
                          </Button>
                          <Button variant="outline" className="rounded-2xl" onClick={() => sendEmail(action.record, action.type)}>
                            <Mail className="mr-2 h-4 w-4" />
                            E-mail
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="agenda" className="mt-6">
            <div className="space-y-6">
              <div className="overflow-hidden rounded-[32px] border border-rose-200/70 bg-gradient-to-r from-[#fff7f8] via-white to-[#fff3f6] p-5 shadow-[0_22px_60px_rgba(99,32,67,0.10)]">
                <div className="mb-5 flex items-center gap-2">
                  <span className="inline-flex rounded-full border border-rose-200 bg-white/90 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-700">
                    Agenda
                  </span>
                  <span className="inline-flex rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600">
                    Operação do estúdio
                  </span>
                </div>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-900">Todos os agendamentos</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                      Acompanhe cada compromisso com uma leitura mais elegante, acesso rápido ao contrato, recibo, contato e PDF de confirmação.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => openNewEventModal()} className="rounded-2xl bg-[#7f274f] text-white hover:bg-[#692040]">
                      <Plus className="mr-2 h-4 w-4" />
                      Novo agendamento
                    </Button>
                  </div>
                </div>
              </div>

              <Card className="studio-panel rounded-3xl border-0 bg-white/90 shadow-sm">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                  {filteredEvents.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                      <p className="font-medium text-slate-700">Nenhum agendamento encontrado</p>
                      <p className="mt-2 text-sm">Cadastre seu primeiro evento para começar a organizar a agenda.</p>
                      <Button onClick={() => openNewEventModal()} className="mt-4 rounded-2xl">
                        <Plus className="mr-2 h-4 w-4" />
                        Criar agendamento
                      </Button>
                    </div>
                  ) : (
                    filteredEvents.map((record) => (
                      <div key={record.id} className="overflow-hidden rounded-[30px] border border-rose-100/80 bg-gradient-to-r from-white via-[#fffafb] to-[#fff7f8] p-5 shadow-[0_16px_38px_rgba(99,32,67,0.08)]">
                        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex rounded-full border border-rose-100 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-500">
                                {record.eventDate ? formatDateBR(record.eventDate) : "Sem data"}
                              </span>
                              <StatusBadge value={record.status} />
                              <StatusBadge value={record.paymentStatus} />
                            </div>
                            <h3 className="mt-3 text-xl font-semibold text-slate-900">{record.clientName}</h3>
                            <p className="mt-1 text-sm text-slate-500">{record.eventType}</p>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                              <div className="rounded-[22px] border border-rose-100/80 bg-white/90 px-4 py-3">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-400">Horário</p>
                                <p className="mt-2 text-sm font-medium text-slate-800">{record.startTime || "Sem horário"}</p>
                              </div>
                              <div className="rounded-[22px] border border-rose-100/80 bg-white/90 px-4 py-3">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-400">Local</p>
                                <p className="mt-2 text-sm font-medium text-slate-800">{record.location || "Local a combinar"}</p>
                              </div>
                              <div className="rounded-[22px] border border-rose-100/80 bg-white/90 px-4 py-3">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-400">Valor</p>
                                <p className="mt-2 text-sm font-medium text-slate-800">{formatCurrency(record.computedAmount)}</p>
                              </div>
                              <div className="rounded-[22px] border border-rose-100/80 bg-white/90 px-4 py-3">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-400">Pago</p>
                                <p className="mt-2 text-sm font-medium text-slate-800">{formatCurrency(record.amountPaid || 0)}</p>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 xl:max-w-[280px] xl:justify-end">
                            <Button variant="outline" className="rounded-2xl" onClick={() => { setSelectedContractId(record.id); setActiveTab("contratos"); }}><FileText className="mr-2 h-4 w-4" />Contrato</Button>
                            {Number(record.amountPaid || 0) > 0 ? (
                              <Button variant="outline" className="rounded-2xl" onClick={() => { setSelectedReceiptId(record.id); setActiveTab("recibos"); }}><Wallet className="mr-2 h-4 w-4" />Recibo</Button>
                            ) : null}
                            <Button variant="outline" className="rounded-2xl" onClick={() => sendEmail(record, getAgendaMessageType(record))}><Mail className="mr-2 h-4 w-4" />E-mail</Button>
                            <Button variant="outline" className="rounded-2xl" onClick={() => sendWhatsApp(record, getAgendaMessageType(record))}><Bell className="mr-2 h-4 w-4" />{getAgendaMessageLabel(record)}</Button>
                            <Button variant="outline" className="rounded-2xl" onClick={() => markAsPaid(record)}><Wallet className="mr-2 h-4 w-4" />Quitar</Button>
                            <Button variant="outline" className="rounded-2xl" onClick={() => editEvent(record)}><Pencil className="mr-2 h-4 w-4" />Editar</Button>
                            <Button variant="outline" className="rounded-2xl" onClick={() => generateEventPDF(getRecordForEventPDF(record), settings)}><FileText className="mr-2 h-4 w-4" />PDF agenda</Button>
                            <Button variant="destructive" className="rounded-2xl" onClick={() => removeEvent(record.id)}><Trash2 className="mr-2 h-4 w-4" />Excluir</Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="orcamentos" className="mt-6">
            <div className="space-y-6">
              <div className="overflow-hidden rounded-[32px] border border-rose-200/70 bg-gradient-to-r from-[#fff7f8] via-white to-[#fff3f6] p-5 shadow-[0_22px_60px_rgba(99,32,67,0.10)]">
                <div className="mb-5 flex items-center gap-2">
                  <span className="inline-flex rounded-full border border-rose-200 bg-white/90 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-700">
                    Orçamentos
                  </span>
                  <span className="inline-flex rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600">
                    Propostas comerciais
                  </span>
                </div>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-900">Central de orçamentos</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                      Acompanhe a negociação, destaque valores e transforme propostas em eventos confirmados com mais clareza visual.
                    </p>
                  </div>
                  <Button onClick={openNewBudgetModal} className="rounded-2xl bg-[#7f274f] text-white hover:bg-[#692040]">
                    <Plus className="mr-2 h-4 w-4" />
                    Novo orçamento
                  </Button>
                </div>
              </div>

              <Card className="studio-panel rounded-3xl border-0 bg-white/90 shadow-sm">
                <CardContent className="pt-6">
                  <div className="mb-6 grid gap-4 md:grid-cols-4">
                    <div className="rounded-[24px] border border-amber-200/80 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">Pendente</p>
                      <p className="mt-3 text-3xl font-extrabold text-amber-900">{budgetPipeline.pending}</p>
                    </div>
                    <div className="rounded-[24px] border border-sky-200/80 bg-gradient-to-br from-sky-50 to-white p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">Em negociação</p>
                      <p className="mt-3 text-3xl font-extrabold text-sky-900">{budgetPipeline.negotiation}</p>
                    </div>
                    <div className="rounded-[24px] border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Aprovado</p>
                      <p className="mt-3 text-3xl font-extrabold text-emerald-900">{budgetPipeline.approved}</p>
                    </div>
                    <div className="rounded-[24px] border border-red-200/80 bg-gradient-to-br from-red-50 to-white p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-red-700">Cancelado</p>
                      <p className="mt-3 text-3xl font-extrabold text-red-900">{budgetPipeline.canceled}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                  {onlyBudgets.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                      <p className="font-medium text-slate-700">Nenhum orçamento encontrado</p>
                      <p className="mt-2 text-sm">Crie um orçamento para gerar PDF e organizar suas propostas comerciais.</p>
                      <Button onClick={openNewBudgetModal} className="mt-4 rounded-2xl">
                        <Plus className="mr-2 h-4 w-4" />
                        Criar orçamento
                      </Button>
                    </div>
                  ) : (
                    onlyBudgets.map((record) => (
                      <div key={record.id} className="overflow-hidden rounded-[30px] border border-rose-100/80 bg-gradient-to-r from-white via-[#fffafb] to-[#fff7f8] p-5 shadow-[0_16px_38px_rgba(99,32,67,0.08)]">
                        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex rounded-full border border-rose-100 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-500">
                                {record.eventDate ? formatDateBR(record.eventDate) : "Sem data prevista"}
                              </span>
                              <StatusBadge value={record.status} />
                            </div>
                            <h3 className="mt-3 text-xl font-semibold text-slate-900">{record.clientName}</h3>
                            <p className="mt-1 text-sm text-slate-500">{record.eventType || "Orçamento"}</p>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                              <div className="rounded-[22px] border border-rose-100/80 bg-white/90 px-4 py-3">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-400">Valor</p>
                                <p className="mt-2 text-sm font-medium text-slate-800">{formatCurrency(record.computedAmount)}</p>
                              </div>
                              <div className="rounded-[22px] border border-rose-100/80 bg-white/90 px-4 py-3">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-400">Local</p>
                                <p className="mt-2 text-sm font-medium text-slate-800">{record.location || "Local a combinar"}</p>
                              </div>
                              <div className="rounded-[22px] border border-rose-100/80 bg-white/90 px-4 py-3">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-400">Validade</p>
                                <p className="mt-2 text-sm font-medium text-slate-800">{record.budgetValidityDays || settings.budgetValidityDays} dias</p>
                              </div>
                              <div className="rounded-[22px] border border-rose-100/80 bg-white/90 px-4 py-3">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-400">Pago</p>
                                <p className="mt-2 text-sm font-medium text-slate-800">{formatCurrency(record.amountPaid || 0)}</p>
                              </div>
                            </div>

                            {record.budgetDescription ? (
                              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-500">
                                {record.budgetDescription}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap gap-2 xl:max-w-[280px] xl:justify-end">
                            <Button variant="outline" className="rounded-2xl" onClick={() => { setSelectedContractId(record.id); setActiveTab("contratos"); }}><FileText className="mr-2 h-4 w-4" />Contrato</Button>
                            <Button variant="outline" className="rounded-2xl" onClick={() => sendWhatsApp(record, "proposta")}><Bell className="mr-2 h-4 w-4" />Proposta</Button>
                            <Button variant="outline" className="rounded-2xl" onClick={() => sendEmail(record, "proposta")}><Mail className="mr-2 h-4 w-4" />E-mail</Button>
                            <Button className="rounded-2xl" onClick={() => approveBudget(record)}><CheckCircle2 className="mr-2 h-4 w-4" />Aprovar</Button>
                            <Button variant="outline" className="rounded-2xl" onClick={() => generateBudgetPDF(getRecordForBudgetPDF(record), settings)}><FileText className="mr-2 h-4 w-4" />PDF</Button>
                            <Button variant="outline" className="rounded-2xl" onClick={() => editEvent(record)}><Pencil className="mr-2 h-4 w-4" />Editar</Button>
                            <Button variant="destructive" className="rounded-2xl" onClick={() => removeEvent(record.id)}><Trash2 className="mr-2 h-4 w-4" />Excluir</Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
            </div>
          </TabsContent>

          <TabsContent value="clientes" className="mt-6">
            <Card className="studio-panel rounded-3xl border-0 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Clientes</CardTitle>
                <Button onClick={openNewClientModal} className="rounded-2xl"><Plus className="mr-2 h-4 w-4" />Novo cliente</Button>
              </CardHeader>
              <CardContent>
                {uniqueClientsFromEvents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                    <p className="font-medium text-slate-700">Nenhum cliente cadastrado</p>
                    <p className="mt-2 text-sm">Cadastre clientes para preencher agendamentos mais rápido.</p>
                    <Button onClick={openNewClientModal} className="mt-4 rounded-2xl">
                      <Plus className="mr-2 h-4 w-4" />
                      Cadastrar cliente
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {uniqueClientsFromEvents.map((client) => {
                      const isRegistered = Boolean(client.isRegistered);

                      return (
                        <div key={client.id} className="rounded-3xl border border-slate-200 p-4">
                          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-lg font-semibold text-slate-900">{client.name || "Sem nome"}</h3>
                                {isRegistered ? null : (
                                  <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                                    Vindo dos eventos
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
                                <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4" />{client.email || "Sem e-mail"}</span>
                                <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4" />{client.phone || client.whatsapp || "Sem telefone"}</span>
                                <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" />{client.city || "Cidade não informada"}</span>
                              </div>
                              {client.notes ? <p className="mt-3 text-sm text-slate-500">{client.notes}</p> : null}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Button variant="outline" className="rounded-2xl" onClick={() => editClient(client)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                {isRegistered ? "Editar" : "Cadastrar cliente"}
                              </Button>
                              {isRegistered ? (
                                <Button variant="destructive" className="rounded-2xl" onClick={() => removeClient(client.id)}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Excluir
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="servicos" className="mt-6">
            <Card className="studio-panel rounded-3xl border-0 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Serviços</CardTitle>
                <Button onClick={openNewServiceModal} className="rounded-2xl"><Plus className="mr-2 h-4 w-4" />Novo serviço</Button>
              </CardHeader>
              <CardContent>
                {services.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                    <p className="font-medium text-slate-700">Nenhum serviço cadastrado</p>
                    <p className="mt-2 text-sm">Cadastre serviços para reutilizar valores, textos e entregas no orçamento.</p>
                    <Button onClick={openNewServiceModal} className="mt-4 rounded-2xl">
                      <Plus className="mr-2 h-4 w-4" />
                      Novo serviço
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {services.map((service) => (
                      <div key={service.id} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <h3 className="break-words font-semibold text-slate-900">{service.name}</h3>
                            <p className="break-words text-sm text-slate-500">{service.category || "Sem categoria"}</p>
                            <p className="mt-2 break-words text-sm text-slate-600">{service.itemDescription || service.workDescription || "Sem descrição."}</p>
                            {(service.contractPaymentMethod || service.contractDeliveryTerms || service.defaultNotes || service.defaultReceiptReference || service.defaultEventNotes || service.defaultBudgetNotes || service.defaultContractNotes || service.defaultBudgetValidityDays || service.defaultReceiptMethod || service.recommendedDeliveryDays) ? (
                              <div className="mt-3 grid gap-2 md:grid-cols-2">
                                <div className="rounded-2xl bg-slate-50 px-3 py-2">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Status sugerido</p>
                                  <p className="mt-1 break-words text-xs leading-5 text-slate-600">
                                    Agenda: {service.defaultEventStatus || "Confirmado"} · Orçamento: {service.defaultBudgetStatus || "Pendente"} · Pagamento: {service.defaultPaymentStatus || "Pendente"}
                                  </p>
                                </div>
                                <div className="rounded-2xl bg-slate-50 px-3 py-2">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Validade e prazo</p>
                                  <p className="mt-1 break-words text-xs leading-5 text-slate-600">
                                    Orçamento: {service.defaultBudgetValidityDays || settings.budgetValidityDays || 7} dias · Entrega sugerida: {service.recommendedDeliveryDays || "-"} dias
                                  </p>
                                </div>
                                <div className="rounded-2xl bg-slate-50 px-3 py-2">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Pagamento padrão</p>
                                  <p className="mt-1 break-words text-xs leading-5 text-slate-600">{service.contractPaymentMethod || "A combinar"}</p>
                                </div>
                                <div className="rounded-2xl bg-slate-50 px-3 py-2">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Entrega padrão</p>
                                  <p className="mt-1 break-words text-xs leading-5 text-slate-600">{service.contractDeliveryTerms || "A combinar"}</p>
                                </div>
                                {service.defaultNotes ? (
                                  <div className="rounded-2xl bg-slate-50 px-3 py-2 md:col-span-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Observação comercial automática</p>
                                    <p className="mt-1 break-words text-xs leading-5 text-slate-600">{service.defaultNotes}</p>
                                  </div>
                                ) : null}
                                {service.defaultEventNotes ? (
                                  <div className="rounded-2xl bg-slate-50 px-3 py-2 md:col-span-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Observação padrão da agenda</p>
                                    <p className="mt-1 break-words text-xs leading-5 text-slate-600">{service.defaultEventNotes}</p>
                                  </div>
                                ) : null}
                                {service.defaultBudgetNotes ? (
                                  <div className="rounded-2xl bg-slate-50 px-3 py-2 md:col-span-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Observação padrão do orçamento</p>
                                    <p className="mt-1 break-words text-xs leading-5 text-slate-600">{service.defaultBudgetNotes}</p>
                                  </div>
                                ) : null}
                                {service.defaultContractNotes ? (
                                  <div className="rounded-2xl bg-slate-50 px-3 py-2 md:col-span-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Observação padrão do contrato</p>
                                    <p className="mt-1 break-words text-xs leading-5 text-slate-600">{service.defaultContractNotes}</p>
                                  </div>
                                ) : null}
                                {service.defaultReceiptReference ? (
                                  <div className="rounded-2xl bg-slate-50 px-3 py-2 md:col-span-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Referência padrão de recibo</p>
                                    <p className="mt-1 break-words text-xs leading-5 text-slate-600">{service.defaultReceiptReference}</p>
                                  </div>
                                ) : null}
                                {service.defaultReceiptMethod ? (
                                  <div className="rounded-2xl bg-slate-50 px-3 py-2 md:col-span-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Método padrão de recebimento</p>
                                    <p className="mt-1 break-words text-xs leading-5 text-slate-600">{service.defaultReceiptMethod}</p>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                            <p className="mt-3 text-sm font-semibold text-slate-900">{formatCurrency(service.price)}</p>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2 lg:w-auto lg:flex-col">
                            <Button variant="outline" className="rounded-2xl" onClick={() => editService(service)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </Button>
                            <Button variant="destructive" className="rounded-2xl" onClick={() => removeService(service.id)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contratos" className="mt-6">
            <div className="space-y-6">
              <div className="overflow-hidden rounded-[32px] border border-rose-200/70 bg-gradient-to-r from-[#fff7f8] via-white to-[#fff3f6] p-5 shadow-[0_22px_60px_rgba(99,32,67,0.10)]">
                <div className="mb-5 flex items-center gap-2">
                  <span className="inline-flex rounded-full border border-rose-200 bg-white/90 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-700">
                    Contratos
                  </span>
                  <span className="inline-flex rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600">
                    Rascunho comercial
                  </span>
                </div>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-900">Central de contratos</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                      Selecione o evento, ajuste as condições e acompanhe a redação final em um painel pensado para fechamento comercial e revisão do documento.
                    </p>
                  </div>
                  {selectedContract ? (
                    <Button
                      className="rounded-2xl bg-[#7f274f] text-white hover:bg-[#692040]"
                      onClick={() => generateContractPDF(selectedContract, settings, contractPreview)}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Baixar contrato em PDF
                    </Button>
                  ) : null}
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[24px] border border-rose-100 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(99,32,67,0.06)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-500">Cliente</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{selectedContract?.clientName || "Nenhum selecionado"}</p>
                    <p className="mt-1 text-sm text-slate-500">{selectedContract?.clientCpf || "CPF ainda não definido"}</p>
                  </div>
                  <div className="rounded-[24px] border border-rose-100 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(99,32,67,0.06)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-500">Serviço</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">
                      {selectedContract?.eventType || selectedContract?.packageName || "Selecione um evento"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedContract?.eventDate ? formatDateBR(selectedContract.eventDate) : "Data não definida"}
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-[#7f274f] bg-gradient-to-br from-[#6b2746] to-[#9a4565] px-4 py-4 text-white shadow-[0_16px_36px_rgba(107,39,70,0.28)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-100/85">Status do rascunho</p>
                    <p className="mt-2 text-base font-semibold">Pronto para revisão</p>
                    <p className="mt-1 text-sm text-rose-100/80">
                      {selectedContract ? "Condições e prévia centralizadas neste painel." : "Escolha um evento para começar."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[400px,1fr]">
                <Card className="studio-panel rounded-3xl border-0 bg-white/90 shadow-sm">
                  <CardHeader className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-500">Registro vinculado</p>
                      <CardTitle className="mt-2 text-lg">Dados do contrato</CardTitle>
                    </div>
                    <p className="text-sm leading-6 text-slate-500">
                      Use este painel para escolher o evento correto e definir as cláusulas comerciais específicas.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {contractRecords.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                        Nenhum evento disponível para contrato.
                      </div>
                    ) : (
                      <>
                        <div>
                          <Label>Selecionar evento</Label>
                          <Select value={selectedContract?.id || ""} onValueChange={setSelectedContractId}>
                            <SelectTrigger className="mt-2 rounded-2xl border-rose-100 bg-white">
                              <SelectValue placeholder="Escolha um registro" />
                            </SelectTrigger>
                            <SelectContent>
                              {contractRecords.map((record) => (
                                <SelectItem key={record.id} value={record.id}>
                                  {record.clientName || "Sem cliente"} - {record.eventType || record.packageName || "Sem serviço"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="rounded-[30px] border border-rose-100/80 bg-gradient-to-br from-[#fff9fb] via-white to-[#fff6f8] p-6 shadow-[0_20px_45px_rgba(99,32,67,0.08)]">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-500">Registro selecionado</p>
                              <p className="mt-2 text-xl font-semibold text-slate-900">{selectedContract?.clientName || "-"}</p>
                              <p className="mt-1 text-sm text-slate-500">
                                {selectedContract?.eventType || selectedContract?.packageName || "Serviço não informado"}
                              </p>
                            </div>
                            <div className="rounded-[24px] border border-[#7f274f] bg-gradient-to-br from-[#6b2746] via-[#7c3153] to-[#9a4565] px-5 py-3 text-right text-white shadow-[0_16px_36px_rgba(107,39,70,0.24)]">
                              <p className="text-[11px] uppercase tracking-[0.22em] text-rose-100/85">Valor do contrato</p>
                              <p className="mt-1 text-lg font-semibold">
                                {formatCurrency(selectedContract?.computedAmount || selectedContract?.amount || 0)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            {[
                              ["CPF", selectedContract?.clientCpf || "-"],
                              ["Data", selectedContract?.eventDate ? formatDateBR(selectedContract.eventDate) : "-"],
                              ["Local", selectedContract?.location || "-"],
                              ["Endereço", selectedContract?.clientAddress || "-"],
                              ["Valor pago", formatCurrency(selectedContract?.amountPaid || 0)],
                              ["Saldo", formatCurrency(selectedContract?.balance || 0)],
                            ].map(([label, value]) => (
                              <div key={label} className="rounded-[22px] border border-rose-100/80 bg-white/95 px-4 py-3 shadow-[0_10px_24px_rgba(99,32,67,0.04)]">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-400">{label}</p>
                                <p className="mt-2 text-sm font-medium leading-6 text-slate-800">{value}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <Label>Cidade do contrato</Label>
                            <Input
                              value={settings.contractCity}
                              onChange={(event) => updateAppState({ settings: { ...settings, contractCity: event.target.value } })}
                              className="mt-2 rounded-2xl border-rose-100"
                            />
                          </div>
                          <div>
                            <Label>Foro</Label>
                            <Input
                              value={settings.contractForum}
                              onChange={(event) => updateAppState({ settings: { ...settings, contractForum: event.target.value } })}
                              className="mt-2 rounded-2xl border-rose-100"
                            />
                          </div>
                        </div>

                        <div className="space-y-5 rounded-[30px] border border-rose-100/80 bg-gradient-to-br from-[#fff8fa] via-white to-[#fffdfd] p-5 shadow-[0_16px_36px_rgba(99,32,67,0.05)]">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-500">Cláusulas comerciais</p>
                              <p className="mt-2 text-lg font-semibold text-slate-900">Condições do contrato</p>
                              <p className="mt-1 text-sm text-slate-500">Defina a forma de pagamento e a entrega do material.</p>
                            </div>
                            <div className="rounded-full border border-rose-100 bg-white px-3 py-1 text-xs font-medium text-rose-600 shadow-sm">
                              Ajuste fino
                            </div>
                          </div>
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div className="rounded-[24px] border border-rose-100/80 bg-white/95 p-4 shadow-[0_10px_24px_rgba(99,32,67,0.04)]">
                              <Label>Forma de pagamento</Label>
                              <Textarea
                                rows={4}
                                value={selectedContract?.contractPaymentMethod || ""}
                                onChange={(event) => updateRecordFields(selectedContract.id, { contractPaymentMethod: event.target.value })}
                                className="mt-3 min-h-[120px] rounded-[20px] border-rose-100 bg-[#fffdfd]"
                                placeholder="Ex.: 50% via PIX na assinatura e 50% na data do evento."
                              />
                            </div>
                            <div className="rounded-[24px] border border-rose-100/80 bg-white/95 p-4 shadow-[0_10px_24px_rgba(99,32,67,0.04)]">
                              <Label>Entrega do material</Label>
                              <Textarea
                                rows={4}
                                value={selectedContract?.contractDeliveryTerms || ""}
                                onChange={(event) => updateRecordFields(selectedContract.id, { contractDeliveryTerms: event.target.value })}
                                className="mt-3 min-h-[120px] rounded-[20px] border-rose-100 bg-[#fffdfd]"
                                placeholder="Ex.: Galeria online em até 15 dias úteis."
                              />
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <div className="grid gap-6">
                  <Card className="studio-panel rounded-3xl border-0 bg-white/90 shadow-sm">
                    <CardHeader className="space-y-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-500">Redação base</p>
                          <CardTitle className="mt-2 text-lg">Modelo do contrato</CardTitle>
                        </div>
                        <div className="rounded-2xl border border-rose-100 bg-[#fff8fa] px-4 py-3 text-sm text-slate-600">
                          O texto pode usar variáveis automáticas do evento e do cliente.
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
                      <div>
                        <Label>Texto base</Label>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-2xl border-rose-100"
                            onClick={() => updateAppState({ settings: { ...settings, contractTemplate: robustContractTemplate } })}
                          >
                            Restaurar modelo robusto
                          </Button>
                          {selectedContract ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-2xl border-rose-100"
                              onClick={() =>
                                updateAppState({
                                  settings: {
                                    ...settings,
                                    contractTemplate: getSuggestedContractTemplate(
                                      selectedContract.eventType || selectedContract.packageName,
                                    ),
                                  },
                                })
                              }
                            >
                              Reaplicar modelo do sistema
                            </Button>
                          ) : null}
                        </div>
                        <Textarea
                          rows={16}
                          value={settings.contractTemplate}
                          onChange={(event) => updateAppState({ settings: { ...settings, contractTemplate: event.target.value } })}
                          className="mt-2 min-h-[380px] rounded-[28px] border-rose-100 bg-white font-mono text-sm leading-6 shadow-inner"
                        />
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-[24px] border border-rose-100/80 bg-white/95 p-4 shadow-[0_10px_24px_rgba(99,32,67,0.04)]">
                          <Label>Autorização de imagem</Label>
                          <Textarea
                            rows={5}
                            value={settings.contractImageAuthorization || ""}
                            onChange={(event) =>
                              updateAppState({ settings: { ...settings, contractImageAuthorization: event.target.value } })
                            }
                            className="mt-3 min-h-[120px] rounded-[20px] border-rose-100 bg-[#fffdfd]"
                            placeholder="Ex.: O contratante autoriza o uso das imagens para portfólio, redes sociais e materiais promocionais."
                          />
                        </div>

                        <details className="rounded-[24px] border border-rose-100 bg-[#fff8fa] px-4 py-3">
                          <summary className="cursor-pointer list-none text-sm font-medium text-rose-700">
                            Ver variáveis
                          </summary>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {[
                              "{{studioName}}",
                              "{{studioDocument}}",
                              "{{studioPhone}}",
                              "{{studioEmail}}",
                              "{{studioCity}}",
                              "{{clientName}}",
                              "{{clientCpf}}",
                              "{{clientEmail}}",
                              "{{clientPhone}}",
                              "{{clientAddress}}",
                              "{{eventType}}",
                              "{{eventDate}}",
                              "{{startTime}}",
                              "{{endTime}}",
                              "{{location}}",
                              "{{amount}}",
                              "{{amountPaid}}",
                              "{{balance}}",
                              "{{paymentTerms}}",
                              "{{contractPaymentMethod}}",
                              "{FORMA_PAGAMENTO_CONTRATO}",
                              "{{contractDeliveryTerms}}",
                              "{AUTORIZACAO_IMAGEM}",
                              "{DESCRICAO_SERVICO}",
                              "{ITENS_SERVICO_CONTRATADO}",
                              "{{notes}}",
                              "{{currentDate}}",
                              "{{contractCity}}",
                              "{{contractForum}}",
                              "{{packageName}}",
                            ].map((variable) => (
                              <span
                                key={variable}
                                className="rounded-full border border-rose-100 bg-white px-3 py-1 text-xs font-medium text-slate-600"
                              >
                                {variable}
                              </span>
                            ))}
                          </div>
                        </details>

                        <div className="rounded-[24px] border border-rose-100/80 bg-white/95 px-4 py-4 shadow-[0_10px_24px_rgba(99,32,67,0.04)]">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-500">Assinatura da empresa</p>
                          <div className="mt-3 rounded-[20px] border border-dashed border-rose-200 bg-[#fffafb] px-4 py-5 text-center">
                            {settings.signatureDataUrl ? (
                              <img src={settings.signatureDataUrl} alt="Assinatura da empresa" className="mx-auto max-h-16 object-contain" />
                            ) : (
                              <p className="text-sm text-slate-500">Carregue uma assinatura PNG nas configurações para visualizar aqui.</p>
                            )}
                          </div>
                        </div>

                        <div>
                          <Label>Pré-visualização</Label>
                          <div className="mt-2 rounded-[30px] border border-rose-100 bg-gradient-to-b from-[#fff8fa] via-white to-[#fffafb] p-5 shadow-inner">
                            <div className="rounded-[26px] border border-rose-100/90 bg-white p-7 shadow-[0_24px_48px_rgba(99,32,67,0.10)]">
                              <div className="flex items-start justify-between gap-4 border-b border-rose-100 pb-5">
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-500">Prévia do documento</p>
                                  <p className="mt-2 text-2xl font-semibold text-slate-900">Contrato de prestação de serviços</p>
                                  <p className="mt-1 text-sm text-slate-500">
                                    Documento gerado com base no evento selecionado e nas cláusulas comerciais definidas ao lado.
                                  </p>
                                </div>
                                <div className="rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
                                  Rascunho
                                </div>
                              </div>

                              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                                <div className="rounded-[24px] border border-rose-100/80 bg-gradient-to-br from-[#fff9fb] to-white px-5 py-4 shadow-[0_10px_24px_rgba(99,32,67,0.05)]">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-rose-400">Contratante</p>
                                  <p className="mt-3 text-base font-semibold text-slate-900">{selectedContract?.clientName || "Cliente não definido"}</p>
                                  <p className="mt-1 text-sm leading-6 text-slate-500">{selectedContract?.clientCpf || "CPF não informado"}</p>
                                </div>
                                <div className="rounded-[24px] border border-rose-100/80 bg-gradient-to-br from-[#fff9fb] to-white px-5 py-4 shadow-[0_10px_24px_rgba(99,32,67,0.05)]">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-rose-400">Serviço contratado</p>
                                  <p className="mt-3 text-base font-semibold text-slate-900">
                                    {selectedContract?.eventType || selectedContract?.packageName || "Serviço não definido"}
                                  </p>
                                  <p className="mt-1 text-sm leading-6 text-slate-500">
                                    {selectedContract?.eventDate ? formatDateBR(selectedContract.eventDate) : "Data não definida"}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-6 max-h-[460px] overflow-y-auto rounded-[24px] border border-rose-100/70 bg-[linear-gradient(180deg,#fffefe_0%,#fff9fb_100%)] px-8 py-8 shadow-inner">
                                {contractPreviewBlocks.length > 0 ? (
                                  <div className="mx-auto max-w-[620px] space-y-5">
                                    {contractPreviewBlocks.map((block, index) => {
                                      if (block.type === "title") {
                                        return (
                                          <div key={`${block.type}-${index}`} className="pb-2 text-center">
                                            <p className="font-serif text-[17px] font-medium uppercase tracking-[0.02em] text-slate-800">
                                              {block.text}
                                            </p>
                                          </div>
                                        );
                                      }

                                      if (block.type === "section") {
                                        return (
                                          <div key={`${block.type}-${index}`} className="pt-3">
                                            <p className="text-[15px] font-semibold uppercase tracking-[0.04em] text-slate-800">
                                              {block.text}
                                            </p>
                                          </div>
                                        );
                                      }

                                      if (block.type === "label") {
                                        return (
                                          <p key={`${block.type}-${index}`} className="pt-2 text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                                            {block.text}
                                          </p>
                                        );
                                      }

                                      if (block.type === "intro") {
                                        return (
                                          <p
                                            key={`${block.type}-${index}`}
                                            className="break-words font-serif text-[15px] font-normal leading-[2] text-slate-700"
                                          >
                                            {block.text}
                                          </p>
                                        );
                                      }

                                      if (block.type === "bullet") {
                                        return (
                                          <div key={`${block.type}-${index}`} className="flex gap-3 pl-1">
                                            <span className="pt-[10px] text-rose-300">•</span>
                                            <p className="font-serif text-[14px] font-normal leading-[1.95] text-slate-600">
                                              {block.text}
                                            </p>
                                          </div>
                                        );
                                      }

                                      return (
                                        <p
                                          key={`${block.type}-${index}`}
                                          className="break-words font-serif text-[14px] font-normal leading-[2.05] text-slate-600"
                                        >
                                          {block.text}
                                        </p>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="mx-auto max-w-[640px] font-serif text-[14px] leading-[2.05] text-slate-500">
                                    Defina um texto base de contrato nas configurações para visualizar aqui.
                                  </p>
                                )}
                              </div>

                              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                                <div className="rounded-[24px] border border-dashed border-rose-200 bg-[#fffafb] px-5 py-6 text-center">
                                  <div className="mx-auto h-px w-full max-w-[180px] bg-rose-200" />
                                  <p className="mt-3 text-sm font-medium text-slate-700">Assinatura do contratante</p>
                                </div>
                                <div className="rounded-[24px] border border-dashed border-rose-200 bg-[#fffafb] px-5 py-6 text-center">
                                  {settings.signatureDataUrl ? (
                                    <img src={settings.signatureDataUrl} alt="Assinatura do contratado" className="mx-auto mb-3 max-h-14 object-contain" />
                                  ) : null}
                                  <div className="mx-auto h-px w-full max-w-[180px] bg-rose-200" />
                                  <p className="mt-3 text-sm font-medium text-slate-700">Assinatura do contratado</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="recibos" className="mt-6">
            <div className="grid gap-6 xl:grid-cols-[380px,1fr]">
              <Card className="studio-panel rounded-3xl border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Dados do recibo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {receiptRecords.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                      Nenhum pagamento lançado.
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>Selecionar pagamento</Label>
                        <Select value={selectedReceipt?.id || ""} onValueChange={setSelectedReceiptId}>
                          <SelectTrigger className="rounded-2xl"><SelectValue placeholder="Escolha um pagamento" /></SelectTrigger>
                          <SelectContent>
                            {receiptRecords.map((record) => (
                              <SelectItem key={record.id} value={record.id}>
                                {record.clientName || "Sem cliente"} - {formatCurrency(record.amountPaid || 0)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                        <p className="font-semibold text-slate-900">{selectedReceipt?.clientName || "-"}</p>
                        <div className="mt-3 space-y-2">
                          <p>Serviço: {selectedReceipt?.eventType || "-"}</p>
                          <p>Data do evento: {selectedReceipt?.eventDate ? formatDateBR(selectedReceipt.eventDate) : "-"}</p>
                          <p>Valor recebido: {formatCurrency(selectedReceipt?.amountPaid || 0)}</p>
                          <p>Saldo restante: {formatCurrency(selectedReceipt?.balance || 0)}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Data do recebimento</Label>
                        <Input
                          type="date"
                          value={selectedReceipt?.receiptDate || ""}
                          onChange={(event) => updateRecordFields(selectedReceipt.id, { receiptDate: event.target.value })}
                          className="rounded-2xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Forma de pagamento</Label>
                        <Input
                          value={selectedReceipt?.receiptMethod || ""}
                          onChange={(event) => updateRecordFields(selectedReceipt.id, { receiptMethod: event.target.value })}
                          className="rounded-2xl"
                          placeholder="Ex.: PIX, dinheiro, cartão"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Referência / observação</Label>
                        <Textarea
                          rows={4}
                          value={selectedReceipt?.receiptReference || ""}
                          onChange={(event) => updateRecordFields(selectedReceipt.id, { receiptReference: event.target.value })}
                          className="rounded-2xl"
                          placeholder="Ex.: Entrada referente ao ensaio gestante."
                        />
                      </div>
                      <Button
                        className="rounded-2xl"
                        onClick={() => generateReceiptPDF(selectedReceipt, settings)}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Baixar recibo em PDF
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="studio-panel rounded-3xl border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Prévia do recibo</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedReceipt ? (
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm leading-7 text-slate-700">
                      <p className="text-lg font-semibold text-slate-900">Recibo de pagamento</p>
                      <p className="mt-4">
                        Recebi de <strong>{selectedReceipt.clientName || "-"}</strong>, CPF <strong>{selectedReceipt.clientCpf || "-"}</strong>, o valor de <strong>{formatCurrency(selectedReceipt.amountPaid || 0)}</strong>, referente ao serviço <strong>{selectedReceipt.eventType || "-"}</strong>{selectedReceipt.eventDate ? ` previsto/realizado em ${formatDateBR(selectedReceipt.eventDate)}` : ""}.
                      </p>
                      <p className="mt-4">Data do recebimento: <strong>{selectedReceipt.receiptDate ? formatDateBR(selectedReceipt.receiptDate) : formatDateBR(getTodayLocalISO())}</strong></p>
                      <p>Forma de pagamento: <strong>{selectedReceipt.receiptMethod || "-"}</strong></p>
                      <p>Referência: <strong>{selectedReceipt.receiptReference || "-"}</strong></p>
                      <p className="mt-8">{settings.studioName}</p>
                      <p>CNPJ: {settings.studioDocument || "-"}</p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                      Assim que houver um pagamento registrado, a prévia aparecerá aqui.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="configuracoes" className="mt-6">
            <Card className="studio-panel rounded-3xl border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Camera className="h-5 w-5" />
                  Configurações do estúdio
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome do estúdio</Label>
                    <Input value={settings.studioName} onChange={(event) => updateAppState({ settings: { ...settings, studioName: event.target.value } })} className="rounded-2xl" />
                  </div>
                  <div className="space-y-2">
                    <Label>CNPJ</Label>
                    <Input value={settings.studioDocument} onChange={(event) => updateAppState({ settings: { ...settings, studioDocument: event.target.value } })} className="rounded-2xl" />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input value={settings.studioPhone} onChange={(event) => updateAppState({ settings: { ...settings, studioPhone: event.target.value } })} className="rounded-2xl" />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input value={settings.studioEmail} onChange={(event) => updateAppState({ settings: { ...settings, studioEmail: event.target.value } })} className="rounded-2xl" />
                  </div>
                  <div className="space-y-2">
                    <Label>Instagram</Label>
                    <Input value={settings.studioInstagram} onChange={(event) => updateAppState({ settings: { ...settings, studioInstagram: event.target.value } })} className="rounded-2xl" />
                  </div>
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input value={settings.studioCity} onChange={(event) => updateAppState({ settings: { ...settings, studioCity: event.target.value } })} className="rounded-2xl" />
                  </div>
                  <div className="space-y-2">
                    <Label>Logo</Label>
                    <label className="mt-2 flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                      {settings.logoDataUrl ? (
                        <img src={settings.logoDataUrl} alt="Logo" className="max-h-24 object-contain" />
                      ) : (
                        <>
                          <ImageIcon className="mb-3 h-6 w-6" />
                          Clique para carregar sua logo
                        </>
                      )}
                      <input type="file" accept="image/png,image/jpeg,image/jpg,image/*" className="hidden" onChange={handleLogoUpload} />
                    </label>
                  </div>
                  <div className="space-y-2">
                    <Label>Assinatura da empresa</Label>
                    <label className="mt-2 flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                      {settings.signatureDataUrl ? (
                        <img src={settings.signatureDataUrl} alt="Assinatura da empresa" className="max-h-24 object-contain" />
                      ) : (
                        <>
                          <ImageIcon className="mb-3 h-6 w-6" />
                          Carregue sua assinatura PNG sem fundo
                        </>
                      )}
                      <input type="file" accept="image/png,image/*" className="hidden" onChange={handleSignatureUpload} />
                    </label>
                    <p className="text-xs text-slate-500">
                      Use preferencialmente um arquivo PNG transparente para a assinatura ficar elegante no PDF.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Cor do sistema</Label>
                    <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {[
                        { value: "classico", label: "Clássico", swatch: "linear-gradient(135deg, #351523, #944563)" },
                        { value: "vinho", label: "Vinho", swatch: "linear-gradient(135deg, #361726, #9a4565)" },
                        { value: "terracota", label: "Terracota", swatch: "linear-gradient(135deg, #4d241d, #c76948)" },
                        { value: "esmeralda", label: "Esmeralda", swatch: "linear-gradient(135deg, #0f2f2c, #2f867f)" },
                        { value: "oceano", label: "Oceano", swatch: "linear-gradient(135deg, #152b3f, #3e88b4)" },
                        { value: "areia", label: "Areia", swatch: "linear-gradient(135deg, #5b4333, #c9a27f)" },
                      ].map((theme) => (
                        <button
                          key={theme.value}
                          type="button"
                          onClick={() => updateAppState({ settings: { ...settings, themeColor: theme.value } })}
                          className={`rounded-3xl border p-3 text-left transition hover:-translate-y-0.5 ${
                            (settings.themeColor || "classico") === theme.value
                              ? "border-slate-900 bg-slate-50 shadow-sm"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <span className="block h-12 rounded-2xl border border-white/30 shadow-inner" style={{ background: theme.swatch }} />
                          <span className="mt-3 block text-sm font-semibold text-slate-900">{theme.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Condição de pagamento</Label>
                    <Textarea rows={4} value={settings.paymentTerms} onChange={(event) => updateAppState({ settings: { ...settings, paymentTerms: event.target.value } })} className="rounded-2xl" />
                  </div>
                  <div className="space-y-2">
                    <Label>Assinatura / texto de contato</Label>
                    <Textarea rows={4} value={settings.emailSignature} onChange={(event) => updateAppState({ settings: { ...settings, emailSignature: event.target.value } })} className="rounded-2xl" />
                  </div>
                  <div className="space-y-2">
                    <Label>Rodapé do PDF</Label>
                    <Textarea rows={4} value={settings.pdfFooter} onChange={(event) => updateAppState({ settings: { ...settings, pdfFooter: event.target.value } })} className="rounded-2xl" />
                  </div>
                  <div className="space-y-2">
                    <Label>Validade do orçamento (dias)</Label>
                    <Input type="number" min="1" value={settings.budgetValidityDays} onChange={(event) => updateAppState({ settings: { ...settings, budgetValidityDays: Number(event.target.value || 7) } })} className="rounded-2xl" />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Cidade do contrato</Label>
                      <Input value={settings.contractCity} onChange={(event) => updateAppState({ settings: { ...settings, contractCity: event.target.value } })} className="rounded-2xl" />
                    </div>
                    <div className="space-y-2">
                      <Label>Foro</Label>
                      <Input value={settings.contractForum} onChange={(event) => updateAppState({ settings: { ...settings, contractForum: event.target.value } })} className="rounded-2xl" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Label>Texto base do contrato</Label>
                        <p className="mt-1 text-sm text-slate-500">
                          Esse texto alimenta a aba `Contratos` e o PDF final com substituição automática das variáveis.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-2xl"
                        onClick={() => updateAppState({ settings: { ...settings, contractTemplate: defaultSettings.contractTemplate } })}
                      >
                        Restaurar modelo
                      </Button>
                    </div>
                    <Textarea
                      rows={12}
                      value={settings.contractTemplate}
                      onChange={(event) => updateAppState({ settings: { ...settings, contractTemplate: event.target.value } })}
                      className="rounded-2xl font-mono text-sm leading-6"
                    />
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">Prévia da assinatura</p>
                    <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                      {buildEmailTemplate(
                        {
                          clientName: "Cliente Exemplo",
                          eventType: services[0]?.name || "Ensaio",
                          eventDate: getTodayLocalISO(),
                          startTime: "15:00",
                          location: "Estúdio",
                        },
                        settings,
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Dias antes para lembrete</Label>
                    <Input type="number" min="0" value={settings.reminderDaysBefore} onChange={(event) => updateAppState({ settings: { ...settings, reminderDaysBefore: Number(event.target.value || 0) } })} className="rounded-2xl" />
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl border p-4">
                    <Checkbox checked={settings.reminderSameDay} onCheckedChange={(checked) => updateAppState({ settings: { ...settings, reminderSameDay: Boolean(checked) } })} />
                    <Label>Enviar lembrete também no dia do evento</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <EventModal
        open={isEventModalOpen}
        onOpenChange={setIsEventModalOpen}
        form={form}
        setForm={setForm}
        clients={clients}
        matchedClient={matchedFormClient}
        services={services}
        currentStatusOptions={currentStatusOptions}
        paymentOptions={PAYMENT_OPTIONS}
        formItemsTotal={formItemsTotal}
        displayFormTotal={displayFormTotal}
        onApplyClient={applyClientToEvent}
        onApplyService={applyServiceToEvent}
        onAddEmptyItem={addEmptyItem}
        onAddServiceItem={addServiceItem}
        onUpdateItem={updateItem}
        onRemoveItem={removeItem}
        onDuplicateItem={duplicateItem}
        onSave={saveEvent}
        onCancel={() => {
          setIsEventModalOpen(false);
          resetEventForm();
        }}
      />

      <ClientModal
        open={isClientModalOpen}
        onOpenChange={setIsClientModalOpen}
        clientForm={clientForm}
        setClientForm={setClientForm}
        onSave={saveClient}
        onCancel={() => {
          setIsClientModalOpen(false);
          resetClientForm();
        }}
      />

      <ServiceModal
        open={isServiceModalOpen}
        onOpenChange={setIsServiceModalOpen}
        serviceForm={serviceForm}
        setServiceForm={setServiceForm}
        onSave={saveService}
        onCancel={() => {
          setIsServiceModalOpen(false);
          resetServiceForm();
        }}
      />
    </div>
  );
}
