"use client"

import * as React from "react"
import { CalendarOffIcon, EllipsisVerticalIcon, PencilLineIcon, RotateCcwIcon } from "lucide-react"

import type { PmocPlan } from "@/lib/types"
import { setPmocPlanAtivo } from "@/server/actions/pmoc"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ConfirmDialog } from "@/components/clientes/form-kit"
import { PlanFormDialog, type ChecklistOption } from "./plan-form-dialog"

/** Ações do plano na tela /pmoc: editar, encerrar, reabrir. */
export function PlanRowActions({
  plan,
  equipmentLabel,
  equipmentInativo,
  checklistOptions,
}: {
  plan: PmocPlan
  equipmentLabel: string
  equipmentInativo: boolean
  checklistOptions: ChecklistOption[]
}) {
  const [dialog, setDialog] = React.useState<"editar" | "encerrar" | null>(null)
  const close = (open: boolean) => !open && setDialog(null)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Ações do plano de ${equipmentLabel}`}
            />
          }
        >
          <EllipsisVerticalIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem disabled={equipmentInativo} onClick={() => setDialog("editar")}>
            {plan.ativo ? <PencilLineIcon aria-hidden="true" /> : <RotateCcwIcon aria-hidden="true" />}
            {plan.ativo ? "Editar plano" : "Reabrir plano"}
          </DropdownMenuItem>
          {plan.ativo && (
            <DropdownMenuItem variant="destructive" onClick={() => setDialog("encerrar")}>
              <CalendarOffIcon aria-hidden="true" />
              Encerrar plano
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <PlanFormDialog
        open={dialog === "editar"}
        onOpenChange={close}
        equipmentId={plan.equipment_id}
        equipmentLabel={equipmentLabel}
        plan={plan}
        checklistOptions={checklistOptions}
      />
      <ConfirmDialog
        open={dialog === "encerrar"}
        onOpenChange={close}
        title="Encerrar plano PMOC?"
        description="O plano deixa de gerar OS preventivas e sai do calendário. OS já geradas continuam abertas até serem concluídas ou canceladas. Dá para reabrir depois."
        confirmLabel="Encerrar plano"
        action={() => setPmocPlanAtivo({ id: plan.id, ativo: false })}
      />
    </>
  )
}
