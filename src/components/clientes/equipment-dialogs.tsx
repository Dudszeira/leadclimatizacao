"use client"

import * as React from "react"
import {
  CalendarCheckIcon,
  CalendarOffIcon,
  EllipsisVerticalIcon,
  PencilLineIcon,
  PlusIcon,
  PowerIcon,
  PowerOffIcon,
} from "lucide-react"

import type { Equipment, PmocPlan } from "@/lib/types"
import { EQUIPMENT_TYPE_LABELS } from "@/lib/status-meta"
import { saveEquipment, setEquipmentAtivo } from "@/server/actions/cadastros"
import { setPmocPlanAtivo } from "@/server/actions/pmoc"
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
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PlanFormDialog, type ChecklistOption } from "@/components/pmoc/plan-form-dialog"
import { ConfirmDialog, Field, SelectField, SubmitButton, invalidProps, useCadastroAction } from "./form-kit"
import { EQUIPMENT_TYPES, equipmentSchema, fieldErrorsFrom, type EquipmentInput } from "./schemas"

export type BuildingOption = { id: string; nome: string }

const TIPO_ITEMS = Object.fromEntries(EQUIPMENT_TYPES.map((t) => [t, EQUIPMENT_TYPE_LABELS[t]]))

function initial(equipment?: Equipment, defaultBuildingId?: string): Required<EquipmentInput> {
  return {
    id: equipment?.id ?? "",
    building_id: equipment?.building_id ?? defaultBuildingId ?? "",
    tipo: equipment?.tipo ?? "split",
    marca: equipment?.marca ?? "",
    modelo: equipment?.modelo ?? "",
    capacidade_btu: equipment?.capacidade_btu != null ? String(equipment.capacidade_btu) : "",
    numero_serie: equipment?.numero_serie ?? "",
    codigo_interno: equipment?.codigo_interno ?? "",
    ambiente: equipment?.ambiente ?? "",
    data_instalacao: equipment?.data_instalacao ?? "",
    observacoes: equipment?.observacoes ?? "",
  }
}

export function EquipmentFormDialog({
  open,
  onOpenChange,
  buildings,
  equipment,
  defaultBuildingId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  buildings: BuildingOption[]
  equipment?: Equipment
  defaultBuildingId?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{equipment ? "Editar equipamento" : "Novo equipamento"}</DialogTitle>
          <DialogDescription>
            {equipment
              ? "O status operacional é atualizado pelas OS; use “Inativar” para tirar de operação."
              : "Entra como operacional. O status passa a seguir as OS abertas para ele."}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <EquipmentForm
            buildings={buildings}
            equipment={equipment}
            defaultBuildingId={defaultBuildingId ?? buildings[0]?.id}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function EquipmentForm({
  buildings,
  equipment,
  defaultBuildingId,
  onClose,
}: {
  buildings: BuildingOption[]
  equipment?: Equipment
  defaultBuildingId?: string
  onClose: () => void
}) {
  const [form, setForm] = React.useState(() => initial(equipment, defaultBuildingId))
  const { pending, run, fieldErrors: errors, setFieldErrors } = useCadastroAction()
  const set = (key: keyof EquipmentInput) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }))
  const buildingItems = Object.fromEntries(buildings.map((b) => [b.id, b.nome]))

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const check = equipmentSchema.safeParse(form)
    if (!check.success) {
      setFieldErrors(fieldErrorsFrom(check.error))
      return
    }
    run(() => saveEquipment(form), onClose)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="eq-predio" label="Prédio" error={errors.building_id}>
          <SelectField
            id="eq-predio"
            value={form.building_id}
            onChange={set("building_id")}
            items={buildingItems}
            error={errors.building_id}
          />
        </Field>
        <Field id="eq-tipo" label="Tipo" error={errors.tipo}>
          <SelectField id="eq-tipo" value={form.tipo} onChange={set("tipo")} items={TIPO_ITEMS} error={errors.tipo} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="eq-codigo" label="Código interno" error={errors.codigo_interno} hint="andar-posição, ex.: 04-B7">
          <Input
            id="eq-codigo"
            value={form.codigo_interno}
            onChange={(e) => set("codigo_interno")(e.target.value)}
            className="font-mono max-md:h-11"
            {...invalidProps("eq-codigo", errors.codigo_interno)}
          />
        </Field>
        <Field id="eq-serie" label="Nº de série" error={errors.numero_serie}>
          <Input
            id="eq-serie"
            value={form.numero_serie}
            onChange={(e) => set("numero_serie")(e.target.value)}
            className="font-mono max-md:h-11"
            {...invalidProps("eq-serie", errors.numero_serie)}
          />
        </Field>
        <Field id="eq-btu" label="Capacidade (BTU/h)" error={errors.capacidade_btu}>
          <Input
            id="eq-btu"
            value={form.capacidade_btu}
            onChange={(e) => set("capacidade_btu")(e.target.value.replace(/[^\d.]/g, ""))}
            inputMode="numeric"
            placeholder="18000"
            className="font-mono max-md:h-11"
            {...invalidProps("eq-btu", errors.capacidade_btu)}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="eq-marca" label="Marca" error={errors.marca}>
          <Input
            id="eq-marca"
            value={form.marca}
            onChange={(e) => set("marca")(e.target.value)}
            className="max-md:h-11"
            {...invalidProps("eq-marca", errors.marca)}
          />
        </Field>
        <Field id="eq-modelo" label="Modelo" error={errors.modelo}>
          <Input
            id="eq-modelo"
            value={form.modelo}
            onChange={(e) => set("modelo")(e.target.value)}
            className="max-md:h-11"
            {...invalidProps("eq-modelo", errors.modelo)}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
        <Field id="eq-ambiente" label="Ambiente" error={errors.ambiente}>
          <Input
            id="eq-ambiente"
            value={form.ambiente}
            onChange={(e) => set("ambiente")(e.target.value)}
            placeholder="Ex.: Recepção, CTI ala leste"
            className="max-md:h-11"
            {...invalidProps("eq-ambiente", errors.ambiente)}
          />
        </Field>
        <Field id="eq-instalacao" label="Data de instalação" error={errors.data_instalacao}>
          <Input
            id="eq-instalacao"
            type="date"
            value={form.data_instalacao}
            onChange={(e) => set("data_instalacao")(e.target.value)}
            className="font-mono max-md:h-11"
            {...invalidProps("eq-instalacao", errors.data_instalacao)}
          />
        </Field>
      </div>
      <Field id="eq-obs" label="Observações" error={errors.observacoes}>
        <Textarea
          id="eq-obs"
          value={form.observacoes}
          onChange={(e) => set("observacoes")(e.target.value)}
          rows={2}
          {...invalidProps("eq-obs", errors.observacoes)}
        />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={pending} className="max-md:h-11">
          Cancelar
        </Button>
        <SubmitButton pending={pending}>{equipment ? "Salvar alterações" : "Cadastrar equipamento"}</SubmitButton>
      </DialogFooter>
    </form>
  )
}

