"use client"

import * as React from "react"
import { InfoIcon } from "lucide-react"

import type { PmocPlan } from "@/lib/types"
import { savePmocPlan } from "@/server/actions/pmoc"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Field,
  SelectField,
  SubmitButton,
  invalidProps,
  useCadastroAction,
} from "@/components/clientes/form-kit"
import {
  fieldErrorsFrom,
  pmocPlanSchema,
  type PmocPlanInput,
} from "@/components/clientes/schemas"
import { hojeBrt } from "./situacao"

export type ChecklistOption = { id: string; nome: string }

const PERIODICIDADES: Record<string, string> = {
  "30": "Mensal (30 dias)",
  "60": "Bimestral (60 dias)",
  "90": "Trimestral (90 dias)",
  "180": "Semestral (180 dias)",
  "365": "Anual (365 dias)",
  outra: "Outra…",
}

const SEM_CHECKLIST = "_nenhum"

function initial(equipmentId: string, plan: PmocPlan | null): Required<PmocPlanInput> {
  return {
    id: plan?.id ?? "",
    equipment_id: equipmentId,
    periodicidade_dias: String(plan?.periodicidade_dias ?? 30),
    proxima_data: plan?.ativo ? plan.proxima_data : hojeBrt(),
    responsavel_tecnico: plan?.responsavel_tecnico ?? "",
    checklist_template_id: plan?.checklist_template_id ?? "",
    observacoes: plan?.observacoes ?? "",
  }
}

/**
 * Criar/editar/reabrir o plano PMOC de um equipamento. A próxima data só é
 * definida aqui; depois o banco a avança na conclusão de cada OS preventiva.
 */
export function PlanFormDialog({
  open,
  onOpenChange,
  equipmentId,
  equipmentLabel,
  plan,
  checklistOptions,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipmentId: string
  equipmentLabel: string
  plan: PmocPlan | null
  checklistOptions: ChecklistOption[]
}) {
  const titulo = plan?.ativo ? "Editar plano PMOC" : plan ? "Reabrir plano PMOC" : "Novo plano PMOC"
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            <span className="font-mono text-ink">{equipmentLabel}</span>
          </DialogDescription>
        </DialogHeader>
        {open && (
          <PlanForm
            equipmentId={equipmentId}
            plan={plan}
            checklistOptions={checklistOptions}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function PlanForm({
  equipmentId,
  plan,
  checklistOptions,
  onClose,
}: {
  equipmentId: string
  plan: PmocPlan | null
  checklistOptions: ChecklistOption[]
  onClose: () => void
}) {
  const [form, setForm] = React.useState(() => initial(equipmentId, plan))
  const [preset, setPreset] = React.useState(() =>
    form.periodicidade_dias in PERIODICIDADES ? form.periodicidade_dias : "outra",
  )
  const { pending, run, fieldErrors: errors, setFieldErrors } = useCadastroAction()
  const set = (key: keyof PmocPlanInput) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  const checklistItems: Record<string, string> = {
    [SEM_CHECKLIST]: "Sem checklist padrão",
    ...Object.fromEntries(checklistOptions.map((c) => [c.id, c.nome])),
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const check = pmocPlanSchema.safeParse(form)
    if (!check.success) {
      setFieldErrors(fieldErrorsFrom(check.error))
      return
    }
    run(() => savePmocPlan(form), onClose)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="plano-periodicidade" label="Periodicidade" error={errors.periodicidade_dias}>
          <SelectField
            id="plano-periodicidade"
            value={preset}
            onChange={(v) => {
              setPreset(v)
              if (v !== "outra") set("periodicidade_dias")(v)
            }}
            items={PERIODICIDADES}
            error={errors.periodicidade_dias}
          />
        </Field>
        {preset === "outra" ? (
          <Field id="plano-dias" label="A cada (dias)" error={errors.periodicidade_dias}>
            <Input
              id="plano-dias"
              value={form.periodicidade_dias}
              onChange={(e) => set("periodicidade_dias")(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              className="font-mono max-md:h-11"
              {...invalidProps("plano-dias", errors.periodicidade_dias)}
            />
          </Field>
        ) : (
          <Field id="plano-proxima" label="Próxima manutenção" error={errors.proxima_data}>
            <Input
              id="plano-proxima"
              type="date"
              value={form.proxima_data}
              onChange={(e) => set("proxima_data")(e.target.value)}
              className="font-mono max-md:h-11"
              {...invalidProps("plano-proxima", errors.proxima_data)}
            />
          </Field>
        )}
      </div>
      {preset === "outra" && (
        <Field id="plano-proxima" label="Próxima manutenção" error={errors.proxima_data}>
          <Input
            id="plano-proxima"
            type="date"
            value={form.proxima_data}
            onChange={(e) => set("proxima_data")(e.target.value)}
            className="font-mono max-md:h-11 sm:w-48"
            {...invalidProps("plano-proxima", errors.proxima_data)}
          />
        </Field>
      )}
      <Field
        id="plano-rt"
        label="Responsável técnico"
        error={errors.responsavel_tecnico}
        hint="Nome e registro (CREA/CFT) do RT do PMOC"
      >
        <Input
          id="plano-rt"
          value={form.responsavel_tecnico}
          onChange={(e) => set("responsavel_tecnico")(e.target.value)}
          placeholder="Eng. Nome Sobrenome, CREA-PR 000000/D"
          className="max-md:h-11"
          {...invalidProps("plano-rt", errors.responsavel_tecnico)}
        />
      </Field>
      <Field id="plano-checklist" label="Checklist da visita" error={errors.checklist_template_id}>
        <SelectField
          id="plano-checklist"
          value={form.checklist_template_id || SEM_CHECKLIST}
          onChange={(v) => set("checklist_template_id")(v === SEM_CHECKLIST ? "" : v)}
          items={checklistItems}
          error={errors.checklist_template_id}
        />
      </Field>
      <Field id="plano-obs" label="Observações" error={errors.observacoes}>
        <Textarea
          id="plano-obs"
          value={form.observacoes}
          onChange={(e) => set("observacoes")(e.target.value)}
          rows={2}
          placeholder="Janela de acesso, restrições do local…"
          {...invalidProps("plano-obs", errors.observacoes)}
        />
      </Field>
      <p className="flex items-start gap-2 rounded-lg border border-line bg-console-2/40 p-3 text-xs leading-relaxed text-ink-dim">
        <InfoIcon className="mt-0.5 size-3.5 shrink-0 text-signal" aria-hidden="true" />
        A OS preventiva é gerada automaticamente perto da data. Quando ela é concluída, a
        próxima data avança sozinha (conclusão + periodicidade).
      </p>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={pending} className="max-md:h-11">
          Cancelar
        </Button>
        <SubmitButton pending={pending}>{plan?.ativo ? "Salvar plano" : "Ativar plano"}</SubmitButton>
      </DialogFooter>
    </form>
  )
}
