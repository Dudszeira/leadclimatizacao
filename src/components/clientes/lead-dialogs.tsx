"use client"

import * as React from "react"
import {
  ArrowRightIcon,
  EllipsisVerticalIcon,
  PencilLineIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"

import type { Lead, LeadStage } from "@/lib/types"
import { maskPhone } from "@/lib/format"
import { deleteLead, moveLeadStage, saveLead } from "@/server/actions/cadastros"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDialog, Field, SelectField, SubmitButton, invalidProps, useCadastroAction } from "./form-kit"
import { ORIGIN_LABELS, STAGE_LABELS } from "./lead-labels"
import { LEAD_STAGES, fieldErrorsFrom, leadSchema, type LeadInput } from "./schemas"

function initial(lead?: Lead, estagio?: LeadStage): Required<LeadInput> {
  return {
    id: lead?.id ?? "",
    nome_contato: lead?.nome_contato ?? "",
    empresa: lead?.empresa ?? "",
    telefone: lead?.telefone ? maskPhone(lead.telefone) : "",
    email: lead?.email ?? "",
    origem: lead?.origem ?? "whatsapp",
    estagio: lead?.estagio ?? estagio ?? "lead",
    valor_estimado: lead?.valor_estimado != null ? String(lead.valor_estimado).replace(".", ",") : "",
    motivo_perda: lead?.motivo_perda ?? "",
    observacoes: lead?.observacoes ?? "",
  }
}

