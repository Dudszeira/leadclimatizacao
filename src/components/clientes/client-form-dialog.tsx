"use client"

import * as React from "react"
import { PencilLineIcon, PlusIcon } from "lucide-react"

import type { Client } from "@/lib/types"
import { maskPhone } from "@/lib/format"
import { SEGMENTO_LABELS } from "@/lib/status-meta"
import { saveClient } from "@/server/actions/clients"
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
import { Textarea } from "@/components/ui/textarea"
import { Field, SelectField, SubmitButton, invalidProps, useCadastroAction } from "./form-kit"
import { clientSchema, fieldErrorsFrom, type ClientInput } from "./schemas"
import { maskDocumento } from "./validators"

type ClientFormDialogProps = {
  /** Cliente existente = modo edição; ausente = cadastro. */
  client?: Pick<
    Client,
    | "id"
    | "razao_social"
    | "nome_fantasia"
    | "cnpj"
    | "segmento"
    | "contato_nome"
    | "contato_email"
    | "contato_telefone"
    | "observacoes"
  >
  triggerLabel?: string
  triggerVariant?: "default" | "outline"
  triggerClassName?: string
}

const SEM_SEGMENTO = "_nenhum"
const SEGMENTO_ITEMS: Record<string, string> = { [SEM_SEGMENTO]: "Sem segmento", ...SEGMENTO_LABELS }

function initialState(client?: ClientFormDialogProps["client"]): Required<ClientInput> {
  return {
    id: client?.id ?? "",
    razao_social: client?.razao_social ?? "",
    nome_fantasia: client?.nome_fantasia ?? "",
    documento: client?.cnpj ? maskDocumento(client.cnpj) : "",
    segmento: client?.segmento ?? "",
    contato_nome: client?.contato_nome ?? "",
    contato_email: client?.contato_email ?? "",
    contato_telefone: client?.contato_telefone ? maskPhone(client.contato_telefone) : "",
    observacoes: client?.observacoes ?? "",
  }
}

export function ClientFormDialog({
  client,
  triggerLabel,
  triggerVariant,
  triggerClassName,
}: ClientFormDialogProps) {
  const isEdit = Boolean(client)
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState(() => initialState(client))
  const { pending, run, fieldErrors: errors, setFieldErrors } = useCadastroAction()

  const set = (key: keyof ClientInput) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  function handleOpenChange(next: boolean) {
    if (pending) return
    setOpen(next)
    if (next) {
      setForm(initialState(client))
      setFieldErrors({})
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const check = clientSchema.safeParse(form)
    if (!check.success) {
      setFieldErrors(fieldErrorsFrom(check.error))
      return
    }
    run(() => saveClient(form), () => setOpen(false))
  }

  const label = triggerLabel ?? (isEdit ? "Editar" : "Novo cliente")

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant={triggerVariant ?? (isEdit ? "outline" : "default")}
            className={triggerClassName ?? "h-9 px-3 max-md:h-11 max-md:px-4"}
          />
        }
      >
        {isEdit ? <PencilLineIcon aria-hidden="true" /> : <PlusIcon aria-hidden="true" />}
        {label}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cliente" : "Cadastrar cliente"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize os dados cadastrais e o contato principal."
              : "Dados cadastrais da empresa (ou pessoa física) e contato principal."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="grid gap-4">
          <Field id="cliente-razao-social" label="Razão social" error={errors.razao_social}>
            <Input
              id="cliente-razao-social"
              value={form.razao_social}
              onChange={(e) => set("razao_social")(e.target.value)}
              placeholder="Ex.: Condomínio Edifício Torres do Batel"
              autoComplete="organization"
              required
              className="max-md:h-11"
              {...invalidProps("cliente-razao-social", errors.razao_social)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="cliente-fantasia" label="Nome fantasia" error={errors.nome_fantasia}>
              <Input
                id="cliente-fantasia"
                value={form.nome_fantasia}
                onChange={(e) => set("nome_fantasia")(e.target.value)}
                className="max-md:h-11"
                {...invalidProps("cliente-fantasia", errors.nome_fantasia)}
              />
            </Field>
            <Field id="cliente-documento" label="CNPJ ou CPF" error={errors.documento}>
              <Input
                id="cliente-documento"
                value={form.documento}
                onChange={(e) => set("documento")(maskDocumento(e.target.value))}
                placeholder="00.000.000/0000-00"
                inputMode="numeric"
                autoComplete="off"
                className="font-mono max-md:h-11"
                {...invalidProps("cliente-documento", errors.documento)}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="cliente-segmento" label="Segmento" error={errors.segmento}>
              <SelectField
                id="cliente-segmento"
                value={form.segmento || SEM_SEGMENTO}
                onChange={(v) => set("segmento")(v === SEM_SEGMENTO ? "" : v)}
                items={
                  form.segmento && !(form.segmento in SEGMENTO_ITEMS)
                    ? { ...SEGMENTO_ITEMS, [form.segmento]: form.segmento }
                    : SEGMENTO_ITEMS
                }
                error={errors.segmento}
              />
            </Field>
            <Field id="cliente-contato" label="Contato" error={errors.contato_nome}>
              <Input
                id="cliente-contato"
                value={form.contato_nome}
                onChange={(e) => set("contato_nome")(e.target.value)}
                placeholder="Nome do responsável"
                autoComplete="name"
                className="max-md:h-11"
                {...invalidProps("cliente-contato", errors.contato_nome)}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="cliente-email" label="E-mail" error={errors.contato_email}>
              <Input
                id="cliente-email"
                type="email"
                value={form.contato_email}
                onChange={(e) => set("contato_email")(e.target.value)}
                placeholder="contato@empresa.com.br"
                autoComplete="email"
                className="max-md:h-11"
                {...invalidProps("cliente-email", errors.contato_email)}
              />
            </Field>
            <Field id="cliente-telefone" label="Telefone" error={errors.contato_telefone}>
              <Input
                id="cliente-telefone"
                type="tel"
                value={form.contato_telefone}
                onChange={(e) => set("contato_telefone")(maskPhone(e.target.value))}
                placeholder="(41) 99999-9999"
                inputMode="tel"
                autoComplete="tel"
                className="font-mono max-md:h-11"
                {...invalidProps("cliente-telefone", errors.contato_telefone)}
              />
            </Field>
          </div>
          <Field id="cliente-obs" label="Observações" error={errors.observacoes}>
            <Textarea
              id="cliente-obs"
              value={form.observacoes}
              onChange={(e) => set("observacoes")(e.target.value)}
              rows={3}
              {...invalidProps("cliente-obs", errors.observacoes)}
            />
          </Field>
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
            <SubmitButton pending={pending}>
              {isEdit ? "Salvar alterações" : "Cadastrar cliente"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
