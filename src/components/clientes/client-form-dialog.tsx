"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { LoaderCircleIcon, PencilLineIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import type { Client } from "@/lib/types"
import {
  saveClient,
  type ClientActionState,
  type ClientFieldErrors,
} from "@/server/actions/clients"
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
import { isValidCnpj, maskCnpj, maskPhone, onlyDigits } from "@/lib/format"

const INITIAL_STATE: ClientActionState = { status: "idle" }

type ClientFormDialogProps = {
  /** Cliente existente = modo edição; ausente = cadastro. */
  client?: Pick<
    Client,
    "id" | "razao_social" | "cnpj" | "contato_nome" | "contato_email" | "contato_telefone"
  >
  triggerLabel?: string
  triggerVariant?: "default" | "outline"
  triggerClassName?: string
}

function validateOnClient(formData: FormData): ClientFieldErrors {
  const errors: ClientFieldErrors = {}
  const razao = String(formData.get("razao_social") ?? "").trim()
  if (razao.length < 3) {
    errors.razao_social = "Informe a razão social (mínimo 3 caracteres)."
  }
  const cnpj = String(formData.get("cnpj") ?? "").trim()
  if (cnpj && !isValidCnpj(cnpj)) {
    errors.cnpj = "CNPJ inválido — confira os dígitos."
  }
  const email = String(formData.get("contato_email") ?? "").trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.contato_email = "E-mail inválido."
  }
  const telefone = String(formData.get("contato_telefone") ?? "").trim()
  if (telefone && onlyDigits(telefone).length < 10) {
    errors.contato_telefone = "Telefone incompleto — use DDD + número."
  }
  return errors
}

export function ClientFormDialog({
  client,
  triggerLabel,
  triggerVariant,
  triggerClassName,
}: ClientFormDialogProps) {
  const router = useRouter()
  const isEdit = Boolean(client)
  const [open, setOpen] = React.useState(false)
  const [cnpj, setCnpj] = React.useState("")
  const [telefone, setTelefone] = React.useState("")
  const [clientErrors, setClientErrors] = React.useState<ClientFieldErrors>({})
  const [state, formAction, pending] = React.useActionState(
    async (prev: ClientActionState, formData: FormData) => {
      const result = await saveClient(prev, formData)
      if (result.status === "success") {
        toast.success(result.message)
        setOpen(false)
        router.refresh()
      } else if (result.status === "error" && result.message) {
        toast.error(result.message)
      }
      return result
    },
    INITIAL_STATE,
  )

  const errors: ClientFieldErrors = { ...state.fieldErrors, ...clientErrors }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setCnpj(client?.cnpj ? maskCnpj(client.cnpj) : "")
      setTelefone(client?.contato_telefone ? maskPhone(client.contato_telefone) : "")
      setClientErrors({})
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const found = validateOnClient(new FormData(event.currentTarget))
    setClientErrors(found)
    if (Object.keys(found).length > 0) {
      event.preventDefault()
    }
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
        {isEdit ? (
          <PencilLineIcon aria-hidden="true" />
        ) : (
          <PlusIcon aria-hidden="true" />
        )}
        {label}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar cliente" : "Cadastrar cliente"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize os dados cadastrais e o contato principal."
              : "Dados cadastrais da empresa e contato principal."}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} onSubmit={handleSubmit} noValidate>
          {isEdit && <input type="hidden" name="id" value={client?.id} />}
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="cliente-razao-social">Razão social</Label>
              <Input
                id="cliente-razao-social"
                name="razao_social"
                defaultValue={client?.razao_social ?? ""}
                placeholder="Ex.: Condomínio Edifício Torres do Batel"
                autoComplete="organization"
                required
                aria-invalid={errors.razao_social ? true : undefined}
                aria-describedby={
                  errors.razao_social ? "cliente-razao-social-erro" : undefined
                }
                className="max-md:h-11"
              />
              {errors.razao_social && (
                <p
                  id="cliente-razao-social-erro"
                  className="text-xs text-danger"
                >
                  {errors.razao_social}
                </p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="cliente-cnpj">CNPJ</Label>
                <Input
                  id="cliente-cnpj"
                  name="cnpj"
                  value={cnpj}
                  onChange={(e) => setCnpj(maskCnpj(e.target.value))}
                  placeholder="00.000.000/0000-00"
                  inputMode="numeric"
                  autoComplete="off"
                  aria-invalid={errors.cnpj ? true : undefined}
                  aria-describedby={errors.cnpj ? "cliente-cnpj-erro" : undefined}
                  className="font-mono max-md:h-11"
                />
                {errors.cnpj && (
                  <p id="cliente-cnpj-erro" className="text-xs text-danger">
                    {errors.cnpj}
                  </p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cliente-contato">Contato</Label>
                <Input
                  id="cliente-contato"
                  name="contato_nome"
                  defaultValue={client?.contato_nome ?? ""}
                  placeholder="Nome do responsável"
                  autoComplete="name"
                  aria-invalid={errors.contato_nome ? true : undefined}
                  className="max-md:h-11"
                />
                {errors.contato_nome && (
                  <p className="text-xs text-danger">{errors.contato_nome}</p>
                )}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="cliente-email">E-mail</Label>
                <Input
                  id="cliente-email"
                  name="contato_email"
                  type="email"
                  defaultValue={client?.contato_email ?? ""}
                  placeholder="contato@empresa.com.br"
                  autoComplete="email"
                  aria-invalid={errors.contato_email ? true : undefined}
                  aria-describedby={
                    errors.contato_email ? "cliente-email-erro" : undefined
                  }
                  className="max-md:h-11"
                />
                {errors.contato_email && (
                  <p id="cliente-email-erro" className="text-xs text-danger">
                    {errors.contato_email}
                  </p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cliente-telefone">Telefone</Label>
                <Input
                  id="cliente-telefone"
                  name="contato_telefone"
                  type="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(maskPhone(e.target.value))}
                  placeholder="(41) 99999-9999"
                  inputMode="tel"
                  autoComplete="tel"
                  aria-invalid={errors.contato_telefone ? true : undefined}
                  aria-describedby={
                    errors.contato_telefone ? "cliente-telefone-erro" : undefined
                  }
                  className="font-mono max-md:h-11"
                />
                {errors.contato_telefone && (
                  <p id="cliente-telefone-erro" className="text-xs text-danger">
                    {errors.contato_telefone}
                  </p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="max-md:h-11"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              className="max-md:h-11"
            >
              {pending ? (
                <>
                  <LoaderCircleIcon
                    className="animate-spin"
                    aria-hidden="true"
                  />
                  Salvando…
                </>
              ) : isEdit ? (
                "Salvar alterações"
              ) : (
                "Cadastrar cliente"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