export function LeadFormDialog({
  open,
  onOpenChange,
  lead,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  lead?: Lead
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{lead ? "Editar lead" : "Novo lead"}</DialogTitle>
          <DialogDescription>Contato comercial e etapa no funil.</DialogDescription>
        </DialogHeader>
        {open && <LeadForm lead={lead} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function LeadForm({ lead, onClose }: { lead?: Lead; onClose: () => void }) {
  const [form, setForm] = React.useState(() => initial(lead))
  const { pending, run, fieldErrors: errors, setFieldErrors } = useCadastroAction()
  const set = (key: keyof LeadInput) => (value: string) => setForm((f) => ({ ...f, [key]: value }))

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const check = leadSchema.safeParse(form)
    if (!check.success) {
      setFieldErrors(fieldErrorsFrom(check.error))
      return
    }
    run(() => saveLead(form), onClose)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="lead-nome" label="Contato" error={errors.nome_contato}>
          <Input
            id="lead-nome"
            value={form.nome_contato}
            onChange={(e) => set("nome_contato")(e.target.value)}
            autoComplete="name"
            {...invalidProps("lead-nome", errors.nome_contato)}
          />
        </Field>
        <Field id="lead-empresa" label="Empresa" error={errors.empresa}>
          <Input
            id="lead-empresa"
            value={form.empresa}
            onChange={(e) => set("empresa")(e.target.value)}
            autoComplete="organization"
            {...invalidProps("lead-empresa", errors.empresa)}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="lead-telefone" label="Telefone" error={errors.telefone}>
          <Input
            id="lead-telefone"
            type="tel"
            value={form.telefone}
            onChange={(e) => set("telefone")(maskPhone(e.target.value))}
            placeholder="(41) 99999-9999"
            inputMode="tel"
            autoComplete="tel"
            {...invalidProps("lead-telefone", errors.telefone)}
          />
        </Field>
        <Field id="lead-email" label="E-mail" error={errors.email}>
          <Input
            id="lead-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={form.email}
            onChange={(e) => set("email")(e.target.value)}
            {...invalidProps("lead-email", errors.email)}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="lead-origem" label="Origem" error={errors.origem}>
          <SelectField id="lead-origem" value={form.origem} onChange={set("origem")} items={ORIGIN_LABELS} error={errors.origem} />
        </Field>
        <Field id="lead-etapa" label="Etapa" error={errors.estagio}>
          <SelectField id="lead-etapa" value={form.estagio} onChange={set("estagio")} items={STAGE_LABELS} error={errors.estagio} />
        </Field>
        <Field id="lead-valor" label="Valor estimado (R$)" error={errors.valor_estimado} className="sm:col-span-2">
          <Input
            id="lead-valor"
            value={form.valor_estimado}
            onChange={(e) => set("valor_estimado")(e.target.value.replace(/[^\d.,]/g, ""))}
            inputMode="decimal"
            placeholder="12.500,00"
            {...invalidProps("lead-valor", errors.valor_estimado)}
          />
        </Field>
      </div>
      {form.estagio === "perdido" && (
        <Field id="lead-motivo" label="Motivo da perda" error={errors.motivo_perda}>
          <Input
            id="lead-motivo"
            value={form.motivo_perda}
            onChange={(e) => set("motivo_perda")(e.target.value)}
            {...invalidProps("lead-motivo", errors.motivo_perda)}
          />
        </Field>
      )}
      <Field id="lead-obs" label="Observações" error={errors.observacoes}>
        <Textarea
          id="lead-obs"
          value={form.observacoes}
          onChange={(e) => set("observacoes")(e.target.value)}
          rows={3}
          {...invalidProps("lead-obs", errors.observacoes)}
        />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <SubmitButton pending={pending}>{lead ? "Salvar alterações" : "Cadastrar lead"}</SubmitButton>
      </DialogFooter>
    </form>
  )
}

export function NewLeadButton() {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon aria-hidden="true" />
        Novo lead
      </Button>
      <LeadFormDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

/** Próxima etapa natural do funil (venda e perdido são finais). */
function nextStage(stage: LeadStage): LeadStage | null {
  if (stage === "venda" || stage === "perdido") return null
  const i = LEAD_STAGES.indexOf(stage)
  const next = LEAD_STAGES[i + 1]
  return next && next !== "perdido" ? next : null
}

/** Botão visível no card: avança o lead para a próxima etapa sem abrir o menu. */
export function LeadAdvanceButton({ lead }: { lead: Lead }) {
  const { pending, run } = useCadastroAction()
  const next = nextStage(lead.estagio)
  if (!next) return null
  return (
    <Button
      type="button"
      variant="secondary"
      className="mt-3 w-full min-w-0 justify-center"
      disabled={pending}
      aria-busy={pending}
      title={`Avançar para ${STAGE_LABELS[next]}`}
      aria-label={`Avançar para ${STAGE_LABELS[next]}`}
      onClick={() => run(() => moveLeadStage({ id: lead.id, estagio: next }))}
    >
      {/* Kanban do desktop tem colunas estreitas: só o verbo, o destino vai no title. */}
      <span className="truncate lg:hidden">Avançar para {STAGE_LABELS[next]}</span>
      <span className="max-lg:hidden">Avançar</span>
      <ArrowRightIcon aria-hidden="true" />
    </Button>
  )
}

/** Menu do card: mover de etapa, editar, excluir (admin). */
export function LeadCardActions({ lead, canDelete }: { lead: Lead; canDelete: boolean }) {
  const [dialog, setDialog] = React.useState<"editar" | "perdido" | "excluir" | null>(null)
  const [motivo, setMotivo] = React.useState("")
  const close = (open: boolean) => !open && setDialog(null)
  const { pending, run } = useCadastroAction()

  function mover(estagio: LeadStage) {
    if (estagio === "perdido") {
      setMotivo(lead.motivo_perda ?? "")
      setDialog("perdido")
      return
    }
    run(() => moveLeadStage({ id: lead.id, estagio }))
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={pending}
          render={
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              aria-label={`Ações do lead ${lead.nome_contato}`}
              aria-busy={pending}
            />
          }
        >
          <EllipsisVerticalIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Mover para</DropdownMenuLabel>
            {LEAD_STAGES.filter((s) => s !== lead.estagio).map((s) => (
              <DropdownMenuItem key={s} onClick={() => mover(s)}>
                <ArrowRightIcon aria-hidden="true" />
                {STAGE_LABELS[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDialog("editar")}>
            <PencilLineIcon aria-hidden="true" />
            Editar lead
          </DropdownMenuItem>
          {canDelete && (
            <DropdownMenuItem variant="destructive" onClick={() => setDialog("excluir")}>
              <Trash2Icon aria-hidden="true" />
              Excluir lead
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <LeadFormDialog open={dialog === "editar"} onOpenChange={close} lead={lead} />
      <ConfirmDialog
        open={dialog === "perdido"}
        onOpenChange={close}
        title="Marcar como perdido"
        description={`Registre o motivo da perda de ${lead.empresa ?? lead.nome_contato}. Isso ajuda a entender o funil.`}
        confirmLabel="Marcar como perdido"
        action={() => moveLeadStage({ id: lead.id, estagio: "perdido", motivo_perda: motivo })}
      >
        <Field id={`motivo-${lead.id}`} label="Motivo da perda">
          <Input
            id={`motivo-${lead.id}`}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: fechou com concorrente por preço"
          />
        </Field>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === "excluir"}
        onOpenChange={close}
        title="Excluir lead?"
        description="O lead é apagado definitivamente. Para manter o histórico do funil, prefira movê-lo para Perdido."
        confirmLabel="Excluir lead"
        action={() => deleteLead(lead.id)}
      />
    </>
  )
}
