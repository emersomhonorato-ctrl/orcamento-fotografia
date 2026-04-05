import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, X } from "lucide-react";

export default function ClientModal({
  open,
  onOpenChange,
  clientForm,
  setClientForm,
  onSave,
  onCancel,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[28px] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {clientForm.id ? "Editar cliente" : "Novo cliente"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Nome</Label>
            <Input
              value={clientForm.name}
              onChange={(e) => setClientForm((prev) => ({ ...prev, name: e.target.value }))}
              className="rounded-2xl"
            />
          </div>

          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input
              value={clientForm.email}
              onChange={(e) => setClientForm((prev) => ({ ...prev, email: e.target.value }))}
              className="rounded-2xl"
            />
          </div>

          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input
              value={clientForm.phone}
              onChange={(e) => setClientForm((prev) => ({ ...prev, phone: e.target.value }))}
              className="rounded-2xl"
            />
          </div>

          <div className="space-y-2">
            <Label>WhatsApp</Label>
            <Input
              value={clientForm.whatsapp}
              onChange={(e) => setClientForm((prev) => ({ ...prev, whatsapp: e.target.value }))}
              className="rounded-2xl"
            />
          </div>

          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input
              value={clientForm.city}
              onChange={(e) => setClientForm((prev) => ({ ...prev, city: e.target.value }))}
              className="rounded-2xl"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Instagram</Label>
            <Input
              value={clientForm.instagram}
              onChange={(e) => setClientForm((prev) => ({ ...prev, instagram: e.target.value }))}
              className="rounded-2xl"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Observações</Label>
            <Textarea
              rows={4}
              value={clientForm.notes}
              onChange={(e) => setClientForm((prev) => ({ ...prev, notes: e.target.value }))}
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
            Salvar cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}