import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BUDGET_STATUS_OPTIONS, EVENT_STATUS_OPTIONS, PAYMENT_OPTIONS } from "@/lib/appModel";

export default function ServiceModal({ open, onOpenChange, serviceForm, setServiceForm, onSave, onCancel }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden rounded-[28px] sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-2xl font-bold">{serviceForm.id ? "Editar trabalho" : "Novo trabalho"}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Nome do trabalho</Label>
              <Input
                value={serviceForm.name}
                onChange={(event) => setServiceForm((current) => ({ ...current, name: event.target.value }))}
                className="rounded-2xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Input
                value={serviceForm.category}
                onChange={(event) => setServiceForm((current) => ({ ...current, category: event.target.value }))}
                className="rounded-2xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Valor padrão</Label>
              <Input
                type="number"
                value={serviceForm.price}
                onChange={(event) => setServiceForm((current) => ({ ...current, price: event.target.value }))}
                className="rounded-2xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Fotos entregues online</Label>
              <Input
                type="number"
                min="0"
                value={serviceForm.onlinePhotosCount}
                onChange={(event) => setServiceForm((current) => ({ ...current, onlinePhotosCount: event.target.value }))}
                className="rounded-2xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Fotos reveladas</Label>
              <Input
                type="number"
                min="0"
                value={serviceForm.editedPhotosCount}
                onChange={(event) => setServiceForm((current) => ({ ...current, editedPhotosCount: event.target.value }))}
                className="rounded-2xl"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Tamanho da foto</Label>
              <Input
                value={serviceForm.photoSize}
                onChange={(event) => setServiceForm((current) => ({ ...current, photoSize: event.target.value }))}
                className="rounded-2xl"
                placeholder="Ex.: 10x15, 15x21"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Descrição dos itens</Label>
              <Textarea
                rows={4}
                value={serviceForm.itemDescription}
                onChange={(event) => setServiceForm((current) => ({ ...current, itemDescription: event.target.value }))}
                className="rounded-2xl"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Descrição do trabalho</Label>
              <Textarea
                rows={8}
                value={serviceForm.workDescription}
                onChange={(event) => setServiceForm((current) => ({ ...current, workDescription: event.target.value }))}
                className="rounded-2xl"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Forma de pagamento padrão</Label>
              <Textarea
                rows={3}
                value={serviceForm.contractPaymentMethod}
                onChange={(event) => setServiceForm((current) => ({ ...current, contractPaymentMethod: event.target.value }))}
                className="rounded-2xl"
                placeholder="Ex.: 50% na reserva da data e restante na data do evento."
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Entrega padrão do material</Label>
              <Textarea
                rows={3}
                value={serviceForm.contractDeliveryTerms}
                onChange={(event) => setServiceForm((current) => ({ ...current, contractDeliveryTerms: event.target.value }))}
                className="rounded-2xl"
                placeholder="Ex.: Galeria online em até 15 dias úteis."
              />
            </div>
            <div className="space-y-2">
              <Label>Status sugerido para agenda</Label>
              <Select
                value={serviceForm.defaultEventStatus}
                onValueChange={(value) => setServiceForm((current) => ({ ...current, defaultEventStatus: value }))}
              >
                <SelectTrigger className="rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_STATUS_OPTIONS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status sugerido para orçamento</Label>
              <Select
                value={serviceForm.defaultBudgetStatus}
                onValueChange={(value) => setServiceForm((current) => ({ ...current, defaultBudgetStatus: value }))}
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
              <Label>Status sugerido do pagamento</Label>
              <Select
                value={serviceForm.defaultPaymentStatus}
                onValueChange={(value) => setServiceForm((current) => ({ ...current, defaultPaymentStatus: value }))}
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
            <div className="space-y-2">
              <Label>Validade padrão do orçamento</Label>
              <Input
                type="number"
                min="1"
                value={serviceForm.defaultBudgetValidityDays}
                onChange={(event) => setServiceForm((current) => ({ ...current, defaultBudgetValidityDays: event.target.value }))}
                className="rounded-2xl"
                placeholder="Ex.: 7"
              />
            </div>
            <div className="space-y-2">
              <Label>Prazo recomendado (dias)</Label>
              <Input
                type="number"
                min="1"
                value={serviceForm.recommendedDeliveryDays}
                onChange={(event) => setServiceForm((current) => ({ ...current, recommendedDeliveryDays: event.target.value }))}
                className="rounded-2xl"
                placeholder="Ex.: 15"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Método padrão de recebimento</Label>
              <Input
                value={serviceForm.defaultReceiptMethod}
                onChange={(event) => setServiceForm((current) => ({ ...current, defaultReceiptMethod: event.target.value }))}
                className="rounded-2xl"
                placeholder="Ex.: Pix, transferência, cartão, dinheiro"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Observações comerciais padrão</Label>
              <Textarea
                rows={3}
                value={serviceForm.defaultNotes}
                onChange={(event) => setServiceForm((current) => ({ ...current, defaultNotes: event.target.value }))}
                className="rounded-2xl"
                placeholder="Ex.: Reserva mediante sinal, deslocamento à parte, prazo sujeito à aprovação final."
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Observações padrão para agenda</Label>
              <Textarea
                rows={3}
                value={serviceForm.defaultEventNotes}
                onChange={(event) => setServiceForm((current) => ({ ...current, defaultEventNotes: event.target.value }))}
                className="rounded-2xl"
                placeholder="Ex.: Confirmar local na véspera, chegar 30 min antes, levar referência do briefing."
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Observações padrão para orçamento</Label>
              <Textarea
                rows={3}
                value={serviceForm.defaultBudgetNotes}
                onChange={(event) => setServiceForm((current) => ({ ...current, defaultBudgetNotes: event.target.value }))}
                className="rounded-2xl"
                placeholder="Ex.: Proposta válida por 7 dias, valores sujeitos à reserva da data."
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Observações padrão para contrato</Label>
              <Textarea
                rows={3}
                value={serviceForm.defaultContractNotes}
                onChange={(event) => setServiceForm((current) => ({ ...current, defaultContractNotes: event.target.value }))}
                className="rounded-2xl"
                placeholder="Ex.: O contratante declara ciência das condições de cobertura, entrega e uso das imagens."
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Referência padrão para recibo</Label>
              <Input
                value={serviceForm.defaultReceiptReference}
                onChange={(event) => setServiceForm((current) => ({ ...current, defaultReceiptReference: event.target.value }))}
                className="rounded-2xl"
                placeholder="Ex.: Sinal de reserva, pagamento final, entrada do pacote"
              />
            </div>
          </div>
        </div>
        <DialogFooter className="sticky bottom-0 shrink-0 border-t border-slate-200/80 bg-white pt-4 flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={onCancel} className="rounded-2xl">
            <X className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
          <Button onClick={onSave} className="rounded-2xl">
            <Save className="mr-2 h-4 w-4" />
            Salvar trabalho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
