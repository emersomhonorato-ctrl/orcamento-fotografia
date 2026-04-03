import React, { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";

const STORAGE_KEYS = {
  services: "fotoapp_services_v7",
  clients: "fotoapp_clients_v7",
  budgets: "fotoapp_budgets_v7",
  settings: "fotoapp_settings_v7",
};

const defaultServices = [
  {
    id: crypto.randomUUID(),
    nome: "Ensaio Individual",
    categoria: "Ensaio",
    preco: 450,
    descricao:
      "Sessão fotográfica com direção, seleção de imagens e tratamento profissional.",
  },
  {
    id: crypto.randomUUID(),
    nome: "Ensaio de Casal",
    categoria: "Ensaio",
    preco: 650,
    descricao:
      "Ensaio para casal em estúdio ou externo, com edição e entrega digital.",
  },
  {
    id: crypto.randomUUID(),
    nome: "Ensaio Gestante",
    categoria: "Ensaio",
    preco: 650,
    descricao:
      "Ensaio fotográfico com foco em sensibilidade, direção e tratamento das imagens.",
  },
  {
    id: crypto.randomUUID(),
    nome: "Ensaio Infantil",
    categoria: "Ensaio",
    preco: 550,
    descricao:
      "Sessão leve e espontânea, com tratamento profissional e entrega digital.",
  },
  {
    id: crypto.randomUUID(),
    nome: "Recepção de Formatura",
    categoria: "Evento",
    preco: 850,
    descricao:
      "Fotografia documental do evento, registros protocolares com familiares e convidados, curadoria e edição profissional, entrega digital em alta resolução.",
  },
  {
    id: crypto.randomUUID(),
    nome: "Cobertura de Casamento",
    categoria: "Evento",
    preco: 3500,
    descricao:
      "Cobertura da cerimônia e recepção com olhar documental e tratamento profissional.",
  },
  {
    id: crypto.randomUUID(),
    nome: "Foto Extra Tratada",
    categoria: "Produto",
    preco: 10,
    descricao: "Imagem adicional com tratamento profissional.",
  },
  {
    id: crypto.randomUUID(),
    nome: "Álbum 30x30",
    categoria: "Produto",
    preco: 900,
    descricao: "Álbum encadernado de alta qualidade.",
  },
];

const defaultSettings = {
  studioName: "Emerson Honorato Retratos",
  photographer: "Emerson Honorato",
  phone: "(48) 99965-2317",
  email: "emersomhonorato@gmail.com",
  city: "Siderópolis - SC",
  notes:
    "A reserva da data será confirmada mediante pagamento da entrada. Prazo de entrega e demais condições conforme combinado. Fotos extras e serviços adicionais poderão ser contratados à parte.",
};

function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

function currency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function formatDateBR(dateString) {
  if (!dateString) return "-";
  const parts = String(dateString).split("-");
  if (parts.length !== 3) return dateString;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

function inputStyle() {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #d0d7de",
    fontSize: 14,
    boxSizing: "border-box",
  };
}

function labelStyle() {
  return {
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
    display: "block",
    marginTop: 10,
  };
}

function cardStyle() {
  return {
    background: "#fff",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 6px 24px rgba(15,23,42,0.08)",
    border: "1px solid #e5e7eb",
  };
}

function buttonStyle(type = "primary") {
  const base = {
    padding: "10px 14px",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
    marginRight: 8,
    marginBottom: 8,
  };

  if (type === "secondary") {
    return { ...base, background: "#e5e7eb", color: "#111827" };
  }

  if (type === "danger") {
    return { ...base, background: "#dc2626", color: "white" };
  }

  if (type === "warning") {
    return { ...base, background: "#f59e0b", color: "#111827" };
  }

  return { ...base, background: "#111827", color: "white" };
}

function sectionTitleStyle() {
  return {
    marginTop: 0,
    marginBottom: 14,
    fontSize: 22,
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function splitDescriptionIntoBullets(text) {
  if (!text) return [];

  const parts = text
    .split(".")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length <= 1) return [text.trim()];
  return parts;
}

function sanitizeFileName(text) {
  return String(text || "cliente")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function emptyService() {
  return {
    nome: "",
    categoria: "Ensaio",
    preco: "",
    descricao: "",
  };
}

function emptyClient() {
  return {
    nome: "",
    telefone: "",
    email: "",
    instagram: "",
    observacoes: "",
  };
}

function App() {
  const [tab, setTab] = useState("orcamentos");
  const [services, setServices] = useLocalStorage(
    STORAGE_KEYS.services,
    defaultServices
  );
  const [clients, setClients] = useLocalStorage(STORAGE_KEYS.clients, []);
  const [budgets, setBudgets] = useLocalStorage(STORAGE_KEYS.budgets, []);
  const [settings, setSettings] = useLocalStorage(
    STORAGE_KEYS.settings,
    defaultSettings
  );

  const [serviceSearch, setServiceSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [editingClientId, setEditingClientId] = useState(null);

  const [newService, setNewService] = useState(emptyService());
  const [newClient, setNewClient] = useState(emptyClient());

  const [budgetClientId, setBudgetClientId] = useState("");
  const [budgetItems, setBudgetItems] = useState([]);
  const [budgetDiscount, setBudgetDiscount] = useState(0);
  const [budgetNotes, setBudgetNotes] = useState("");
  const [budgetTitle, setBudgetTitle] = useState("Orçamento Fotográfico");
  const [eventDate, setEventDate] = useState("");
  const [eventType, setEventType] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [entryPercent, setEntryPercent] = useState(50);
  const [remainingText, setRemainingText] = useState(
    "Saldo restante no dia do ensaio/evento"
  );

  const filteredServices = useMemo(() => {
    return services.filter((s) =>
      [s.nome, s.categoria, s.descricao]
        .join(" ")
        .toLowerCase()
        .includes(serviceSearch.toLowerCase())
    );
  }, [services, serviceSearch]);

  const filteredClients = useMemo(() => {
    return clients.filter((c) =>
      [c.nome, c.telefone, c.email, c.instagram]
        .join(" ")
        .toLowerCase()
        .includes(clientSearch.toLowerCase())
    );
  }, [clients, clientSearch]);

  const scheduledBudgets = useMemo(() => {
    return [...budgets]
      .sort((a, b) => {
        const dateA = a.dataEvento
          ? a.dataEvento
          : "9999-99-99";
        const dateB = b.dataEvento
          ? b.dataEvento
          : "9999-99-99";
        return dateA.localeCompare(dateB);
      })
      .reduce((acc, budget) => {
        const key = budget.dataEvento || "sem-data";
        if (!acc[key]) acc[key] = [];
        acc[key].push(budget);
        return acc;
      }, {});
  }, [budgets]);

  const selectedClient = clients.find((c) => c.id === budgetClientId);

  const subtotal = budgetItems.reduce(
    (acc, item) => acc + Number(item.quantidade || 0) * Number(item.preco || 0),
    0
  );
  const total = Math.max(subtotal - Number(budgetDiscount || 0), 0);
  const entryValue = total * (Number(entryPercent || 0) / 100);
  const remainingValue = total - entryValue;

  function resetServiceForm() {
    setNewService(emptyService());
    setEditingServiceId(null);
  }

  function resetClientForm() {
    setNewClient(emptyClient());
    setEditingClientId(null);
  }

  function addOrUpdateService() {
    if (!newService.nome || newService.preco === "") return;

    if (editingServiceId) {
      setServices((prev) =>
        prev.map((service) =>
          service.id === editingServiceId
            ? {
                ...service,
                nome: newService.nome,
                categoria: newService.categoria,
                preco: Number(newService.preco),
                descricao: newService.descricao,
              }
            : service
        )
      );
      resetServiceForm();
      return;
    }

    const service = {
      id: crypto.randomUUID(),
      nome: newService.nome,
      categoria: newService.categoria,
      preco: Number(newService.preco),
      descricao: newService.descricao,
    };

    setServices((prev) => [service, ...prev]);
    resetServiceForm();
  }

  function editService(service) {
    setEditingServiceId(service.id);
    setNewService({
      nome: service.nome,
      categoria: service.categoria,
      preco: service.preco,
      descricao: service.descricao,
    });
    setTab("servicos");
  }

  function removeService(id) {
    setServices((prev) => prev.filter((s) => s.id !== id));
    if (editingServiceId === id) {
      resetServiceForm();
    }
  }

  function addOrUpdateClient() {
    if (!newClient.nome) return;

    if (editingClientId) {
      setClients((prev) =>
        prev.map((client) =>
          client.id === editingClientId
            ? {
                ...client,
                nome: newClient.nome,
                telefone: newClient.telefone,
                email: newClient.email,
                instagram: newClient.instagram,
                observacoes: newClient.observacoes,
              }
            : client
        )
      );
      resetClientForm();
      return;
    }

    const client = { id: crypto.randomUUID(), ...newClient };
    setClients((prev) => [client, ...prev]);
    resetClientForm();
  }

  function editClient(client) {
    setEditingClientId(client.id);
    setNewClient({
      nome: client.nome || "",
      telefone: client.telefone || "",
      email: client.email || "",
      instagram: client.instagram || "",
      observacoes: client.observacoes || "",
    });
    setTab("clientes");
  }

  function removeClient(id) {
    setClients((prev) => prev.filter((c) => c.id !== id));
    if (editingClientId === id) {
      resetClientForm();
    }
  }

  function addItemFromService(service) {
    setBudgetItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        descricao: service.nome,
        detalhes: service.descricao,
        quantidade: 1,
        preco: Number(service.preco),
      },
    ]);
  }

  function updateBudgetItem(id, field, value) {
    setBudgetItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]:
                field === "quantidade" || field === "preco"
                  ? Number(value)
                  : value,
            }
          : item
      )
    );
  }

  function removeBudgetItem(id) {
    setBudgetItems((prev) => prev.filter((item) => item.id !== id));
  }

  function saveBudget() {
    if (!selectedClient || budgetItems.length === 0) return;

    const record = {
      id: crypto.randomUUID(),
      titulo: budgetTitle,
      data: new Date().toLocaleDateString("pt-BR"),
      dataEvento: eventDate,
      tipoEvento: eventType,
      localEvento: eventLocation,
      cliente: selectedClient,
      itens: budgetItems,
      desconto: Number(budgetDiscount || 0),
      subtotal,
      total,
      observacoes: budgetNotes,
      entradaPercentual: Number(entryPercent || 0),
      entradaValor: entryValue,
      saldoValor: remainingValue,
      saldoTexto: remainingText,
    };

    setBudgets((prev) => [record, ...prev]);
    alert("Orçamento salvo com sucesso.");
  }

  function removeBudget(id) {
    const confirmar = window.confirm(
      "Tem certeza que deseja excluir este orçamento salvo?"
    );
    if (!confirmar) return;
    setBudgets((prev) => prev.filter((budget) => budget.id !== id));
  }

  async function generatePDF() {
    if (!selectedClient || budgetItems.length === 0) {
      alert("Selecione um cliente e adicione itens ao orçamento.");
      return;
    }

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 46;
    let pageNumber = 1;

    const money = (v) => currency(v);

    const colors = {
      dark: [55, 65, 81],
      darkSoft: [75, 85, 99],
      text: [35, 35, 35],
      muted: [95, 95, 95],
      line: [225, 225, 225],
      light: [248, 248, 248],
      white: [245, 245, 245],
    };

    const setTextDefault = () => {
      doc.setTextColor(...colors.text);
      doc.setFont("helvetica", "normal");
    };

    const setTextMuted = () => {
      doc.setTextColor(...colors.muted);
      doc.setFont("helvetica", "normal");
    };

    const setTextWhite = () => {
      doc.setTextColor(...colors.white);
      doc.setFont("helvetica", "normal");
    };

    const drawHeader = async () => {
      try {
        const logo = await loadImage("/logo.png");

        const maxWidth = 46;
        const maxHeight = 32;
        const imgWidth = logo.width;
        const imgHeight = logo.height;
        const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);

        const finalWidth = imgWidth * ratio;
        const finalHeight = imgHeight * ratio;
        const x = 14 + (maxWidth - finalWidth) / 2;
        const yLogo = 6 + (maxHeight - finalHeight) / 2;

        doc.addImage(logo, "PNG", x, yLogo, finalWidth, finalHeight);
      } catch {
        // sem logo
      }

      doc.setFillColor(...colors.dark);
      doc.roundedRect(58, 10, 138, 28, 4, 4, "F");

      setTextWhite();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(17);
      doc.text(settings.studioName || "Estúdio de Fotografia", 64, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.text(
        `${settings.photographer || ""}  |  ${settings.phone || ""}`,
        64,
        27
      );
      doc.text(`${settings.email || ""}  |  ${settings.city || ""}`, 64, 33);

      doc.setDrawColor(...colors.line);
      doc.line(14, 42, 196, 42);
      setTextDefault();
    };

    const drawFooter = (currentPage) => {
      const footerY = pageHeight - 10;
      doc.setDrawColor(...colors.line);
      doc.line(14, footerY - 6, 196, footerY - 6);

      setTextMuted();
      doc.setFontSize(8.5);
      doc.text(settings.studioName || "Emerson Honorato Retratos", 14, footerY);
      doc.text(`Página ${currentPage}`, pageWidth - 14, footerY, {
        align: "right",
      });
      setTextDefault();
    };

    const addNewPage = async () => {
      drawFooter(pageNumber);
      doc.addPage();
      pageNumber += 1;
      await drawHeader();
      y = 46;
    };

    const ensureSpace = async (needed) => {
      if (y + needed > pageHeight - 24) {
        await addNewPage();
      }
    };

    await drawHeader();

    doc.setFillColor(...colors.light);
    doc.roundedRect(14, y, 182, 14, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...colors.dark);
    doc.text("ORÇAMENTO FOTOGRÁFICO", pageWidth / 2, y + 9, {
      align: "center",
    });

    y += 20;

    doc.setFillColor(250, 250, 250);
    doc.roundedRect(14, y, 182, 30, 3, 3, "F");

    doc.setTextColor(...colors.dark);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Resumo do evento", 18, y + 8);

    setTextDefault();
    doc.setFontSize(10);
    doc.text(`Título: ${budgetTitle || "-"}`, 18, y + 15);
    doc.text(`Tipo: ${eventType || "-"}`, 18, y + 21);
    doc.text(`Data do evento: ${formatDateBR(eventDate)}`, 105, y + 15);
    doc.text(`Local: ${eventLocation || "-"}`, 105, y + 21);

    y += 38;

    doc.setFillColor(250, 250, 250);
    doc.roundedRect(14, y, 182, 30, 3, 3, "F");

    doc.setTextColor(...colors.dark);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Dados do cliente", 18, y + 8);

    setTextDefault();
    doc.setFontSize(10);
    doc.text(`Nome: ${selectedClient.nome || "-"}`, 18, y + 15);
    doc.text(`Telefone: ${selectedClient.telefone || "-"}`, 18, y + 21);
    doc.text(`E-mail: ${selectedClient.email || "-"}`, 110, y + 15);
    doc.text(`Instagram: ${selectedClient.instagram || "-"}`, 110, y + 21);

    y += 40;

    doc.setTextColor(...colors.dark);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Itens inclusos", 14, y);

    y += 8;

    for (let index = 0; index < budgetItems.length; index += 1) {
      const item = budgetItems[index];
      const bullets = splitDescriptionIntoBullets(item.detalhes || "");
      const bulletLines = [];

      bullets.forEach((bullet) => {
        const lines = doc.splitTextToSize(`• ${bullet}`, 112);
        bulletLines.push(...lines);
      });

      const leftBlockHeight = Math.max(18, bulletLines.length * 5 + 16);
      const rightBlockHeight = 26;
      const blockHeight = Math.max(leftBlockHeight, rightBlockHeight) + 8;

      await ensureSpace(blockHeight + 10);

      doc.setDrawColor(...colors.line);
      doc.roundedRect(14, y, 182, blockHeight, 3, 3);

      doc.setTextColor(...colors.dark);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`${index + 1}. ${item.descricao}`, 18, y + 8);

      setTextDefault();
      doc.setFontSize(9.5);
      if (bulletLines.length > 0) {
        doc.text(bulletLines, 18, y + 15);
      }

      doc.setFillColor(...colors.light);
      doc.roundedRect(140, y + 6, 50, 22, 2, 2, "F");

      doc.setTextColor(...colors.darkSoft);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Qtd.", 144, y + 12);
      doc.text("Unit.", 144, y + 18);
      doc.text("Total", 144, y + 24);

      setTextDefault();
      doc.text(`${item.quantidade}`, 177, y + 12, { align: "right" });
      doc.text(`${money(item.preco)}`, 177, y + 18, { align: "right" });
      doc.text(`${money(item.quantidade * item.preco)}`, 177, y + 24, {
        align: "right",
      });

      y += blockHeight + 8;
    }

    await ensureSpace(58);

    doc.setFillColor(...colors.dark);
    doc.roundedRect(14, y, 182, 42, 4, 4, "F");

    setTextWhite();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Investimento", 18, y + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.text(`Subtotal: ${money(subtotal)}`, 18, y + 16);
    doc.text(`Desconto: ${money(budgetDiscount)}`, 18, y + 23);
    doc.text(`Entrada (${entryPercent}%): ${money(entryValue)}`, 105, y + 16);
    doc.text(`Saldo: ${money(remainingValue)}`, 105, y + 23);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(`TOTAL: ${money(total)}`, 18, y + 34);

    y += 50;

    await ensureSpace(40);

    doc.setTextColor(...colors.dark);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Condições e observações", 14, y);

    y += 8;

    setTextDefault();
    doc.setFontSize(10);

    const observacoes = doc.splitTextToSize(
      budgetNotes ||
        settings.notes ||
        "Orçamento sujeito à confirmação de data e disponibilidade.",
      180
    );
    doc.text(observacoes, 14, y);

    y += observacoes.length * 6 + 8;

    const saldoTexto = doc.splitTextToSize(
      `Condição do saldo: ${remainingText}`,
      180
    );
    doc.text(saldoTexto, 14, y);

    drawFooter(pageNumber);
    doc.save(`orcamento-${sanitizeFileName(selectedClient.nome)}.pdf`);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f3f4f6",
        padding: 20,
        fontFamily: "Arial, sans-serif",
        color: "#111827",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ ...cardStyle(), marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 28 }}>
            Sistema de Orçamentos para Fotógrafos
          </h1>
          <p style={{ marginTop: 8, color: "#4b5563" }}>
            Cadastre clientes, serviços e gere orçamentos em PDF.
          </p>
        </div>

        <div style={{ marginBottom: 20 }}>
          <button
            style={buttonStyle(tab === "orcamentos" ? "primary" : "secondary")}
            onClick={() => setTab("orcamentos")}
          >
            Orçamentos
          </button>
          <button
            style={buttonStyle(tab === "clientes" ? "primary" : "secondary")}
            onClick={() => setTab("clientes")}
          >
            Clientes
          </button>
          <button
            style={buttonStyle(tab === "servicos" ? "primary" : "secondary")}
            onClick={() => setTab("servicos")}
          >
            Serviços e Produtos
          </button>
          <button
            style={buttonStyle(tab === "agenda" ? "primary" : "secondary")}
            onClick={() => setTab("agenda")}
          >
            Agenda
          </button>
          <button
            style={buttonStyle(
              tab === "configuracoes" ? "primary" : "secondary"
            )}
            onClick={() => setTab("configuracoes")}
          >
            Configurações
          </button>
        </div>

        {tab === "orcamentos" && (
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
            <div style={cardStyle()}>
              <h2 style={sectionTitleStyle()}>Novo orçamento</h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                <div>
                  <label style={labelStyle()}>Título do orçamento</label>
                  <input
                    style={inputStyle()}
                    value={budgetTitle}
                    onChange={(e) => setBudgetTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label style={labelStyle()}>Cliente</label>
                  <select
                    style={inputStyle()}
                    value={budgetClientId}
                    onChange={(e) => setBudgetClientId(e.target.value)}
                  >
                    <option value="">Selecione um cliente</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle()}>Data do evento</label>
                  <input
                    type="date"
                    style={inputStyle()}
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                  />
                </div>

                <div>
                  <label style={labelStyle()}>Tipo de evento</label>
                  <input
                    style={inputStyle()}
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    placeholder="Ex.: Formatura, casamento, ensaio..."
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle()}>Local do evento</label>
                  <input
                    style={inputStyle()}
                    value={eventLocation}
                    onChange={(e) => setEventLocation(e.target.value)}
                    placeholder="Ex.: Criciúma Clube, estúdio, externo..."
                  />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <h3>Adicionar item do banco</h3>
                <input
                  style={{ ...inputStyle(), marginBottom: 12 }}
                  placeholder="Buscar serviço ou produto"
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                />

                <div
                  style={{
                    maxHeight: 220,
                    overflow: "auto",
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  {filteredServices.map((service) => (
                    <div
                      key={service.id}
                      style={{
                        borderBottom: "1px solid #eee",
                        padding: "10px 0",
                      }}
                    >
                      <strong>{service.nome}</strong> - {service.categoria} -{" "}
                      {currency(service.preco)}
                      <div style={{ color: "#6b7280", margin: "6px 0" }}>
                        {service.descricao}
                      </div>
                      <button
                        style={buttonStyle()}
                        onClick={() => addItemFromService(service)}
                      >
                        Adicionar ao orçamento
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3>Itens do orçamento</h3>
                {budgetItems.length === 0 && (
                  <p style={{ color: "#6b7280" }}>Nenhum item adicionado.</p>
                )}

                {budgetItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "2fr 2fr 1fr 1fr",
                        gap: 12,
                      }}
                    >
                      <div>
                        <label style={labelStyle()}>Descrição</label>
                        <input
                          style={inputStyle()}
                          value={item.descricao}
                          onChange={(e) =>
                            updateBudgetItem(item.id, "descricao", e.target.value)
                          }
                        />
                      </div>

                      <div>
                        <label style={labelStyle()}>Detalhes</label>
                        <textarea
                          style={{ ...inputStyle(), minHeight: 90 }}
                          value={item.detalhes}
                          onChange={(e) =>
                            updateBudgetItem(item.id, "detalhes", e.target.value)
                          }
                        />
                      </div>

                      <div>
                        <label style={labelStyle()}>Qtd.</label>
                        <input
                          type="number"
                          style={inputStyle()}
                          value={item.quantidade}
                          onChange={(e) =>
                            updateBudgetItem(item.id, "quantidade", e.target.value)
                          }
                        />
                      </div>

                      <div>
                        <label style={labelStyle()}>Preço</label>
                        <input
                          type="number"
                          style={inputStyle()}
                          value={item.preco}
                          onChange={(e) =>
                            updateBudgetItem(item.id, "preco", e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <button
                        style={buttonStyle("danger")}
                        onClick={() => removeBudgetItem(item.id)}
                      >
                        Remover item
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 2fr",
                  gap: 12,
                  marginTop: 16,
                }}
              >
                <div>
                  <label style={labelStyle()}>Desconto</label>
                  <input
                    type="number"
                    style={inputStyle()}
                    value={budgetDiscount}
                    onChange={(e) => setBudgetDiscount(e.target.value)}
                  />
                </div>

                <div>
                  <label style={labelStyle()}>Entrada (%)</label>
                  <input
                    type="number"
                    style={inputStyle()}
                    value={entryPercent}
                    onChange={(e) => setEntryPercent(e.target.value)}
                  />
                </div>

                <div>
                  <label style={labelStyle()}>Descrição do saldo</label>
                  <input
                    style={inputStyle()}
                    value={remainingText}
                    onChange={(e) => setRemainingText(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <label style={labelStyle()}>Observações</label>
                <textarea
                  style={{ ...inputStyle(), minHeight: 90 }}
                  value={budgetNotes}
                  onChange={(e) => setBudgetNotes(e.target.value)}
                />
              </div>

              <div style={{ marginTop: 16 }}>
                <button style={buttonStyle()} onClick={saveBudget}>
                  Salvar orçamento
                </button>
                <button style={buttonStyle("secondary")} onClick={generatePDF}>
                  Gerar PDF
                </button>
              </div>
            </div>

            <div style={cardStyle()}>
              <h2 style={sectionTitleStyle()}>Resumo</h2>
              <p>
                <strong>Cliente:</strong>{" "}
                {selectedClient?.nome || "Nenhum cliente selecionado"}
              </p>
              <p>
                <strong>Tipo de evento:</strong> {eventType || "-"}
              </p>
              <p>
                <strong>Data do evento:</strong> {formatDateBR(eventDate)}
              </p>
              <p>
                <strong>Subtotal:</strong> {currency(subtotal)}
              </p>
              <p>
                <strong>Desconto:</strong> {currency(budgetDiscount)}
              </p>
              <p>
                <strong>Total:</strong> {currency(total)}
              </p>
              <p>
                <strong>Entrada:</strong> {currency(entryValue)}
              </p>
              <p>
                <strong>Saldo:</strong> {currency(remainingValue)}
              </p>

              <hr style={{ margin: "16px 0" }} />
              <h3>Orçamentos salvos</h3>

              {budgets.length === 0 && (
                <p style={{ color: "#6b7280" }}>Nenhum orçamento salvo.</p>
              )}

              {budgets.map((b) => (
                <div
                  key={b.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 10,
                  }}
                >
                  <strong>{b.titulo}</strong>
                  <div style={{ color: "#6b7280", marginTop: 4 }}>
                    {b.cliente.nome} - {b.data}
                  </div>
                  <div style={{ marginTop: 4 }}>{currency(b.total)}</div>
                  <div style={{ marginTop: 10 }}>
                    <button
                      style={buttonStyle("danger")}
                      onClick={() => removeBudget(b.id)}
                    >
                      Excluir orçamento
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "clientes" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 20 }}>
            <div style={cardStyle()}>
              <h2 style={sectionTitleStyle()}>
                {editingClientId ? "Editar cliente" : "Cadastro de clientes"}
              </h2>

              <label style={labelStyle()}>Nome</label>
              <input
                style={inputStyle()}
                value={newClient.nome}
                onChange={(e) =>
                  setNewClient({ ...newClient, nome: e.target.value })
                }
              />

              <label style={labelStyle()}>Telefone</label>
              <input
                style={inputStyle()}
                value={newClient.telefone}
                onChange={(e) =>
                  setNewClient({ ...newClient, telefone: e.target.value })
                }
              />

              <label style={labelStyle()}>E-mail</label>
              <input
                style={inputStyle()}
                value={newClient.email}
                onChange={(e) =>
                  setNewClient({ ...newClient, email: e.target.value })
                }
              />

              <label style={labelStyle()}>Instagram</label>
              <input
                style={inputStyle()}
                value={newClient.instagram}
                onChange={(e) =>
                  setNewClient({ ...newClient, instagram: e.target.value })
                }
              />

              <label style={labelStyle()}>Observações</label>
              <textarea
                style={{ ...inputStyle(), minHeight: 90 }}
                value={newClient.observacoes}
                onChange={(e) =>
                  setNewClient({ ...newClient, observacoes: e.target.value })
                }
              />

              <div style={{ marginTop: 12 }}>
                <button style={buttonStyle()} onClick={addOrUpdateClient}>
                  {editingClientId ? "Salvar edição" : "Salvar cliente"}
                </button>

                {editingClientId && (
                  <button
                    style={buttonStyle("secondary")}
                    onClick={resetClientForm}
                  >
                    Cancelar edição
                  </button>
                )}
              </div>
            </div>

            <div style={cardStyle()}>
              <h2 style={sectionTitleStyle()}>Clientes cadastrados</h2>
              <input
                style={{ ...inputStyle(), marginBottom: 12 }}
                placeholder="Buscar cliente"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
              />

              {filteredClients.map((client) => (
                <div
                  key={client.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 10,
                  }}
                >
                  <strong>{client.nome}</strong>
                  <div>Telefone: {client.telefone || "-"}</div>
                  <div>E-mail: {client.email || "-"}</div>
                  <div>Instagram: {client.instagram || "-"}</div>

                  <div style={{ marginTop: 10 }}>
                    <button
                      style={buttonStyle("warning")}
                      onClick={() => editClient(client)}
                    >
                      Editar
                    </button>

                    <button
                      style={buttonStyle("danger")}
                      onClick={() => removeClient(client.id)}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "servicos" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 20 }}>
            <div style={cardStyle()}>
              <h2 style={sectionTitleStyle()}>
                {editingServiceId ? "Editar item" : "Banco editável"}
              </h2>

              <label style={labelStyle()}>Nome do serviço/produto</label>
              <input
                style={inputStyle()}
                value={newService.nome}
                onChange={(e) =>
                  setNewService({ ...newService, nome: e.target.value })
                }
              />

              <label style={labelStyle()}>Categoria</label>
              <select
                style={inputStyle()}
                value={newService.categoria}
                onChange={(e) =>
                  setNewService({ ...newService, categoria: e.target.value })
                }
              >
                <option>Ensaio</option>
                <option>Evento</option>
                <option>Produto</option>
                <option>Álbum</option>
                <option>Vídeo</option>
              </select>

              <label style={labelStyle()}>Preço</label>
              <input
                type="number"
                style={inputStyle()}
                value={newService.preco}
                onChange={(e) =>
                  setNewService({ ...newService, preco: e.target.value })
                }
              />

              <label style={labelStyle()}>Descrição</label>
              <textarea
                style={{ ...inputStyle(), minHeight: 90 }}
                value={newService.descricao}
                onChange={(e) =>
                  setNewService({ ...newService, descricao: e.target.value })
                }
              />

              <div style={{ marginTop: 12 }}>
                <button style={buttonStyle()} onClick={addOrUpdateService}>
                  {editingServiceId ? "Salvar edição" : "Salvar item"}
                </button>

                {editingServiceId && (
                  <button
                    style={buttonStyle("secondary")}
                    onClick={resetServiceForm}
                  >
                    Cancelar edição
                  </button>
                )}
              </div>
            </div>

            <div style={cardStyle()}>
              <h2 style={sectionTitleStyle()}>Serviços e produtos cadastrados</h2>
              <input
                style={{ ...inputStyle(), marginBottom: 12 }}
                placeholder="Buscar item"
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
              />

              {filteredServices.map((service) => (
                <div
                  key={service.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 10,
                  }}
                >
                  <strong>{service.nome}</strong> - {service.categoria} -{" "}
                  {currency(service.preco)}
                  <div style={{ color: "#6b7280", margin: "6px 0" }}>
                    {service.descricao}
                  </div>

                  <button
                    style={buttonStyle()}
                    onClick={() => addItemFromService(service)}
                  >
                    Usar no orçamento
                  </button>

                  <button
                    style={buttonStyle("warning")}
                    onClick={() => editService(service)}
                  >
                    Editar
                  </button>

                  <button
                    style={buttonStyle("danger")}
                    onClick={() => removeService(service.id)}
                  >
                    Excluir
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "agenda" && (
          <div style={cardStyle()}>
            <h2 style={sectionTitleStyle()}>Agenda de eventos</h2>
            <p style={{ color: "#6b7280", marginTop: -4, marginBottom: 18 }}>
              Visualização dos orçamentos salvos por data de evento.
            </p>

            {budgets.length === 0 && (
              <p style={{ color: "#6b7280" }}>
                Nenhum orçamento salvo para exibir na agenda.
              </p>
            )}

            {Object.keys(scheduledBudgets).length > 0 &&
              Object.entries(scheduledBudgets).map(([dateKey, items]) => (
                <div key={dateKey} style={{ marginBottom: 24 }}>
                  <div
                    style={{
                      background: "#111827",
                      color: "white",
                      padding: "10px 14px",
                      borderRadius: 12,
                      fontWeight: 700,
                      marginBottom: 12,
                    }}
                  >
                    {dateKey === "sem-data"
                      ? "Orçamentos sem data de evento"
                      : formatDateBR(dateKey)}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                      gap: 14,
                    }}
                  >
                    {items.map((b) => (
                      <div
                        key={b.id}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 14,
                          padding: 14,
                          background: "#fff",
                          boxShadow: "0 4px 14px rgba(15,23,42,0.05)",
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
                          {b.titulo}
                        </div>
                        <div style={{ color: "#374151", marginBottom: 4 }}>
                          <strong>Cliente:</strong> {b.cliente?.nome || "-"}
                        </div>
                        <div style={{ color: "#374151", marginBottom: 4 }}>
                          <strong>Tipo:</strong> {b.tipoEvento || "-"}
                        </div>
                        <div style={{ color: "#374151", marginBottom: 4 }}>
                          <strong>Local:</strong> {b.localEvento || "-"}
                        </div>
                        <div style={{ color: "#374151", marginBottom: 4 }}>
                          <strong>Total:</strong> {currency(b.total)}
                        </div>
                        <div style={{ color: "#6b7280", fontSize: 13, marginTop: 10 }}>
                          Salvo em {b.data}
                        </div>

                        <div style={{ marginTop: 10 }}>
                          <button
                            style={buttonStyle("danger")}
                            onClick={() => removeBudget(b.id)}
                          >
                            Excluir orçamento
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}

        {tab === "configuracoes" && (
          <div style={cardStyle()}>
            <h2 style={sectionTitleStyle()}>Dados do estúdio</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={labelStyle()}>Nome do estúdio</label>
                <input
                  style={inputStyle()}
                  value={settings.studioName}
                  onChange={(e) =>
                    setSettings({ ...settings, studioName: e.target.value })
                  }
                />
              </div>

              <div>
                <label style={labelStyle()}>Fotógrafo responsável</label>
                <input
                  style={inputStyle()}
                  value={settings.photographer}
                  onChange={(e) =>
                    setSettings({ ...settings, photographer: e.target.value })
                  }
                />
              </div>

              <div>
                <label style={labelStyle()}>Telefone</label>
                <input
                  style={inputStyle()}
                  value={settings.phone}
                  onChange={(e) =>
                    setSettings({ ...settings, phone: e.target.value })
                  }
                />
              </div>

              <div>
                <label style={labelStyle()}>E-mail</label>
                <input
                  style={inputStyle()}
                  value={settings.email}
                  onChange={(e) =>
                    setSettings({ ...settings, email: e.target.value })
                  }
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle()}>Cidade</label>
                <input
                  style={inputStyle()}
                  value={settings.city}
                  onChange={(e) =>
                    setSettings({ ...settings, city: e.target.value })
                  }
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle()}>Observações padrão</label>
                <textarea
                  style={{ ...inputStyle(), minHeight: 100 }}
                  value={settings.notes}
                  onChange={(e) =>
                    setSettings({ ...settings, notes: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;