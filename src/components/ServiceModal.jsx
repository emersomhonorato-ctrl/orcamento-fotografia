import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, X } from "lucide-react";

export default function ServiceModal({
  open,
  onOpenChange,
  serviceForm,
  setServiceForm,
  onSave,
  onCancel,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[28px] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {serviceForm.id ? "Editar trabalho" : "Novo trabalho"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Nome do trabalho</Label>
            <Input
              value={serviceForm.name}
              onChange={(e) => setServiceForm((prev) => ({ ...prev, name: e.target.value }))}
              className="rounded-2xl"
            />
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Input
              value={serviceForm.category}
              onChange={(e) => setServiceForm((prev) => ({ ...prev, category: e.target.value }))}
              className="rounded-2xl"
            />
          </div>

          <div className="space-y-2">
            <Label>Valor padrão</Label>
            <Input
              type="number"
              value={serviceForm.price}
              onChange={(e) => setServiceForm((prev) => ({ ...prev, price: e.target.value }))}
              className="rounded-2xl"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Descrição padrão do orçamento</Label>
            <Textarea
              rows={5}
              value={serviceForm.description}
              onChange={(e) => setServiceForm((prev) => ({ ...prev, description: e.target.value }))}
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
            Salvar trabalho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}