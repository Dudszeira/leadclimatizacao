import { cn } from "cn"

import type { OsPriority, OsStatus, OsType } from "@/lib/types"
import { OS_PRIORITY_META, OS_STATUS_META, OS_TYPE_META } from "@/lib/status-meta"

/**
 * Pílulas suaves da OS (status, prioridade, tipo). Cor só para estado:
 * urgente em danger, alta em amber; média/baixa ficam neutras com ponto.
 */

const PILL =
  "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap"

const PRIORITY_PILL: Record<OsPriority, string> = {
  urgente: "bg-danger-dim text-danger",
  alta: "bg-amber-dim text-amber",
  media: "bg-console-2 text-ink-dim",
  baixa: "bg-console-2 text-ink-faint",
}

export function StatusPill({
  status,
  atrasada,
  className,
}: {
  status: OsStatus
  /** OS de hoje com horário já passado (tela Campo). */
  atrasada?: boolean
  className?: string
}) {
  const meta = OS_STATUS_META[status]
  return (
    <span
      className={cn(
        PILL,
        "border",
        atrasada ? "border-transparent bg-amber-dim text-amber" : meta.badgeClassName,
        className,
      )}
    >
      {atrasada ? "Atrasada" : meta.label}
    </span>
  )
}

export function PriorityPill({
  prioridade,
  className,
}: {
  prioridade: OsPriority
  className?: string
}) {
  const meta = OS_PRIORITY_META[prioridade]
  return (
    <span className={cn(PILL, PRIORITY_PILL[prioridade], className)}>
      <span className={cn("size-1.5 rounded-full", meta.dotClassName)} aria-hidden="true" />
      {meta.label}
    </span>
  )
}

export function TypePill({ tipo, className }: { tipo: OsType; className?: string }) {
  return (
    <span className={cn(PILL, "border", OS_TYPE_META[tipo].badgeClassName, className)}>
      {OS_TYPE_META[tipo].label}
    </span>
  )
}