/** Botão "Novo equipamento" (aba Equipamentos). */
export function NewEquipmentButton({ buildings }: { buildings: BuildingOption[] }) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button
        className="h-9 px-3 max-md:h-11"
        onClick={() => setOpen(true)}
        disabled={buildings.length === 0}
        title={buildings.length === 0 ? "Cadastre um prédio primeiro" : undefined}
      >
        <PlusIcon aria-hidden="true" />
        Novo equipamento
      </Button>
      <EquipmentFormDialog open={open} onOpenChange={setOpen} buildings={buildings} />
    </>
  )
}

/** Menu da linha de equipamento: editar, plano PMOC, encerrar plano, inativar. */
export function EquipmentRowActions({
  equipment,
  buildings,
  plan,
  checklistOptions,
}: {
  equipment: Equipment
  buildings: BuildingOption[]
  plan: PmocPlan | null
  checklistOptions: ChecklistOption[]
}) {
  const [dialog, setDialog] = React.useState<"editar" | "plano" | "encerrar" | "status" | null>(null)
  const close = (open: boolean) => !open && setDialog(null)
  const inativo = equipment.status === "inativo"
  const label = `${equipment.codigo_interno} · ${EQUIPMENT_TYPE_LABELS[equipment.tipo]}${equipment.marca ? ` ${equipment.marca}` : ""}`
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="size-8 max-md:size-11"
              aria-label={`Ações do equipamento ${equipment.codigo_interno}`}
            />
          }
        >
          <EllipsisVerticalIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuItem onClick={() => setDialog("editar")}>
            <PencilLineIcon aria-hidden="true" />
            Editar equipamento
          </DropdownMenuItem>
          <DropdownMenuItem disabled={inativo} onClick={() => setDialog("plano")}>
            <CalendarCheckIcon aria-hidden="true" />
            {plan?.ativo ? "Editar plano PMOC" : plan ? "Reabrir plano PMOC" : "Criar plano PMOC"}
          </DropdownMenuItem>
          {plan?.ativo && (
            <DropdownMenuItem onClick={() => setDialog("encerrar")}>
              <CalendarOffIcon aria-hidden="true" />
              Encerrar plano PMOC
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant={inativo ? "default" : "destructive"}
            onClick={() => setDialog("status")}
          >
            {inativo ? <PowerIcon aria-hidden="true" /> : <PowerOffIcon aria-hidden="true" />}
            {inativo ? "Reativar equipamento" : "Inativar equipamento"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <EquipmentFormDialog
        open={dialog === "editar"}
        onOpenChange={close}
        buildings={buildings}
        equipment={equipment}
      />
      <PlanFormDialog
        open={dialog === "plano"}
        onOpenChange={close}
        equipmentId={equipment.id}
        equipmentLabel={label}
        plan={plan}
        checklistOptions={checklistOptions}
      />
      {plan && (
        <ConfirmDialog
          open={dialog === "encerrar"}
          onOpenChange={close}
          title="Encerrar plano PMOC?"
          description="O plano deixa de gerar OS preventivas e sai do calendário. OS já geradas continuam abertas até serem concluídas ou canceladas. Dá para reabrir depois."
          confirmLabel="Encerrar plano"
          action={() => setPmocPlanAtivo({ id: plan.id, ativo: false })}
        />
      )}
      <ConfirmDialog
        open={dialog === "status"}
        onOpenChange={close}
        title={inativo ? "Reativar equipamento?" : "Inativar equipamento?"}
        description={
          inativo
            ? `${label} volta a operar e a receber OS.`
            : `${label} sai de operação: não recebe OS preventivas e não aparece como pendente. O histórico de OS é mantido.`
        }
        confirmLabel={inativo ? "Reativar" : "Inativar"}
        destructive={!inativo}
        action={() => setEquipmentAtivo({ id: equipment.id, ativo: inativo })}
      />
    </>
  )
}
