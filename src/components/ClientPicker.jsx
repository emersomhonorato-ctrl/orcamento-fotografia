import SearchPicker from "@/components/SearchPicker";

// Escolher cliente cadastrado: busca por nome, telefone ou e-mail, em ordem alfabética
export default function ClientPicker({ clients = [], value, onChange }) {
  const options = clients.map((client) => ({
    id: client.id,
    label: client.name,
    hint: client.whatsapp || client.phone || "",
    search: `${client.email || ""} ${client.whatsapp || ""} ${client.phone || ""}`,
  }));
  return (
    <SearchPicker
      options={options}
      value={value}
      onChange={onChange}
      placeholder="Buscar cliente pelo nome ou telefone"
      emptyText="Nenhum cliente encontrado. Preencha o nome abaixo para cadastrar um novo."
    />
  );
}
