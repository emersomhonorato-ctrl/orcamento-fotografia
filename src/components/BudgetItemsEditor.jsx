import { Plus, Trash2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, getItemsTotal } from "@/utils/formatters";
function applyClientToBudget(clientId) {
  const client = clients.find((item) => item.id === clientId);
  if (!client) return;

  setBudgetForm((prev) => ({
    ...prev,
    clientId: client.id,
    clientName: client.name || "",
    email: client.email || "",
    phone: client.phone || "",
    whatsapp: client.whatsapp || "",
  }));
}
function addServiceToBudget(serviceId) {
  const service = services.find((item) => item.id === serviceId);
  if (!service) return;

  const newItem = {
    id: crypto.randomUUID(),
    type: "Serviço",
    name: service.name,
    description: service.description || "",
    quantity: 1,
    unitPrice: Number(service.price || 0),
  };

  setBudgetForm((prev) => ({
    ...prev,
    items: [...(prev.items || []), newItem],
  }));
}
function saveBudget() {
  if (!budgetForm.clientName) {
    alert("Selecione ou informe o cliente.");
    return;
  }

  const total = (budgetForm.items || []).reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
    0
  );

  const payload = {
    ...budgetForm,
    id: budgetForm.id || crypto.randomUUID(),
    total,
    updatedAt: new Date().toISOString(),
    createdAt: budgetForm.createdAt || new Date().toISOString(),
  };

  setBudgets((prev) => {
    const exists = prev.some((item) => item.id === payload.id);
    return exists
      ? prev.map((item) => (item.id === payload.id ? payload : item))
      : [...prev, payload];
  });

  setBudgetModalOpen(false);
}
export default function BudgetItemsEditor({
  items,
  services,
  onAddEmptyItem,
  onAddServiceItem,
  onUpdateItem,
  onRemoveItem,
  onDuplicateItem,
}) {
  const total = getItemsTotal(items || []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="rounded-2xl" onClick={() => onAddEmptyItem("Serviço")}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar serviço
        </Button>

        <Button type="button" variant="outline" className="rounded-2xl" onClick={() => onAddEmptyItem("Produto")}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar produto
        </Button>

        <Select onValueChange={(value) => value && onAddServiceItem(value)}>
          <SelectTrigger className="w-[260px] rounded-2xl">
            <SelectValue placeholder="Adicionar da lista de trabalhos" />
          </SelectTrigger>
          <SelectContent>
            {services.map((service) => (
              <SelectItem key={service.id} value={service.id}>
                {service.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {(items || []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            Nenhum item adicionado ao orçamento.
          </div>
        ) : null}

        {(items || []).map((item, index) => {
          const totalItem = Number(item.quantity || 0) * Number(item.unitPrice || 0);

          return (
            <div key={item.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-700">
                  Item {index + 1} • {item.type || "Item"}
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => onDuplicateItem(item.id)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="destructive" size="sm" className="rounded-xl" onClick={() => onRemoveItem(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={item.type} onValueChange={(value) => onUpdateItem(item.id, "type", value)}>
                    <SelectTrigger className="rounded-2xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Serviço">Serviço</SelectItem>
                      <SelectItem value="Produto">Produto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={item.name}
                    onChange={(e) => onUpdateItem(item.id, "name", e.target.value)}
                    className="rounded-2xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => onUpdateItem(item.id, "quantity", e.target.value)}
                    className="rounded-2xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Valor unitário</Label>
                  <Input
                    type="number"
                    value={item.unitPrice}
                    onChange={(e) => onUpdateItem(item.id, "unitPrice", e.target.value)}
                    className="rounded-2xl"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Descrição</Label>
                  <Textarea
                    rows={3}
                    value={item.description}
                    onChange={(e) => onUpdateItem(item.id, "description", e.target.value)}
                    className="rounded-2xl"
                  />
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-white p-3 text-right text-sm font-semibold text-slate-700">
                Total do item: {formatCurrency(totalItem)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-3xl bg-slate-900 p-4 text-right text-white">
        <p className="text-sm text-slate-300">Total geral do orçamento</p>
        <p className="text-2xl font-bold">{formatCurrency(total)}</p>
      </div>
    </div>
  );
}