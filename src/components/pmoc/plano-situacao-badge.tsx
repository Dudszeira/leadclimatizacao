import { cn } from "cn"

import type { PmocPlanListItem } from "@/lib/types"
import { formatDateBR } from "@/lib/format"

const SITUACAO_META = {
  em_dia: { label: "Em dia", className: "border-transparent bg-clear-dim text-clear" },
  vencendo: { label: "Vencendo", className: "border-transparent bg-amber-dim text-amber" },
  atrasado: { label: "Atrasado", className: "border-transparent bg-danger-dim text-danger" },
  encerrado: { label: "Encerrado", className: "border-line bg-console-2 text-ink-dim" },
} as const

export function situacaoMeta(plan: Pick<PmocPlanListItem, "ativo" | "situacao">) {
  return plan.ativo ? SITUACAO_META[plan.situacao] : SITUACAO_META.encerrado
}

/** Texto curto do prazo: "vence em 5 dias", "atrasado há 9 dias", "hoje". */
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
    <span className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1.5">
        <span
          className={cn(
            "inline-flex h-5 items-center rounded-md border px-1.5 text-[11px] font-medium",
            meta.className,
          )}
        >
          {meta.label}
        </span>
        {plan.ativo && plan.os_aberta && (
          <span className="font-mono text-[11px] text-signal">OS #{plan.os_aberta.numero}</span>
        )}
      </span>
      <span className="font-mono text-xs text-ink-faint">
        {plan.ativo
          ? `${formatDateBR(plan.proxima_data)} · ${plan.periodicidade_dias}d`
          : `a cada ${plan.periodicidade_dias}d`}
      </span>
    </span>
  )
}
