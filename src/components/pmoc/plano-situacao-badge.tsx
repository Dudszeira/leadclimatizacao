import { cn } from "cn"

import type { PmocPlanListItem } from "@/lib/types"
import { formatDateBR } from "@/lib/format"
import { Badge } from "@/components/ui/badge"

const SITUACAO_META = {
  em_dia: { label: "Em dia", className: "bg-clear-dim text-clear" },
  vencendo: { label: "Vencendo", className: "bg-amber-dim text-amber" },
  atrasado: { label: "Atrasado", className: "bg-danger-dim text-danger" },
  encerrado: { label: "Encerrado", className: "bg-console-3 text-ink-faint" },
} as const

export function situacaoMeta(plan: Pick<PmocPlanListItem, "ativo" | "situacao">) {
  return plan.ativo ? SITUACAO_META[plan.situacao] : SITUACAO_META.encerrado
}

/** Texto curto do prazo: "vence em 5 dias", "atrasado há 9 dias", "vence hoje". */
export function prazoLabel(dias: number): string {
  if (dias === 0) return "vence hoje"
  if (dias > 0) return dias === 1 ? "vence amanhã" : `vence em ${dias} dias`
  const n = Math.abs(dias)
  return n === 1 ? "atrasado há 1 dia" : `atrasado há ${n} dias`
}

/** Situação do plano (proxima_data + OS em aberto) em formato compacto. */
export function PlanoSituacaoBadge({
  plan,
}: {
  plan: Pick<PmocPlanListItem, "ativo" | "situacao" | "proxima_data" | "dias_para_vencer" | "os_aberta" | "periodicidade_dias">
}) {
  const meta = situacaoMeta(plan)
  return (
    <span className="flex flex-col gap-1">
      <span className="flex items-center gap-2">
        <Badge className={cn(meta.className)}>{meta.label}</Badge>
        {plan.ativo && plan.os_aberta && (
          <span className="text-xs font-medium text-ink-dim tabular-nums">
            OS #{plan.os_aberta.numero}
          </span>
        )}
      </span>
      <span className="text-xs text-ink-faint tabular-nums">
        {plan.ativo
          ? `${formatDateBR(plan.proxima_data)}, a cada ${plan.periodicidade_dias} dias`
          : `a cada ${plan.periodicidade_dias} dias`}
      </span>
    </span>
  )
}
