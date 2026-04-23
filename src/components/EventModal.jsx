import { Save, X } from "lucide-react";
import BudgetItemsEditor from "@/components/BudgetItemsEditor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/utils/formatters";

export default function EventModal({
  open,
  onOpenChange,
  form,
  setForm,
  clients,
  matchedClient,
  services,
  currentStatusOptions,
  paymentOptions,
  formItemsTotal,
  displayFormTotal,
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
  const title = form.id
    ? form.recordType === "orcamento"
      ? "Editar orçamento"
      : "Editar agendamento"
    : form.recordType === "orcamento"
      ? "Novo orçamento"
      : "Novo agendamento";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[28px] sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Tipo de registro</Label>
            <Select value={form.recordType} onValueChange={(value) => setForm((current) => ({ ...current, recordType: value }))}>
              <SelectTrigger className="rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="evento">Agendamento</SelectItem>
                <SelectItem value="orcamento">Orçamento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Cliente cadastrado</Label>
            <Select value={form.clientId || "__none__"} onValueChange={(value) => onApplyClient(value === "__none__" ? "" : value)}>
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
            {matchedClient ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-emerald-200 bg-white text-emerald-700 hover:bg-white">Cliente reconhecido</Badge>
                  <span className="font-medium">{matchedClient.name}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-emerald-700">
                  O sistema encontrou um cadastro compatível por e-mail, telefone ou WhatsApp e vai vinculá-lo ao salvar.
                </p>
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>Tipo de trabalho</Label>
            <Select value={form.eventType || "__none__"} onValueChange={(value) => onApplyService(value === "__none__" ? "" : value)}>
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
              onChange={(event) => setForm((current) => ({ ...current, clientName: event.target.value }))}
              className="rounded-2xl"
            />
            {!form.clientId && matchedClient ? (
              <p className="text-xs text-slate-500">
                Esse preenchimento corresponde ao cliente já cadastrado: <strong>{matchedClient.name}</strong>.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>CPF</Label>
            <Input
              value={form.clientCpf}
              onChange={(event) => setForm((current) => ({ ...current, clientCpf: event.target.value }))}
              className="rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className="rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              className="rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label>WhatsApp</Label>
            <Input
              value={form.whatsapp}
              onChange={(event) => setForm((current) => ({ ...current, whatsapp: event.target.value }))}
              className="rounded-2xl"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Endereço</Label>
            <Input
              value={form.clientAddress}
              onChange={(event) => setForm((current) => ({ ...current, clientAddress: event.target.value }))}
              className="rounded-2xl"
            />
          </div>
          {form.recordType === "orcamento" ? (
            <>
              <div className="space-y-2 md:col-span-2">
                <Label>Data prevista</Label>
                <Input
                  type="date"
                  value={form.eventDate}
                  onChange={(event) => setForm((current) => ({ ...current, eventDate: event.target.value }))}
                  className="rounded-2xl"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Local</Label>
                <Input
                  value={form.location}
                  onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                  className="rounded-2xl"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={form.eventDate}
                  onChange={(event) => setForm((current) => ({ ...current, eventDate: event.target.value }))}
                  className="rounded-2xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Hora inicial</Label>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))}
                  className="rounded-2xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Hora final</Label>
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))}
                  className="rounded-2xl"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Local</Label>
                <Input
                  value={form.location}
                  onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                  className="rounded-2xl"
                />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label>Pacote</Label>
            <Input
              value={form.packageName}
              onChange={(event) => setForm((current) => ({ ...current, packageName: event.target.value }))}
              className="rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label>Fotos entregues online</Label>
            <Input
              type="number"
              min="0"
              value={form.onlinePhotosCount}
              onChange={(event) => setForm((current) => ({ ...current, onlinePhotosCount: event.target.value }))}
              className="rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label>Fotos reveladas</Label>
            <Input
              type="number"
              min="0"
              value={form.editedPhotosCount}
              onChange={(event) => setForm((current) => ({ ...current, editedPhotosCount: event.target.value }))}
              className="rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label>Tamanho da foto</Label>
            <Input
              value={form.photoSize}
              onChange={(event) => setForm((current) => ({ ...current, photoSize: event.target.value }))}
              className="rounded-2xl"
              placeholder="Ex.: 10x15, 15x21"
            />
          </div>
          <div className="space-y-2">
            <Label>Valor total</Label>
            <Input
              type="number"
              value={displayFormTotal}
              onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
              className="rounded-2xl"
              disabled={formItemsTotal > 0}
            />
          </div>
          <div className="space-y-2">
            <Label>Valor pago</Label>
            <Input
              type="number"
              value={form.amountPaid}
              onChange={(event) => setForm((current) => ({ ...current, amountPaid: event.target.value }))}
              className="rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label>{form.recordType === "orcamento" ? "Status do orçamento" : "Status do evento"}</Label>
            <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}>
              <SelectTrigger className="rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currentStatusOptions.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status do pagamento</Label>
            <Select value={form.paymentStatus} onValueChange={(value) => setForm((current) => ({ ...current, paymentStatus: value }))}>
              <SelectTrigger className="rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paymentOptions.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.recordType === "orcamento" ? (
            <div className="space-y-2">
              <Label>Validade do orçamento (dias)</Label>
              <Input
                type="number"
                min="1"
                value={form.budgetValidityDays || ""}
                onChange={(event) => setForm((current) => ({ ...current, budgetValidityDays: event.target.value }))}
                className="rounded-2xl"
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>Prazo recomendado (dias)</Label>
            <Input
              type="number"
              min="1"
              value={form.recommendedDeliveryDays || ""}
              onChange={(event) => setForm((current) => ({ ...current, recommendedDeliveryDays: event.target.value }))}
              className="rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label>Data do recebimento</Label>
            <Input
              type="date"
              value={form.receiptDate}
              onChange={(event) => setForm((current) => ({ ...current, receiptDate: event.target.value }))}
              className="rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label>Método de recebimento</Label>
            <Input
              value={form.receiptMethod || ""}
              onChange={(event) => setForm((current) => ({ ...current, receiptMethod: event.target.value }))}
              className="rounded-2xl"
              placeholder="Ex.: Pix, cartão, dinheiro"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Referência do recibo</Label>
            <Input
              value={form.receiptReference}
              onChange={(event) => setForm((current) => ({ ...current, receiptReference: event.target.value }))}
              className="rounded-2xl"
              placeholder="Ex.: Entrada referente ao ensaio"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Descrição do orçamento</Label>
            <Textarea
              rows={4}
              value={form.budgetDescription}
              onChange={(event) => setForm((current) => ({ ...current, budgetDescription: event.target.value }))}
              className="rounded-2xl"
            />
            {form.onlinePhotosCount || form.editedPhotosCount || form.photoSize ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <p className="font-medium text-slate-800">Entregas previstas</p>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                  {form.onlinePhotosCount ? <span>Fotos entregues online: {form.onlinePhotosCount}</span> : null}
                  {form.editedPhotosCount ? <span>Fotos reveladas: {form.editedPhotosCount}</span> : null}
                  {form.photoSize ? <span>Tamanho das fotos: {form.photoSize}</span> : null}
                </div>
              </div>
            ) : null}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Observações</Label>
            <Textarea
              rows={5}
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              className="rounded-2xl"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Observações do contrato</Label>
            <Textarea
              rows={4}
              value={form.contractNotes || ""}
              onChange={(event) => setForm((current) => ({ ...current, contractNotes: event.target.value }))}
              className="rounded-2xl"
              placeholder="Esse texto aparece como observação comercial/jurídica no contrato."
            />
          </div>
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center justify-between">
              <Label className="text-base">Itens do orçamento</Label>
              <Badge variant="outline" className="rounded-full">
                {formatCurrency(displayFormTotal)}
              </Badge>
            </div>
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
        </div>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={onCancel} className="rounded-2xl">
            <X className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
          <Button onClick={onSave} className="rounded-2xl">
            <Save className="mr-2 h-4 w-4" />
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
