"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { LoaderCircleIcon, PencilLineIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import type { Contract, ContractStatus, ContractType } from "@/lib/types"
import { CONTRACT_STATUS_META, CONTRACT_TYPE_META } from "@/lib/status-meta"
import {
  saveContract,
  type ContractActionState,
  type ContractField,
} from "@/server/actions/contracts"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

export type ContractClientOption = { id: string; label: string }

type ContractFormDialogProps = {
  clients: ContractClientOption[]
  /** Contrato existente = edição; ausente = cadastro. */
  contract?: Pick<
    Contract,
    | "id"
    | "client_id"
    | "tipo"
    | "valor_mensal"
    | "dia_vencimento"
    | "inicio"
    | "fim"
    | "status"
    | "observacoes"
  >
  /** Data de hoje (BRT) calculada no servidor — default do início. */
  hoje: string
  triggerClassName?: string
  /** Modo controlado (ex. aberto a partir de um menu): sem botão próprio. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const INITIAL_STATE: ContractActionState = { status: "idle" }

const TIPO_ITEMS = Object.fromEntries(
  Object.entries(CONTRACT_TYPE_META).map(([k, v]) => [k, v.label]),
) as Record<ContractType, string>

const STATUS_ITEMS = Object.fromEntries(
  Object.entries(CONTRACT_STATUS_META).map(([k, v]) => [k, v.label]),
) as Record<ContractStatus, string>

function valorParaCampo(valor: number | undefined): string {
  if (valor === undefined) return ""
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="text-xs text-danger">
      {message}
    </p>
  )
}

/** Cadastro/edição de contrato (abre em diálogo, padrão de clientes). */
export function ContractFormDialog({
  clients,
  contract,
  hoje,
  triggerClassName,
  open: openProp,
  onOpenChange,
}: ContractFormDialogProps) {
  const router = useRouter()
  const isEdit = Boolean(contract)
  const controlled = openProp !== undefined
  const [openState, setOpenState] = React.useState(false)
  const open = controlled ? openProp : openState
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!controlled) setOpenState(next)
      onOpenChange?.(next)
    },
    [controlled, onOpenChange],
  )

  const [clientId, setClientId] = React.useState(contract?.client_id ?? "")
  const [tipo, setTipo] = React.useState<ContractType>(contract?.tipo ?? "pmoc_recorrente")
  const [status, setStatus] = React.useState<ContractStatus>(contract?.status ?? "ativo")
  // Ao abrir (inclusive pelo menu, em modo controlado), restaura os valores do contrato.
  const [prevOpen, setPrevOpen] = React.useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setClientId(contract?.client_id ?? "")
      setTipo(contract?.tipo ?? "pmoc_recorrente")
      setStatus(contract?.status ?? "ativo")
    }
  }
  const [state, formAction, pending] = React.useActionState(
    async (prev: ContractActionState, formData: FormData) => {
      const result = await saveContract(prev, formData)
      if (result.status === "success") {
        toast.success(result.message)
        setOpen(false)
        router.refresh()
      } else if (result.status === "info") {
        toast.info(result.message)
      } else if (result.status === "error" && result.message) {
        toast.error(result.message)
      }
      return result
    },
    INITIAL_STATE,
  )
  const errors = state.fieldErrors ?? {}
  const err = (f: ContractField) => errors[f]
  const describedBy = (f: ContractField) => (errors[f] ? `contrato-${f}-erro` : undefined)

  const clientItems: Record<string, string> = Object.fromEntries(
    clients.map((c) => [c.id, c.label]),
  )

  function handleOpenChange(next: boolean) {
    setOpen(next)
  }

  const prefix = contract ? `contrato-${contract.id.slice(0, 8)}` : "contrato-novo"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {controlled ? null : (
        <DialogTrigger
          render={
            isEdit ? (
              <Button variant="ghost" className={triggerClassName} />
            ) : (
              <Button className={triggerClassName} />
            )
          }
        >
          {isEdit ? <PencilLineIcon aria-hidden="true" /> : <PlusIcon aria-hidden="true" />}
          {isEdit ? "Editar" : "Novo contrato"}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar contrato" : "Cadastrar contrato"}</DialogTitle>
          <DialogDescription>
            Contratos ativos (exceto corretiva avulsa) geram uma fatura por mês,
            com vencimento no dia escolhido.
          </DialogDescription>
        </DialogHeader>
        {/* Envio manual (sem <form action>) para o React não limpar os campos quando há erro. */}
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            if (pending) return
            const formData = new FormData(event.currentTarget)
            React.startTransition(() => formAction(formData))
          }}
        >
          {contract ? <input type="hidden" name="id" value={contract.id} /> : null}
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="tipo" value={tipo} />
          <input type="hidden" name="status" value={status} />
          <div className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor={`${prefix}-cliente`}>Cliente</Label>
              <Select
                items={clientItems}
                value={clientId || null}
                onValueChange={(value: string | null) => setClientId(value ?? "")}
                disabled={isEdit}
              >
                <SelectTrigger
                  id={`${prefix}-cliente`}
                  aria-label="Cliente"
                  aria-invalid={err("client_id") ? true : undefined}
                  aria-describedby={describedBy("client_id")}
                  className="w-full"
                >
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError id="contrato-client_id-erro" message={err("client_id")} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor={`${prefix}-tipo`}>Tipo</Label>
                <Select
                  items={TIPO_ITEMS}
                  value={tipo}
                  onValueChange={(value: string | null) => value && setTipo(value as ContractType)}
                >
                  <SelectTrigger id={`${prefix}-tipo`} aria-label="Tipo" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_ITEMS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError id="contrato-tipo-erro" message={err("tipo")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${prefix}-status`}>Status</Label>
                <Select
                  items={STATUS_ITEMS}
                  value={status}
                  onValueChange={(value: string | null) => value && setStatus(value as ContractStatus)}
                >
                  <SelectTrigger id={`${prefix}-status`} aria-label="Status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_ITEMS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError id="contrato-status-erro" message={err("status")} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor={`${prefix}-valor`}>Valor mensal (R$)</Label>
                <Input
                  id={`${prefix}-valor`}
                  name="valor_mensal"
                  inputMode="decimal"
                  defaultValue={valorParaCampo(contract?.valor_mensal)}
                  placeholder="0,00"
                  aria-invalid={err("valor_mensal") ? true : undefined}
                  aria-describedby={describedBy("valor_mensal")}
                  className="tabular-nums"
                />
                <FieldError id="contrato-valor_mensal-erro" message={err("valor_mensal")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${prefix}-dia`}>Dia de vencimento</Label>
                <Input
                  id={`${prefix}-dia`}
                  name="dia_vencimento"
                  type="number"
                  min={1}
                  max={28}
                  inputMode="numeric"
                  defaultValue={contract?.dia_vencimento ?? 10}
                  aria-invalid={err("dia_vencimento") ? true : undefined}
                  aria-describedby={describedBy("dia_vencimento")}
                  className="tabular-nums"
                />
                <FieldError id="contrato-dia_vencimento-erro" message={err("dia_vencimento")} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor={`${prefix}-inicio`}>Início da vigência</Label>
                <Input
                  id={`${prefix}-inicio`}
                  name="inicio"
                  type="date"
                  defaultValue={contract?.inicio ?? hoje}
                  aria-invalid={err("inicio") ? true : undefined}
                  aria-describedby={describedBy("inicio")}
                  
                />
                <FieldError id="contrato-inicio-erro" message={err("inicio")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${prefix}-fim`}>Fim (opcional)</Label>
                <Input
                  id={`${prefix}-fim`}
                  name="fim"
                  type="date"
                  defaultValue={contract?.fim ?? ""}
                  aria-invalid={err("fim") ? true : undefined}
                  aria-describedby={describedBy("fim")}
                  
                />
                <FieldError id="contrato-fim-erro" message={err("fim")} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`${prefix}-obs`}>Observações</Label>
              <Textarea
                id={`${prefix}-obs`}
                name="observacoes"
                maxLength={1000}
                defaultValue={contract?.observacoes ?? ""}
                placeholder="Escopo, equipamentos cobertos, condições…"
                aria-invalid={err("observacoes") ? true : undefined}
              />
              <FieldError id="contrato-observacoes-erro" message={err("observacoes")} />
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
            <Button type="submit" disabled={pending} aria-busy={pending}>
              {pending ? (
                <>
                  <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
                  Salvando…
                </>
              ) : isEdit ? (
                "Salvar alterações"
              ) : (
                "Cadastrar contrato"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
