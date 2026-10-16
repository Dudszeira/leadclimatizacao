"use client"

import * as React from "react"
import { EllipsisIcon, PowerIcon, PowerOffIcon, ReceiptTextIcon } from "lucide-react"

import type { Client } from "@/lib/types"
import { saveClientFiscal, setClientAtivo } from "@/server/actions/clients"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ConfirmDialog, Field, SubmitButton, invalidProps, useCadastroAction } from "./form-kit"
import { fieldErrorsFrom, fiscalSchema } from "./schemas"

type MenuClient = Pick<
  Client,
  "id" | "razao_social" | "ativo" | "codigo_servico_municipal" | "aliquota_iss" | "reter_iss"
>

/**
 * Menu "Mais" do detalhe do cliente: dados fiscais e inativar/reativar
 * (ação destrutiva fica no menu, com confirmação; nunca apaga).
 */
export function ClientActionsMenu({ client }: { client: MenuClient }) {
  const [dialog, setDialog] = React.useState<"fiscal" | "status" | null>(null)
  const close = (open: boolean) => !open && setDialog(null)
  const inativar = client.ativo
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="secondary" aria-label="Mais ações do cliente" />}
        >
          <EllipsisIcon aria-hidden="true" />
          <span className="md:sr-only">Mais</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuItem onClick={() => setDialog("fiscal")}>
            <ReceiptTextIcon aria-hidden="true" />
            Dados fiscais (NFS-e)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant={inativar ? "destructive" : "default"}
            onClick={() => setDialog("status")}
          >
            {inativar ? <PowerOffIcon aria-hidden="true" /> : <PowerIcon aria-hidden="true" />}
            {inativar ? "Inativar cliente" : "Reativar cliente"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <FiscalDialog
        client={client}
        open={dialog === "fiscal"}
        onOpenChange={close}
      />
      <ConfirmDialog
        open={dialog === "status"}
        onOpenChange={close}
        title={inativar ? "Inativar cliente?" : "Reativar cliente?"}
        description={
          inativar
            ? `${client.razao_social} sai das listas de clientes ativos. Prédios, equipamentos, contratos e o histórico de OS são mantidos. Dá para reativar depois.`
            : `${client.razao_social} volta a aparecer como cliente ativo.`
        }
        confirmLabel={inativar ? "Inativar cliente" : "Reativar cliente"}
        destructive={inativar}
        action={() => setClientAtivo({ id: client.id, ativo: !inativar })}
      />
    </>
  )
}

type FiscalClient = Pick<Client, "id" | "codigo_servico_municipal" | "aliquota_iss" | "reter_iss">

/** Dados fiscais do tomador para a NFS-e (código municipal e ISS). */
export function FiscalDialog({
  client,
  open: openProp,
  onOpenChange,
}: {
  client: FiscalClient
  /** Controlado pelo pai (ex.: menu "Mais"): sem botão próprio. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [openState, setOpenState] = React.useState(false)
  const controlled = openProp !== undefined
  const open = controlled ? openProp : openState
  const setOpen = (next: boolean) => {
    if (!controlled) setOpenState(next)
    onOpenChange?.(next)
  }
  const initial = React.useCallback(
    () => ({
      client_id: client.id,
      codigo_servico_municipal: client.codigo_servico_municipal ?? "",
      aliquota_iss: String(client.aliquota_iss ?? 5).replace(".", ","),
      reter_iss: client.reter_iss ?? false,
    }),
    [client],
  )
  const [form, setForm] = React.useState(initial)
  const { pending, run, fieldErrors: errors, setFieldErrors } = useCadastroAction()

  function handleOpenChange(next: boolean) {
    if (pending) return
    setOpen(next)
    if (next) {
      setForm(initial())
      setFieldErrors({})
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const check = fiscalSchema.safeParse(form)
    if (!check.success) {
      setFieldErrors(fieldErrorsFrom(check.error))
      return
    }
    run(() => saveClientFiscal(form), () => setOpen(false))
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!controlled && (
        <DialogTrigger render={<Button variant="secondary" />}>
          <ReceiptTextIcon aria-hidden="true" />
          Dados fiscais
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dados fiscais (NFS-e)</DialogTitle>
          <DialogDescription>
            Usados na emissão da nota de serviço pela prefeitura de Curitiba.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="fiscal-codigo"
              label="Código do serviço municipal"
              error={errors.codigo_servico_municipal}
              hint="Ex.: 14.01"
            >
              <Input
                id="fiscal-codigo"
                value={form.codigo_servico_municipal}
                onChange={(e) => setForm((f) => ({ ...f, codigo_servico_municipal: e.target.value }))}
                {...invalidProps("fiscal-codigo", errors.codigo_servico_municipal)}
              />
            </Field>
            <Field id="fiscal-aliquota" label="Alíquota ISS (%)" error={errors.aliquota_iss}>
              <Input
                id="fiscal-aliquota"
                value={form.aliquota_iss}
                onChange={(e) =>
                  setForm((f) => ({ ...f, aliquota_iss: e.target.value.replace(/[^\d.,]/g, "") }))
                }
                inputMode="decimal"
                {...invalidProps("fiscal-aliquota", errors.aliquota_iss)}
              />
            </Field>
          </div>
          <Label
            htmlFor="fiscal-reter"
            className="flex min-h-14 cursor-pointer items-start gap-3 rounded-2xl bg-console/60 p-4 font-normal ring-1 ring-line-soft"
          >
            <input
              id="fiscal-reter"
              type="checkbox"
              checked={form.reter_iss}
              onChange={(e) => setForm((f) => ({ ...f, reter_iss: e.target.checked }))}
              className="mt-0.5 size-5 shrink-0 accent-signal"
            />
            <span className="grid gap-1 leading-snug">
              <span className="text-ink">ISS retido pelo tomador</span>
              <span className="text-[0.8125rem] text-ink-faint">
                Marque quando o cliente recolhe o ISS na fonte.
              </span>
            </span>
          </Label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <SubmitButton pending={pending}>Salvar dados fiscais</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
