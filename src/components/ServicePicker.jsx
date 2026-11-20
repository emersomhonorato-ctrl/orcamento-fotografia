import SearchPicker from "@/components/SearchPicker";

const brl = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// Escolher serviço/tipo de trabalho com busca (nome ou categoria), em ordem alfabética
export default function ServicePicker({ services = [], value = "", onChange, byName = false, placeholder = "Buscar serviço", keepEmpty = false, className = "" }) {
  const options = services.map((service) => ({
    id: byName ? service.name : service.id,
    label: service.name,
    hint: [service.category, Number(service.price) ? brl(service.price) : ""].filter(Boolean).join(" • "),
    search: service.category || "",
  }));
  return <SearchPicker options={options} value={value} onChange={onChange} placeholder={placeholder} emptyText="Nenhum serviço com esse nome." keepEmpty={keepEmpty} className={className} />;
}
