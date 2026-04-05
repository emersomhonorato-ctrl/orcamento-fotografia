import React, { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import {
  CalendarDays,
  Clock3,
  Mail,
  Phone,
  MapPin,
  Search,
  Plus,
  Trash2,
  Pencil,
  Bell,
  Camera,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  Filter,
  User,
  FileText,
  X,
  Save,
  Briefcase,
  Image as ImageIcon,
  Settings,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { motion } from "framer-motion";

const STORAGE_KEY = "studio_manager_data";

const STATUS_OPTIONS = ["Pendente", "Confirmado", "Concluído", "Cancelado"];
const PAYMENT_OPTIONS = ["Pendente", "Entrada paga", "Pago", "Atrasado"];

const defaultServices = [
  {
    id: crypto.randomUUID(),
    name: "Ensaio Individual",
    category: "Ensaio",
    price: 450,
    description: "Sessão fotográfica com direção, seleção e tratamento profissional das imagens.",
  },
  {
    id: crypto.randomUUID(),
    name: "Ensaio de Casal",
    category: "Ensaio",
    price: 650,
    description: "Ensaio em estúdio ou externa com foco em conexão, direção e entrega profissional.",
  },
  {
    id: crypto.randomUUID(),
    name: "Gestante",
    category: "Ensaio",
    price: 650,
    description: "Ensaio delicado e direcionado para registrar a gestação com sensibilidade.",
  },
  {
    id: crypto.randomUUID(),
    name: "Cobertura de Casamento",
    category: "Evento",
    price: 3500,
    description: "Cobertura fotográfica da cerimônia e festa com tratamento das imagens.",
  },
  {
    id: crypto.randomUUID(),
    name: "Formatura",
    category: "Evento",
    price: 1800,
    description: "Cobertura fotográfica completa da solenidade com entrega digital das imagens.",
  },
];

const defaultSettings = {
  studioName: "Emerson Honorato Retratos",
  studioPhone: "",
  studioEmail: "",
  studioInstagram: "@emersonhonoratoretratos",
  reminderDaysBefore: 1,
  reminderSameDay: true,
  emailSignature: "Atenciosamente,\nEmerson Honorato Retratos",
  budgetValidityDays: 7,
  paymentTerms: "50% na reserva da data e restante na data do evento ou ensaio.",
  logoDataUrl: "",
};

const emptyClient = {
  id: null,
  name: "",
  email: "",
  phone: "",
  whatsapp: "",
  city: "",
  instagram: "",
  notes: "",
};

const defaultForm = {
  id: null,
  clientId: "",
  clientName: "",
  email: "",
  phone: "",
  whatsapp: "",
  eventType: "",
  eventDate: "",
  startTime: "",
  endTime: "",
  location: "",
  amount: "",
  amountPaid: "",
  budgetDescription: "",
  status: "Pendente",
  paymentStatus: "Pendente",
  reminderSent: false,
  sameDayReminderSent: false,
  notes: "",
  packageName: "",
  createdAt: "",
  updatedAt: "",
};

const defaultServiceForm = {
  id: null,
  name: "",
  category: "",
  price: "",
  description: "",
};

function formatCurrency(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(number);
}

function formatDateBR(dateStr) {
  if (!dateStr) return "-";
  const [year, month, day] = dateStr.split("-");
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
}

function formatDateTimeLabel(dateStr, timeStr) {
  if (!dateStr) return "Sem data";
  return `${formatDateBR(dateStr)}${timeStr ? ` às ${timeStr}` : ""}`;
}

function getTodayLocalISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function combineDateTime(dateStr, timeStr = "00:00") {
  if (!dateStr) return null;
  return new Date(`${dateStr}T${timeStr || "00:00"}:00`);
}

function diffInDays(targetDateStr) {
  if (!targetDateStr) return null;
  const today = new Date(`${getTodayLocalISO()}T00:00:00`);
  const target = new Date(`${targetDateStr}T00:00:00`);
  const ms = target.getTime() - today.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function buildEmailTemplate(evento, settings) {
  return `Olá, ${evento.clientName}!\n\nEstamos passando para confirmar seu agendamento:\n\nTipo de serviço: ${evento.eventType}\nData: ${formatDateBR(evento.eventDate)}\nHorário: ${evento.startTime || "A combinar"}\nLocal: ${evento.location || "A combinar"}\n\nQualquer dúvida, estamos à disposição.\n\n${settings.emailSignature}`;
}

function isConflict(eventoA, eventoB) {
  if (!eventoA.eventDate || !eventoB.eventDate) return false;
  if (eventoA.id === eventoB.id) return false;
  if (eventoA.eventDate !== eventoB.eventDate) return false;
  if (!eventoA.startTime || !eventoA.endTime || !eventoB.startTime || !eventoB.endTime) return false;

  const aStart = combineDateTime(eventoA.eventDate, eventoA.startTime);
  const aEnd = combineDateTime(eventoA.eventDate, eventoA.endTime);
  const bStart = combineDateTime(eventoB.eventDate, eventoB.startTime);
  const bEnd = combineDateTime(eventoB.eventDate, eventoB.endTime);

  return aStart < bEnd && bStart < aEnd;
}

function StatusBadge({ value }) {
  const map = {
    Pendente: "bg-amber-100 text-amber-800 border-amber-200",
    Confirmado: "bg-blue-100 text-blue-800 border-blue-200",
    Concluído: "bg-emerald-100 text-emerald-800 border-emerald-200",
    Cancelado: "bg-red-100 text-red-800 border-red-200",
    Pago: "bg-emerald-100 text-emerald-800 border-emerald-200",
    "Entrada paga": "bg-violet-100 text-violet-800 border-violet-200",
    Atrasado: "bg-red-100 text-red-800 border-red-200",
  };

  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${map[value] || "bg-slate-100 text-slate-800 border-slate-200"}`}>{value}</span>;
}

function MetricCard({ title, value, subtitle, icon: Icon }) {
  return (
    <Card className="rounded-3xl border-0 bg-white/80 shadow-sm backdrop-blur">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">{title}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
            {subtitle ? <p className="mt-2 text-xs text-slate-500">{subtitle}</p> : null}
          </div>
          <div className="rounded-2xl bg-slate-100 p-3">
            <Icon className="h-5 w-5 text-slate-700" />
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
  for (let i = 0; i < startWeekDay; i++) days.push(null);
  for (let d = 1; d <= totalDays; d++) days.push(d);

  const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(baseDate);

  function isoForDay(day) {
    const m = String(month + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${year}-${m}-${d}`;
  }

  return (
    <Card className="rounded-3xl border-0 bg-white/80 shadow-sm backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg capitalize">
          <CalendarDays className="h-5 w-5" />
          {monthName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500">
          {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
            <div key={`${d}-${i}`}>{d}</div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-2">
          {days.map((day, index) => {
            if (!day) return <div key={`empty-${index}`} className="h-10 rounded-xl" />;
            const iso = isoForDay(day);
            const count = events.filter((e) => e.eventDate === iso).length;
            const active = selectedDate === iso;
            const isToday = iso === today;

            return (
              <button
                key={iso}
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
                {count > 0 ? <span className={`absolute bottom-1 right-1 inline-flex h-2.5 w-2.5 rounded-full ${active ? "bg-white" : "bg-slate-900"}`} /> : null}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AgendaFotografosMaster() {
  const [events, setEvents] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState(defaultServices);
  const [settings, setSettings] = useState(defaultSettings);
  const [form, setForm] = useState(defaultForm);
  const [clientForm, setClientForm] = useState(emptyClient);
  const [serviceForm, setServiceForm] = useState(defaultServiceForm);
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState(getTodayLocalISO());
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [typeFilter, setTypeFilter] = useState("Todos");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);

  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      console.log("LENDO localStorage:", saved);

      if (saved) {
        const parsed = JSON.parse(saved);
        setEvents(Array.isArray(parsed.events) ? parsed.events : []);
        setClients(Array.isArray(parsed.clients) ? parsed.clients : []);
        setServices(
          Array.isArray(parsed.services) && parsed.services.length > 0
            ? parsed.services
            : defaultServices
        );
        setSettings({ ...defaultSettings, ...(parsed.settings || {}) });
      }
    } catch (error) {
      console.error("Erro ao carregar localStorage:", error);
    } finally {
      setHasLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoaded) return;

    try {
      const dataToSave = {
        events,
        clients,
        services,
        settings,
      };

      console.log("SALVANDO localStorage:", dataToSave);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (error) {
      console.error("Erro ao salvar localStorage:", error);
    }
  }, [hasLoaded, events, clients, services, settings]);

  const eventTypes = useMemo(() => services.map((service) => service.name), [services]);

  const enrichedEvents = useMemo(() => {
    return events.map((evento) => ({
      ...evento,
      hasConflict: events.some((other) => isConflict(evento, other)),
      daysLeft: diffInDays(evento.eventDate),
      balance: Number(evento.amount || 0) - Number(evento.amountPaid || 0),
    }));
  }, [events]);

  const filteredEvents = useMemo(() => {
    return enrichedEvents
      .filter((evento) => {
        const text = `${evento.clientName} ${evento.email} ${evento.phone} ${evento.whatsapp} ${evento.eventType} ${evento.location} ${evento.notes} ${evento.packageName} ${evento.budgetDescription || ""}`.toLowerCase();
        const matchesSearch = text.includes(search.toLowerCase());
        const matchesStatus = statusFilter === "Todos" ? true : evento.status === statusFilter;
        const matchesType = typeFilter === "Todos" ? true : evento.eventType === typeFilter;
        return matchesSearch && matchesStatus && matchesType;
      })
      .sort((a, b) => {
        const aDate = combineDateTime(a.eventDate, a.startTime || "00:00")?.getTime() || 0;
        const bDate = combineDateTime(b.eventDate, b.startTime || "00:00")?.getTime() || 0;
        return aDate - bDate;
      });
  }, [enrichedEvents, search, statusFilter, typeFilter]);

  const selectedDayEvents = useMemo(() => filteredEvents.filter((evento) => evento.eventDate === selectedDate), [filteredEvents, selectedDate]);

  const uniqueClientsFromEvents = useMemo(() => {
    const fromRegistered = clients.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      whatsapp: c.whatsapp,
      city: c.city,
      instagram: c.instagram,
      notes: c.notes,
    }));

    const eventDerived = Array.from(
      new Map(
        events.map((e) => [e.clientId || e.email || `${e.clientName}-${e.phone}`, {
          id: e.clientId || e.id,
          name: e.clientName,
          email: e.email,
          phone: e.phone,
          whatsapp: e.whatsapp,
          city: "",
          instagram: "",
          notes: e.notes,
        }])
      ).values()
    );

    return Array.from(new Map([...fromRegistered, ...eventDerived].map((c) => [c.email || `${c.name}-${c.phone}`, c])).values());
  }, [clients, events]);

  const metrics = useMemo(() => {
    const total = enrichedEvents.length;
    const month = new Date().getMonth();
    const year = new Date().getFullYear();
    const monthEvents = enrichedEvents.filter((e) => {
      if (!e.eventDate) return false;
      const dt = new Date(`${e.eventDate}T12:00:00`);
      return dt.getMonth() === month && dt.getFullYear() === year;
    });

    const totalRevenue = enrichedEvents.reduce((acc, e) => acc + Number(e.amount || 0), 0);
    const received = enrichedEvents.reduce((acc, e) => acc + Number(e.amountPaid || 0), 0);
    const pending = Math.max(totalRevenue - received, 0);

    return {
      total,
      monthEvents: monthEvents.length,
      totalRevenue,
      received,
      pending,
      totalClients: uniqueClientsFromEvents.length,
      totalServices: services.length,
    };
  }, [enrichedEvents, uniqueClientsFromEvents.length, services.length]);

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
    setForm({
      ...defaultForm,
      eventDate: prefilledDate || selectedDate || getTodayLocalISO(),
      eventType: services[0]?.name || "",
      amount: services[0]?.price ? String(services[0].price) : "",
      budgetDescription: services[0]?.description || "",
      packageName: services[0]?.name || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setIsEventModalOpen(true);
  }

  function editEvent(evento) {
    setForm({
      ...evento,
      amount: String(evento.amount || ""),
      amountPaid: String(evento.amountPaid || ""),
      budgetDescription: evento.budgetDescription || "",
    });
    setIsEventModalOpen(true);
  }

  function saveEvent() {
    if (!form.clientName || !form.eventDate || !form.eventType) {
      alert("Preencha pelo menos cliente, data e tipo de serviço.");
      return;
    }

    const payload = {
      ...form,
      id: form.id || crypto.randomUUID(),
      amount: Number(form.amount || 0),
      amountPaid: Number(form.amountPaid || 0),
      budgetDescription: form.budgetDescription || "",
      createdAt: form.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setEvents((current) => {
      const exists = current.some((item) => item.id === payload.id);
      return exists ? current.map((item) => (item.id === payload.id ? payload : item)) : [...current, payload];
    });

    setIsEventModalOpen(false);
    resetEventForm();
  }

  function removeEvent(id) {
    setEvents((current) => current.filter((item) => item.id !== id));
  }

  function duplicateEvent(evento) {
    setForm({
      ...evento,
      id: null,
      clientName: `${evento.clientName} (cópia)`,
      reminderSent: false,
      sameDayReminderSent: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setIsEventModalOpen(true);
  }

  function markAsPaid(evento) {
    setEvents((current) => current.map((item) => item.id === evento.id ? { ...item, amountPaid: Number(item.amount || 0), paymentStatus: "Pago", updatedAt: new Date().toISOString() } : item));
  }

  function openNewClientModal() {
    setClientForm(emptyClient);
    setIsClientModalOpen(true);
  }

  function editClient(cliente) {
    setClientForm({ ...cliente });
    setIsClientModalOpen(true);
  }

  function saveClient() {
    if (!clientForm.name) {
      alert("Informe pelo menos o nome do cliente.");
      return;
    }
    const payload = { ...clientForm, id: clientForm.id || crypto.randomUUID() };
    setClients((current) => {
      const exists = current.some((item) => item.id === payload.id);
      return exists ? current.map((item) => (item.id === payload.id ? payload : item)) : [...current, payload];
    });
    setIsClientModalOpen(false);
    resetClientForm();
  }

  function removeClient(id) {
    setClients((current) => current.filter((item) => item.id !== id));
  }

  function openNewServiceModal() {
    setServiceForm(defaultServiceForm);
    setIsServiceModalOpen(true);
  }

  function editService(service) {
    setServiceForm({ ...service, price: String(service.price || "") });
    setIsServiceModalOpen(true);
  }

  function saveService() {
    if (!serviceForm.name) {
      alert("Informe o nome do trabalho/serviço.");
      return;
    }
    const payload = {
      ...serviceForm,
      id: serviceForm.id || crypto.randomUUID(),
      price: Number(serviceForm.price || 0),
    };
    setServices((current) => {
      const exists = current.some((item) => item.id === payload.id);
      return exists ? current.map((item) => (item.id === payload.id ? payload : item)) : [...current, payload];
    });
    setIsServiceModalOpen(false);
    resetServiceForm();
  }

  function removeService(id) {
    setServices((current) => current.filter((item) => item.id !== id));
  }

  function applyClientToEvent(clientId) {
    const client = clients.find((item) => item.id === clientId);
    setForm((prev) => ({
      ...prev,
      clientId,
      clientName: client?.name || prev.clientName,
      email: client?.email || prev.email,
      phone: client?.phone || prev.phone,
      whatsapp: client?.whatsapp || prev.whatsapp,
      notes: prev.notes || client?.notes || "",
    }));
  }

  function applyServiceToEvent(serviceName) {
    const service = services.find((item) => item.name === serviceName);
    setForm((prev) => ({
      ...prev,
      eventType: serviceName,
      packageName: service?.name || prev.packageName,
      amount: service ? String(service.price) : prev.amount,
      budgetDescription: service?.description || prev.budgetDescription,
    }));
  }

  function sendEmail(evento) {
    const subject = encodeURIComponent(`Confirmação de agendamento - ${settings.studioName}`);
    const body = encodeURIComponent(buildEmailTemplate(evento, settings));
    if (evento.email) {
      window.open(`mailto:${evento.email}?subject=${subject}&body=${body}`, "_blank");
    } else {
      alert("Este cliente não possui e-mail cadastrado.");
    }
  }

  function sendWhatsApp(evento) {
    const phone = (evento.whatsapp || evento.phone || "").replace(/\D/g, "");
    const text = encodeURIComponent(buildEmailTemplate(evento, settings));
    if (!phone) {
      alert("Este cliente não possui telefone/WhatsApp cadastrado.");
      return;
    }
    window.open(`https://wa.me/55${phone}?text=${text}`, "_blank");
  }

  function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSettings((prev) => ({ ...prev, logoDataUrl: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  }

  function gerarPDF(evento) {
    const doc = new jsPDF();
    const studioName = settings.studioName || "Estúdio Fotográfico";
    const cliente = evento.clientName || "Não informado";
    const tipo = evento.eventType || "Não informado";
    const data = evento.eventDate ? formatDateBR(evento.eventDate) : "Não informada";
    const horario = evento.startTime || "A combinar";
    const local = evento.location || "A combinar";
    const pacote = evento.packageName || evento.eventType || "Não informado";
    const valor = formatCurrency(evento.amount || 0);
    const descricao = evento.budgetDescription || evento.notes || "Serviço fotográfico conforme combinado.";
    const validade = Number(settings.budgetValidityDays || 7);
    const pagamento = settings.paymentTerms || "Condição de pagamento a combinar.";

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 38, "F");

    if (settings.logoDataUrl) {
      try {
        doc.addImage(settings.logoDataUrl, "PNG", 15, 7, 22, 22);
      } catch {}
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(studioName.toUpperCase(), settings.logoDataUrl ? 44 : 20, 18);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("ORÇAMENTO FOTOGRÁFICO", settings.logoDataUrl ? 44 : 20, 28);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Proposta Comercial", 20, 52);

    doc.setDrawColor(226, 232, 240);
    doc.line(20, 56, 190, 56);

    let y = 68;
    const rows = [
      ["Cliente", cliente],
      ["Tipo de trabalho", tipo],
      ["Data", data],
      ["Horário", horario],
      ["Local", local],
      ["Pacote", pacote],
      ["Valor do investimento", valor],
    ];

    rows.forEach(([label, value]) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`${label}:`, 20, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(value), 64, y);
      y += 9;
    });

    y += 4;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(20, y, 170, 34, 4, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.text("Descrição do orçamento", 24, y + 8);
    doc.setFont("helvetica", "normal");
    const linhasDescricao = doc.splitTextToSize(descricao, 160);
    doc.text(linhasDescricao, 24, y + 16);
    y += 44;

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(20, y, 170, 24, 4, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.text("Forma de pagamento", 24, y + 8);
    doc.setFont("helvetica", "normal");
    const linhasPagamento = doc.splitTextToSize(pagamento, 160);
    doc.text(linhasPagamento, 24, y + 16);
    y += 34;

    doc.setFont("helvetica", "bold");
    doc.text(`Validade deste orçamento: ${validade} dias`, 20, y);
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.text("Agradecemos a oportunidade. Será um prazer registrar esse momento.", 20, y);

    doc.setDrawColor(226, 232, 240);
    doc.line(20, 270, 190, 270);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(settings.studioName || "", 20, 278);
    doc.text(settings.studioPhone || "", 20, 284);
    doc.text(settings.studioEmail || "", 80, 278);
    doc.text(settings.studioInstagram || "", 80, 284);
    doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, 145, 281);

    const nomeArquivo = `orcamento-${cliente.toLowerCase().replace(/\s+/g, "-")}.pdf`;
    doc.save(nomeArquivo);
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify({ events, clients, services, settings }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-agenda-master-${getTodayLocalISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importBackup(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result);
        if (parsed.events) setEvents(parsed.events);
        if (parsed.clients) setClients(parsed.clients);
        if (parsed.services) setServices(parsed.services);
        if (parsed.settings) setSettings({ ...defaultSettings, ...parsed.settings });
        alert("Backup importado com sucesso.");
      } catch {
        alert("Arquivo inválido.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 text-slate-900">
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-8 flex flex-col gap-4 rounded-[32px] bg-slate-900 px-6 py-8 text-white shadow-xl md:flex-row md:items-center md:justify-between"
        >
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
              <Camera className="h-4 w-4" />
              Sistema master para fotógrafos
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Studio Manager Pro</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300 md:text-base">
              Agenda, clientes, trabalhos com preços pré-definidos e orçamento em PDF com logo e visual elegante.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => openNewEventModal()} className="rounded-2xl bg-white text-slate-900 hover:bg-slate-100">
              <Plus className="mr-2 h-4 w-4" />
              Novo Agendamento
            </Button>
            <Button variant="outline" onClick={exportBackup} className="rounded-2xl border-white/20 bg-transparent text-white hover:bg-white/10">
              <Save className="mr-2 h-4 w-4" />
              Backup
            </Button>
            <label className="inline-flex cursor-pointer items-center rounded-2xl border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
              Importar
              <input type="file" accept="application/json" className="hidden" onChange={importBackup} />
            </label>
          </div>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard title="Total de eventos" value={metrics.total} subtitle="Agendamentos cadastrados" icon={CalendarDays} />
          <MetricCard title="Eventos do mês" value={metrics.monthEvents} subtitle="Mês atual" icon={Clock3} />
          <MetricCard title="Receita prevista" value={formatCurrency(metrics.totalRevenue)} subtitle="Soma dos contratos" icon={Wallet} />
          <MetricCard title="Recebido" value={formatCurrency(metrics.received)} subtitle="Valores pagos" icon={CheckCircle2} />
          <MetricCard title="Clientes" value={metrics.totalClients} subtitle="Base cadastrada" icon={Users} />
          <MetricCard title="Trabalhos" value={metrics.totalServices} subtitle="Serviços pré-definidos" icon={Briefcase} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
          <TabsList className="grid w-full grid-cols-6 rounded-2xl bg-white p-1 shadow-sm">
            <TabsTrigger value="dashboard" className="rounded-xl">Dashboard</TabsTrigger>
            <TabsTrigger value="agenda" className="rounded-xl">Agenda</TabsTrigger>
            <TabsTrigger value="orcamentos" className="rounded-xl">Orçamentos</TabsTrigger>
            <TabsTrigger value="clientes" className="rounded-xl">Clientes</TabsTrigger>
            <TabsTrigger value="trabalhos" className="rounded-xl">Trabalhos</TabsTrigger>
            <TabsTrigger value="config" className="rounded-xl">Config.</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <div className="grid gap-6 xl:grid-cols-[360px,1fr]">
              <div className="space-y-6">
                <CalendarMini events={events} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
                <Card className="rounded-3xl border-0 bg-white/80 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">Próximos lembretes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {enrichedEvents.filter((e) => e.daysLeft !== null && e.daysLeft >= 0 && e.daysLeft <= 7 && e.status !== "Cancelado").slice(0, 6).map((evento) => (
                      <div key={evento.id} className="rounded-2xl border border-slate-200 p-3">
                        <p className="font-semibold text-slate-900">{evento.clientName}</p>
                        <p className="text-sm text-slate-500">{evento.eventType}</p>
                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span>{formatDateTimeLabel(evento.eventDate, evento.startTime)}</span>
                          <Badge variant="outline" className="rounded-full">{evento.daysLeft === 0 ? "Hoje" : `${evento.daysLeft} dia(s)`}</Badge>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <Card className="rounded-3xl border-0 bg-white/80 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">Agenda do dia {formatDateBR(selectedDate)}</CardTitle>
                  <Button onClick={() => openNewEventModal(selectedDate)} className="rounded-2xl">
                    <Plus className="mr-2 h-4 w-4" /> Adicionar
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedDayEvents.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">Nenhum agendamento neste dia.</div>
                  ) : selectedDayEvents.map((evento) => (
                    <div key={evento.id} className="rounded-3xl border border-slate-200 p-4 shadow-sm">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-bold">{evento.clientName}</h3>
                            <StatusBadge value={evento.status} />
                            <StatusBadge value={evento.paymentStatus} />
                            {evento.hasConflict ? <Badge className="rounded-full bg-red-100 text-red-800 hover:bg-red-100">Conflito</Badge> : null}
                          </div>
                          <p className="text-sm text-slate-500">{evento.eventType} • {formatDateTimeLabel(evento.eventDate, evento.startTime)}</p>
                          <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                            <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {evento.email || "Sem e-mail"}</p>
                            <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {evento.whatsapp || evento.phone || "Sem telefone"}</p>
                            <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {evento.location || "Local não informado"}</p>
                            <p className="flex items-center gap-2"><Wallet className="h-4 w-4" /> {formatCurrency(evento.amount)} • pago {formatCurrency(evento.amountPaid)}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 md:justify-end">
                          <Button variant="outline" className="rounded-2xl" onClick={() => editEvent(evento)}><Pencil className="mr-2 h-4 w-4" />Editar</Button>
                          <Button variant="outline" className="rounded-2xl" onClick={() => gerarPDF(evento)}><FileText className="mr-2 h-4 w-4" />PDF</Button>
                          <Button variant="outline" className="rounded-2xl" onClick={() => sendWhatsApp(evento)}><Bell className="mr-2 h-4 w-4" />WhatsApp</Button>
                          <Button className="rounded-2xl" onClick={() => markAsPaid(evento)}><CheckCircle2 className="mr-2 h-4 w-4" />Quitar</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="agenda" className="mt-6">
            <Card className="rounded-3xl border-0 bg-white/80 shadow-sm">
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <CardTitle className="text-lg">Todos os agendamentos</CardTitle>
                  <div className="grid gap-3 md:grid-cols-4 xl:w-[900px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente, local, tipo..." className="rounded-2xl pl-9" />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="rounded-2xl"><Filter className="mr-2 h-4 w-4" /><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Todos">Todos</SelectItem>
                        {STATUS_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="rounded-2xl"><Camera className="mr-2 h-4 w-4" /><SelectValue placeholder="Tipo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Todos">Todos</SelectItem>
                        {eventTypes.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button onClick={() => openNewEventModal()} className="rounded-2xl"><Plus className="mr-2 h-4 w-4" />Novo evento</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredEvents.map((evento) => (
                    <div key={evento.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="grid gap-4 xl:grid-cols-[1.2fr,1fr,auto] xl:items-center">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-bold">{evento.clientName}</h3>
                            <StatusBadge value={evento.status} />
                            <StatusBadge value={evento.paymentStatus} />
                          </div>
                          <p className="mt-2 text-sm text-slate-600">{evento.eventType} • {formatDateTimeLabel(evento.eventDate, evento.startTime)}</p>
                          <div className="mt-3 grid gap-2 text-sm text-slate-500 md:grid-cols-2">
                            <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {evento.email || "Sem e-mail"}</p>
                            <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {evento.whatsapp || evento.phone || "Sem telefone"}</p>
                            <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {evento.location || "Local não informado"}</p>
                            <p className="flex items-center gap-2"><Wallet className="h-4 w-4" /> {formatCurrency(evento.amountPaid)} / {formatCurrency(evento.amount)}</p>
                          </div>
                        </div>
                        <div className="grid gap-2 text-sm">
                          <div className="rounded-2xl bg-slate-50 p-3">
                            <p className="font-semibold text-slate-700">Pacote</p>
                            <p className="text-slate-500">{evento.packageName || "Não informado"}</p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-3">
                            <p className="font-semibold text-slate-700">Saldo</p>
                            <p className={`${evento.balance > 0 ? "text-red-600" : "text-emerald-600"} font-bold`}>{formatCurrency(evento.balance)}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 xl:w-[270px] xl:justify-end">
                          <Button variant="outline" className="rounded-2xl" onClick={() => editEvent(evento)}><Pencil className="mr-2 h-4 w-4" />Editar</Button>
                          <Button variant="outline" className="rounded-2xl" onClick={() => gerarPDF(evento)}><FileText className="mr-2 h-4 w-4" />Orçamento</Button>
                          <Button variant="outline" className="rounded-2xl" onClick={() => sendEmail(evento)}><Mail className="mr-2 h-4 w-4" />E-mail</Button>
                          <Button variant="outline" className="rounded-2xl" onClick={() => removeEvent(evento.id)}><Trash2 className="mr-2 h-4 w-4" />Excluir</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orcamentos" className="mt-6">
            <Card className="rounded-3xl border-0 bg-white/80 shadow-sm">
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-lg">Central de Orçamentos</CardTitle>
                  <p className="text-sm text-slate-500">PDF com logo, forma de pagamento e visual mais bonito.</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Orçamentos com valor: <span className="font-bold text-slate-900">{filteredEvents.filter((e) => Number(e.amount || 0) > 0).length}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredEvents.filter((e) => Number(e.amount || 0) > 0).map((evento) => (
                    <div key={evento.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="grid gap-4 lg:grid-cols-[1.3fr,auto] lg:items-center">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-bold">{evento.clientName}</h3>
                            <StatusBadge value={evento.paymentStatus} />
                          </div>
                          <p className="mt-2 text-sm text-slate-600">{evento.eventType} • {formatDateTimeLabel(evento.eventDate, evento.startTime)}</p>
                          <div className="mt-3 grid gap-2 text-sm text-slate-500 md:grid-cols-2">
                            <p className="flex items-center gap-2"><Wallet className="h-4 w-4" /> {formatCurrency(evento.amount)}</p>
                            <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {evento.location || "Local não informado"}</p>
                            <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {evento.email || "Sem e-mail"}</p>
                            <p className="flex items-center gap-2"><FileText className="h-4 w-4" /> {evento.packageName || "Pacote não informado"}</p>
                          </div>
                          {evento.budgetDescription ? <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">{evento.budgetDescription}</p> : null}
                        </div>
                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          <Button variant="outline" className="rounded-2xl" onClick={() => editEvent(evento)}><Pencil className="mr-2 h-4 w-4" />Editar</Button>
                          <Button className="rounded-2xl" onClick={() => gerarPDF(evento)}><FileText className="mr-2 h-4 w-4" />Gerar PDF</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clientes" className="mt-6">
            <Card className="rounded-3xl border-0 bg-white/80 shadow-sm">
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <CardTitle className="text-lg">Cadastro de clientes</CardTitle>
                <Button onClick={openNewClientModal} className="rounded-2xl"><Plus className="mr-2 h-4 w-4" />Novo cliente</Button>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {uniqueClientsFromEvents.map((cliente) => (
                    <div key={cliente.id} className="rounded-3xl border border-slate-200 p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-bold">{cliente.name}</h3>
                          <p className="mt-1 flex items-center gap-2 text-sm text-slate-500"><User className="h-4 w-4" /> Cliente cadastrado</p>
                        </div>
                        <Badge variant="outline" className="rounded-full">Cliente</Badge>
                      </div>
                      <div className="mt-4 space-y-2 text-sm text-slate-600">
                        <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {cliente.email || "Sem e-mail"}</p>
                        <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {cliente.whatsapp || cliente.phone || "Sem telefone"}</p>
                        <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {cliente.city || "Cidade não informada"}</p>
                      </div>
                      {cliente.notes ? <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">{cliente.notes}</p> : null}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button variant="outline" className="rounded-2xl" onClick={() => editClient(cliente)}><Pencil className="mr-2 h-4 w-4" />Editar</Button>
                        {clients.some((c) => c.id === cliente.id) ? <Button variant="destructive" className="rounded-2xl" onClick={() => removeClient(cliente.id)}><Trash2 className="mr-2 h-4 w-4" />Excluir</Button> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trabalhos" className="mt-6">
            <Card className="rounded-3xl border-0 bg-white/80 shadow-sm">
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-lg">Tipos de trabalho e valores pré-definidos</CardTitle>
                  <p className="text-sm text-slate-500">Cadastre, edite e reutilize seus serviços com valor automático.</p>
                </div>
                <Button onClick={openNewServiceModal} className="rounded-2xl"><Plus className="mr-2 h-4 w-4" />Novo trabalho</Button>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {services.map((service) => (
                    <div key={service.id} className="rounded-3xl border border-slate-200 p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-bold">{service.name}</h3>
                          <p className="mt-1 text-sm text-slate-500">{service.category || "Sem categoria"}</p>
                        </div>
                        <Badge variant="outline" className="rounded-full">{formatCurrency(service.price)}</Badge>
                      </div>
                      <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">{service.description || "Sem descrição."}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button variant="outline" className="rounded-2xl" onClick={() => editService(service)}><Pencil className="mr-2 h-4 w-4" />Editar</Button>
                        <Button variant="destructive" className="rounded-2xl" onClick={() => removeService(service.id)}><Trash2 className="mr-2 h-4 w-4" />Excluir</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config" className="mt-6">
            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="rounded-3xl border-0 bg-white/80 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Configurações do estúdio</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome do estúdio</Label>
                    <Input value={settings.studioName} onChange={(e) => setSettings((prev) => ({ ...prev, studioName: e.target.value }))} className="rounded-2xl" />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Telefone</Label>
                      <Input value={settings.studioPhone} onChange={(e) => setSettings((prev) => ({ ...prev, studioPhone: e.target.value }))} className="rounded-2xl" />
                    </div>
                    <div className="space-y-2">
                      <Label>E-mail</Label>
                      <Input value={settings.studioEmail} onChange={(e) => setSettings((prev) => ({ ...prev, studioEmail: e.target.value }))} className="rounded-2xl" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Instagram</Label>
                    <Input value={settings.studioInstagram} onChange={(e) => setSettings((prev) => ({ ...prev, studioInstagram: e.target.value }))} className="rounded-2xl" />
                  </div>
                  <div className="space-y-2">
                    <Label>Logo para o PDF</Label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600">
                      <ImageIcon className="h-4 w-4" />
                      Enviar logo em PNG
                      <input type="file" accept="image/png,image/jpeg,image/jpg" className="hidden" onChange={handleLogoUpload} />
                    </label>
                    {settings.logoDataUrl ? <img src={settings.logoDataUrl} alt="Logo" className="h-20 rounded-xl border bg-white p-2" /> : null}
                  </div>
                  <div className="space-y-2">
                    <Label>Validade do orçamento (dias)</Label>
                    <Input type="number" min="1" value={settings.budgetValidityDays} onChange={(e) => setSettings((prev) => ({ ...prev, budgetValidityDays: Number(e.target.value || 7) }))} className="rounded-2xl" />
                  </div>
                  <div className="space-y-2">
                    <Label>Forma de pagamento padrão</Label>
                    <Textarea rows={4} value={settings.paymentTerms} onChange={(e) => setSettings((prev) => ({ ...prev, paymentTerms: e.target.value }))} className="rounded-2xl" />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-0 bg-white/80 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Avisos e automações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Dias antes para lembrete</Label>
                    <Input type="number" min="0" value={settings.reminderDaysBefore} onChange={(e) => setSettings((prev) => ({ ...prev, reminderDaysBefore: Number(e.target.value || 0) }))} className="rounded-2xl" />
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl border p-4">
                    <Checkbox checked={settings.reminderSameDay} onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, reminderSameDay: Boolean(checked) }))} />
                    <Label>Enviar lembrete também no dia do evento</Label>
                  </div>
                  <div className="space-y-2">
                    <Label>Assinatura padrão</Label>
                    <Textarea rows={5} value={settings.emailSignature} onChange={(e) => setSettings((prev) => ({ ...prev, emailSignature: e.target.value }))} className="rounded-2xl" />
                  </div>
                  <div className="rounded-3xl bg-slate-950 p-5 text-sm text-slate-100">
                    <pre className="whitespace-pre-wrap font-sans">{buildEmailTemplate({ clientName: "Cliente Exemplo", eventType: services[0]?.name || "Ensaio", eventDate: getTodayLocalISO(), startTime: "15:00", location: "Estúdio" }, settings)}</pre>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isEventModalOpen} onOpenChange={setIsEventModalOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[28px] sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">{form.id ? "Editar agendamento" : "Novo agendamento"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Cliente cadastrado</Label>
              <Select value={form.clientId || "__none__"} onValueChange={(value) => applyClientToEvent(value === "__none__" ? "" : value)}>
                <SelectTrigger className="rounded-2xl"><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecionar cliente</SelectItem>
                  {clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de trabalho</Label>
              <Select value={form.eventType || "__none__"} onValueChange={(value) => applyServiceToEvent(value === "__none__" ? "" : value)}>
                <SelectTrigger className="rounded-2xl"><SelectValue placeholder="Selecionar trabalho" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecionar trabalho</SelectItem>
                  {services.map((service) => <SelectItem key={service.id} value={service.name}>{service.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Nome do cliente</Label>
              <Input value={form.clientName} onChange={(e) => setForm((prev) => ({ ...prev, clientName: e.target.value }))} className="rounded-2xl" />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} className="rounded-2xl" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} className="rounded-2xl" />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input value={form.whatsapp} onChange={(e) => setForm((prev) => ({ ...prev, whatsapp: e.target.value }))} className="rounded-2xl" />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={form.eventDate} onChange={(e) => setForm((prev) => ({ ...prev, eventDate: e.target.value }))} className="rounded-2xl" />
            </div>
            <div className="space-y-2">
              <Label>Hora inicial</Label>
              <Input type="time" value={form.startTime} onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))} className="rounded-2xl" />
            </div>
            <div className="space-y-2">
              <Label>Hora final</Label>
              <Input type="time" value={form.endTime} onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))} className="rounded-2xl" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Local</Label>
              <Input value={form.location} onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))} className="rounded-2xl" />
            </div>
            <div className="space-y-2">
              <Label>Pacote</Label>
              <Input value={form.packageName} onChange={(e) => setForm((prev) => ({ ...prev, packageName: e.target.value }))} className="rounded-2xl" />
            </div>
            <div className="space-y-2">
              <Label>Valor total</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} className="rounded-2xl" />
            </div>
            <div className="space-y-2">
              <Label>Valor pago</Label>
              <Input type="number" value={form.amountPaid} onChange={(e) => setForm((prev) => ({ ...prev, amountPaid: e.target.value }))} className="rounded-2xl" />
            </div>
            <div className="space-y-2">
              <Label>Status do evento</Label>
              <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}>
                <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status do pagamento</Label>
              <Select value={form.paymentStatus} onValueChange={(value) => setForm((prev) => ({ ...prev, paymentStatus: value }))}>
                <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Descrição do orçamento</Label>
              <Textarea rows={4} value={form.budgetDescription} onChange={(e) => setForm((prev) => ({ ...prev, budgetDescription: e.target.value }))} className="rounded-2xl" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Observações</Label>
              <Textarea rows={5} value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} className="rounded-2xl" />
            </div>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => { setIsEventModalOpen(false); resetEventForm(); }} className="rounded-2xl"><X className="mr-2 h-4 w-4" />Cancelar</Button>
            <Button onClick={saveEvent} className="rounded-2xl"><Save className="mr-2 h-4 w-4" />Salvar agendamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isClientModalOpen} onOpenChange={setIsClientModalOpen}>
        <DialogContent className="rounded-[28px] sm:max-w-2xl">
          <DialogHeader><DialogTitle className="text-2xl font-bold">{clientForm.id ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2"><Label>Nome</Label><Input value={clientForm.name} onChange={(e) => setClientForm((prev) => ({ ...prev, name: e.target.value }))} className="rounded-2xl" /></div>
            <div className="space-y-2"><Label>E-mail</Label><Input value={clientForm.email} onChange={(e) => setClientForm((prev) => ({ ...prev, email: e.target.value }))} className="rounded-2xl" /></div>
            <div className="space-y-2"><Label>Telefone</Label><Input value={clientForm.phone} onChange={(e) => setClientForm((prev) => ({ ...prev, phone: e.target.value }))} className="rounded-2xl" /></div>
            <div className="space-y-2"><Label>WhatsApp</Label><Input value={clientForm.whatsapp} onChange={(e) => setClientForm((prev) => ({ ...prev, whatsapp: e.target.value }))} className="rounded-2xl" /></div>
            <div className="space-y-2"><Label>Cidade</Label><Input value={clientForm.city} onChange={(e) => setClientForm((prev) => ({ ...prev, city: e.target.value }))} className="rounded-2xl" /></div>
            <div className="space-y-2 md:col-span-2"><Label>Instagram</Label><Input value={clientForm.instagram} onChange={(e) => setClientForm((prev) => ({ ...prev, instagram: e.target.value }))} className="rounded-2xl" /></div>
            <div className="space-y-2 md:col-span-2"><Label>Observações</Label><Textarea rows={4} value={clientForm.notes} onChange={(e) => setClientForm((prev) => ({ ...prev, notes: e.target.value }))} className="rounded-2xl" /></div>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => { setIsClientModalOpen(false); resetClientForm(); }} className="rounded-2xl"><X className="mr-2 h-4 w-4" />Cancelar</Button>
            <Button onClick={saveClient} className="rounded-2xl"><Save className="mr-2 h-4 w-4" />Salvar cliente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isServiceModalOpen} onOpenChange={setIsServiceModalOpen}>
        <DialogContent className="rounded-[28px] sm:max-w-2xl">
          <DialogHeader><DialogTitle className="text-2xl font-bold">{serviceForm.id ? "Editar trabalho" : "Novo trabalho"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2"><Label>Nome do trabalho</Label><Input value={serviceForm.name} onChange={(e) => setServiceForm((prev) => ({ ...prev, name: e.target.value }))} className="rounded-2xl" /></div>
            <div className="space-y-2"><Label>Categoria</Label><Input value={serviceForm.category} onChange={(e) => setServiceForm((prev) => ({ ...prev, category: e.target.value }))} className="rounded-2xl" /></div>
            <div className="space-y-2"><Label>Valor padrão</Label><Input type="number" value={serviceForm.price} onChange={(e) => setServiceForm((prev) => ({ ...prev, price: e.target.value }))} className="rounded-2xl" /></div>
            <div className="space-y-2 md:col-span-2"><Label>Descrição padrão do orçamento</Label><Textarea rows={5} value={serviceForm.description} onChange={(e) => setServiceForm((prev) => ({ ...prev, description: e.target.value }))} className="rounded-2xl" /></div>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => { setIsServiceModalOpen(false); resetServiceForm(); }} className="rounded-2xl"><X className="mr-2 h-4 w-4" />Cancelar</Button>
            <Button onClick={saveService} className="rounded-2xl"><Save className="mr-2 h-4 w-4" />Salvar trabalho</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

