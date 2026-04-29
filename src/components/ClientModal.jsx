import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function ClientModal({ open, onOpenChange, clientForm, setClientForm, onSave, onCancel }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[28px] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{clientForm.id ? "Editar cliente" : "Novo cliente"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Nome</Label>
            <Input
              value={clientForm.name}
              onChange={(event) => setClientForm((current) => ({ ...current, name: event.target.value }))}
              className="rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label>CPF</Label>
            <Input
              value={clientForm.cpf}
              onChange={(event) => setClientForm((current) => ({ ...current, cpf: event.target.value }))}
              className="rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input
              value={clientForm.email}
              onChange={(event) => setClientForm((current) => ({ ...current, email: event.target.value }))}
              className="rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input
              value={clientForm.phone}
              onChange={(event) => setClientForm((current) => ({ ...current, phone: event.target.value }))}
              className="rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label>WhatsApp</Label>
            <Input
              value={clientForm.whatsapp}
              onChange={(event) => setClientForm((current) => ({ ...current, whatsapp: event.target.value }))}
              className="rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input
              value={clientForm.city}
              onChange={(event) => setClientForm((current) => ({ ...current, city: event.target.value }))}
              className="rounded-2xl"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Endereço</Label>
            <Input
              value={clientForm.address}
              onChange={(event) => setClientForm((current) => ({ ...current, address: event.target.value }))}
              className="rounded-2xl"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Instagram</Label>
            <Input
              value={clientForm.instagram}
              onChange={(event) => setClientForm((current) => ({ ...current, instagram: event.target.value }))}
              className="rounded-2xl"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Observações</Label>
            <Textarea
              rows={4}
              value={clientForm.notes}
              onChange={(event) => setClientForm((current) => ({ ...current, notes: event.target.value }))}
              className="rounded-2xl"
            />
          </div>
        </div>
        <DialogFooter className="sticky bottom-0 -mx-6 flex flex-col gap-2 border-t bg-white px-6 pt-4 pb-2 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={onCancel} className="rounded-2xl">
            <X className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
          <Button onClick={onSave} className="rounded-2xl">
            <Save className="mr-2 h-4 w-4" />
            Salvar cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
