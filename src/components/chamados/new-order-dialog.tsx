"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { LoaderCircleIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import {
  createServiceOrder,
  type NewOsActionState,
  type NewOsFieldErrors,
} from "@/server/actions/service-orders"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { EquipmentCombobox } from "@/components/chamados/equipment-combobox"
import { OS_PRIORITY_META, OS_TYPE_META } from "@/lib/status-meta"

const INITIAL_STATE: NewOsActionState = { status: "idle" }

export type ClienteOption = { id: string; label: string }
export type PredioOption = { id: string; clientId: string; label: string }
type NewOrderDialogProps = {
  clientes: ClienteOption[]
  predios: PredioOption[]
  triggerLabel?: string
  triggerClassName?: string
}

const TIPO_ITEMS: Record<string, string> = {
  "": "Selecione o tipo",
  ...Object.fromEntries(
    Object.entries(OS_TYPE_META).map(([value, meta]) => [value, meta.label]),
  ),
}

const PRIORIDADE_ITEMS: Record<string, string> = Object.fromEntries(
  Object.entries(OS_PRIORITY_META).map(([value, meta]) => [value, meta.label]),
)

/**
 * Abertura manual de chamado: cliente → prédio → equipamento (selects
 * encadeados), tipo, prioridade e descrição. Submete via server action.
 */
export function NewOrderDialog({
  clientes,
  predios,
  triggerLabel = "Novo chamado",
  triggerClassName,
}: NewOrderDialogProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [clienteId, setClienteId] = React.useState("")
  const [predioId, setPredioId] = React.useState("")
  const [equipamentoId, setEquipamentoId] = React.useState("")
  const [tipo, setTipo] = React.useState("")
  const [prioridade, setPrioridade] = React.useState("media")
  const [state, formAction, pending] = React.useActionState(
    async (prev: NewOsActionState, formData: FormData) => {
      const result = await createServiceOrder(prev, formData)
      if (result.status === "success") {
        if (result.message?.includes("modo demo")) toast.info(result.message)
        else toast.success(result.message)
        setOpen(false)
        router.refresh()
      } else if (result.status === "error" && result.message) {
        toast.error(result.message)
      }
      return result
    },
    INITIAL_STATE,
  )

  const errors: NewOsFieldErrors = state.fieldErrors ?? {}

  const clienteItems = React.useMemo<Record<string, string>>(
    () => ({
      "": "Selecione o cliente",
      ...Object.fromEntries(clientes.map((c) => [c.id, c.label])),
    }),
    [clientes],
  )

  const prediosDoCliente = React.useMemo(
    () => predios.filter((p) => p.clientId === clienteId),
    [predios, clienteId],
  )
  const predioItems = React.useMemo<Record<string, string>>(
    () => ({
      "": clienteId ? "Selecione o prédio" : "Escolha o cliente primeiro",
      ...Object.fromEntries(prediosDoCliente.map((p) => [p.id, p.label])),
    }),
    [prediosDoCliente, clienteId],
  )

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setClienteId("")
      setPredioId("")
      setEquipamentoId("")
      setTipo("")
      setPrioridade("media")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button className={triggerClassName} />
        }
      >
        <PlusIcon aria-hidden="true" />
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo chamado</DialogTitle>
          <DialogDescription>
            Informe o local, o tipo de serviço e o que está acontecendo.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} noValidate>
          <input type="hidden" name="client_id" value={clienteId} />
          <input type="hidden" name="building_id" value={predioId} />
          <input type="hidden" name="equipment_id" value={equipamentoId} />
          <input type="hidden" name="tipo" value={tipo} />
          <input type="hidden" name="prioridade" value={prioridade} />
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="os-cliente">Cliente</Label>
              <Select
                items={clienteItems}
                value={clienteId}
                onValueChange={(value: string | null) => {
                  setClienteId(value ?? "")
                  setPredioId("")
                  setEquipamentoId("")
                }}
              >
                <SelectTrigger
                  id="os-cliente"
                  aria-label="Cliente"
                  aria-invalid={errors.client_id ? true : undefined}
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(clienteItems).map(([value, label]) => (
                    <SelectItem key={value} value={value} disabled={value === ""}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.client_id && (
                <p className="text-xs text-danger">{errors.client_id}</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="os-predio">Prédio</Label>
                <Select
                  items={predioItems}
                  value={predioId}
                  onValueChange={(value: string | null) => {
                    setPredioId(value ?? "")
                    setEquipamentoId("")
                  }}
                >
                  <SelectTrigger
                    id="os-predio"
                    aria-label="Prédio"
                    aria-invalid={errors.building_id ? true : undefined}
                    disabled={!clienteId}
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(predioItems).map(([value, label]) => (
                      <SelectItem key={value} value={value} disabled={value === ""}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.building_id && (
                  <p className="text-xs text-danger">{errors.building_id}</p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="os-equipamento">Equipamento (opcional)</Label>
                <EquipmentCombobox
                  key={predioId}
                  id="os-equipamento"
                  buildingId={predioId}
                  value={equipamentoId}
                  onChange={(id) => setEquipamentoId(id)}
                  invalid={Boolean(errors.equipment_id)}
                  describedBy={errors.equipment_id ? "os-equipamento-erro" : undefined}
                />
                {errors.equipment_id && (
                  <p id="os-equipamento-erro" className="text-xs text-danger">
                    {errors.equipment_id}
                  </p>
                )}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="os-tipo">Tipo de serviço</Label>
                <Select
                  items={TIPO_ITEMS}
                  value={tipo}
                  onValueChange={(value: string | null) => setTipo(value ?? "")}
                >
                  <SelectTrigger
                    id="os-tipo"
                    aria-label="Tipo de serviço"
                    aria-invalid={errors.tipo ? true : undefined}
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_ITEMS).map(([value, label]) => (
                      <SelectItem key={value} value={value} disabled={value === ""}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.tipo && (
                  <p className="text-xs text-danger">{errors.tipo}</p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="os-prioridade">Prioridade</Label>
                <Select
                  items={PRIORIDADE_ITEMS}
                  value={prioridade}
                  onValueChange={(value: string | null) => {
                    if (value) setPrioridade(value)
                  }}
                >
                  <SelectTrigger
                    id="os-prioridade"
                    aria-label="Prioridade"
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORIDADE_ITEMS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="os-descricao">Descrição</Label>
              <Textarea
                id="os-descricao"
                name="descricao"
                placeholder="Ex.: Split da recepção não gela desde ontem; possível baixa de gás."
                rows={3}
                aria-invalid={errors.descricao ? true : undefined}
                aria-describedby={
                  errors.descricao ? "os-descricao-erro" : undefined
                }
              />
              {errors.descricao && (
                <p id="os-descricao-erro" className="text-xs text-danger">
                  {errors.descricao}
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={pending}
              aria-busy={pending}
            >
              {pending ? (
                <>
                  <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
                  Abrindo…
                </>
              ) : (
                "Abrir chamado"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
