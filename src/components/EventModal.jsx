import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_OPTIONS, PAYMENT_OPTIONS, BUDGET_STATUS_OPTIONS } from "@/data/defaults";
import BudgetItemsEditor from "@/components/BudgetItemsEditor";

export default function EventModal({
  open,
  onOpenChange,
  form,
  setForm,
  clients,
  services,
  onApplyClient,
  onApplyService,
  onAddEmptyItem,
  onAddServiceItem,
  onUpdateItem,
  onRemoveItem,
  onDuplicateItem,
  onSave,
  onCancel,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[28px] sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {form.id ? "Editar agendamento" : "Novo agendamento"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Cliente cadastrado</Label>
            <Select
              value={form.clientId || "__none__"}
              onValueChange={(value) => onApplyClient(value === "__none__" ? "" : value)}
            >
              <SelectTrigger className="rounded-2xl">
                <SelectValue placeholder="Selecionar cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Selecionar cliente</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipo de trabalho</Label>
            <Select
              value={form.eventType || "__none__"}
              onValueChange={(value) => onApplyService(value === "__none__" ? "" : value)}
            >
              <SelectTrigger className="rounded-2xl">
                <SelectValue placeholder="Selecionar trabalho" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Selecionar trabalho</SelectItem>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.name}>
                    {service.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Nome do cliente</Label>
            <Input
              value={form.clientName}
              onChange={(e) => setForm((prev) => ({ ...prev, clientName: e.target.value }))}
              className="rounded-2xl"
            />
          </div>

          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              className="rounded-2xl"
            />
          </div>

          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              className="rounded-2xl"
            />
          </div>

          <div className="space-y-2">
            <Label>WhatsApp</Label>
            <Input
              value={form.whatsapp}
              onChange={(e) => setForm((prev) => ({ ...prev, whatsapp: e.target.value }))}
              className="rounded-2xl"
            />
          </div>

          <div className="space-y-2">
            <Label>Data</Label>
            <Input
              type="date"
              value={form.eventDate}
              onChange={(e) => setForm((prev) => ({ ...prev, eventDate: e.target.value }))}
              className="rounded-2xl"
            />
          </div>

          <div className="space-y-2">
            <Label>Hora inicial</Label>
            <Input
              type="time"
              value={form.startTime}
              onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
              className="rounded-2xl"
            />
          </div>

          <div className="space-y-2">
            <Label>Hora final</Label>
            <Input
              type="time"
              value={form.endTime}
              onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
              className="rounded-2xl"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Local</Label>
            <Input
              value={form.location}
              onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
              className="rounded-2xl"
            />
          </div>

          <div className="space-y-2">
            <Label>Pacote</Label>
            <Input
              value={form.packageName}
              onChange={(e) => setForm((prev) => ({ ...prev, packageName: e.target.value }))}
              className="rounded-2xl"
            />
          </div>

          <div className="space-y-2">
            <Label>Valor pago</Label>
            <Input
              type="number"
              value={form.amountPaid}
              onChange={(e) => setForm((prev) => ({ ...prev, amountPaid: e.target.value }))}
              className="rounded-2xl"
            />
          </div>

          <div className="space-y-2">
            <Label>Status do evento</Label>
            <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}>
              <SelectTrigger className="rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status do pagamento</Label>
            <Select
              value={form.paymentStatus}
              onValueChange={(value) => setForm((prev) => ({ ...prev, paymentStatus: value }))}
            >
              <SelectTrigger className="rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_OPTIONS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
                      <div className="space-y-2">
            <Label>Número do orçamento</Label>
            <Input
              value={form.budgetNumber || ""}
              onChange={(e) => setForm((prev) => ({ ...prev, budgetNumber: e.target.value }))}
              className="rounded-2xl"
            />
          </div>

          <div className="space-y-2">
            <Label>Status do orçamento</Label>
            <Select
              value={form.budgetStatus || "Rascunho"}
              onValueChange={(value) => setForm((prev) => ({ ...prev, budgetStatus: value }))}
            >
              <SelectTrigger className="rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUDGET_STATUS_OPTIONS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Validade do orçamento</Label>
            <Input
              type="date"
              value={form.budgetValidUntil || ""}
              onChange={(e) => setForm((prev) => ({ ...prev, budgetValidUntil: e.target.value }))}
              className="rounded-2xl"
            />
          </div>
            <Label>Descrição geral do orçamento</Label>
            <Textarea
              rows={4}
              value={form.budgetDescription}
              onChange={(e) => setForm((prev) => ({ ...prev, budgetDescription: e.target.value }))}
              className="rounded-2xl"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Itens do orçamento</Label>
            <BudgetItemsEditor
              items={form.items || []}
              services={services}
              onAddEmptyItem={onAddEmptyItem}
              onAddServiceItem={onAddServiceItem}
              onUpdateItem={onUpdateItem}
              onRemoveItem={onRemoveItem}
              onDuplicateItem={onDuplicateItem}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Observações</Label>
            <Textarea
              rows={5}
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              className="rounded-2xl"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={onCancel} className="rounded-2xl">
            <X className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
          <Button onClick={onSave} className="rounded-2xl">
            <Save className="mr-2 h-4 w-4" />
            Salvar agendamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}