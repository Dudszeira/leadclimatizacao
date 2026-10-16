"use client"

import * as React from "react"
import { PowerIcon, PowerOffIcon, ReceiptTextIcon } from "lucide-react"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ConfirmDialog, Field, SubmitButton, invalidProps, useCadastroAction } from "./form-kit"
import { fieldErrorsFrom, fiscalSchema } from "./schemas"

/** Inativar/reativar cliente com confirmação (nunca apaga). */
export function ClientStatusButton({ client }: { client: Pick<Client, "id" | "razao_social" | "ativo"> }) {
  const [open, setOpen] = React.useState(false)
  const inativar = client.ativo
  return (
    <>
      <Button
        variant="outline"
        className="h-9 px-3 max-md:h-11"
        onClick={() => setOpen(true)}
      >
        {inativar ? <PowerOffIcon aria-hidden="true" /> : <PowerIcon aria-hidden="true" />}
        {inativar ? "Inativar" : "Reativar"}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
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
export function FiscalDialog({ client }: { client: FiscalClient }) {
  const [open, setOpen] = React.useState(false)
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
      <DialogTrigger render={<Button variant="outline" className="h-9 px-3 max-md:h-11" />}>
        <ReceiptTextIcon aria-hidden="true" />
        Dados fiscais
      </DialogTrigger>
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
                className="font-mono max-md:h-11"
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
                className="font-mono max-md:h-11"
                {...invalidProps("fiscal-aliquota", errors.aliquota_iss)}
              />
            </Field>
          </div>
          <div className="flex items-start gap-2.5 rounded-lg border border-line bg-console-2/50 p-3">
            <input
              id="fiscal-reter"
              type="checkbox"
              checked={form.reter_iss}
              onChange={(e) => setForm((f) => ({ ...f, reter_iss: e.target.checked }))}
              className="mt-0.5 size-4 accent-signal"
            />
            <Label htmlFor="fiscal-reter" className="grid gap-0.5 font-normal">
              <span className="text-ink">ISS retido pelo tomador</span>
              <span className="text-xs text-ink-faint">
                Marque quando o cliente recolhe o ISS na fonte.
              </span>
            </Label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="max-md:h-11"
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
