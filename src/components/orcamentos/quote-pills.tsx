import { cn } from "cn"

import type { QuoteStatus } from "@/lib/types"
import { QUOTE_STATUS_META } from "@/lib/status-meta"

const pill =
  "inline-flex h-6 w-fit shrink-0 items-center rounded-full border px-2.5 text-xs font-medium whitespace-nowrap"

/** Pílula do status do orçamento (aguardando, aprovado, declinado). */
export function QuoteStatusPill({ status, className }: { status: QuoteStatus; className?: string }) {
  const meta = QUOTE_STATUS_META[status]
  return (
    <span className={cn(pill, meta.badgeClassName, className)} aria-label={`Status: ${meta.label}`}>
      {meta.label}
    </span>
  )
}

/** Marca derivada (não é status): aguardando com validade já passada. */
export function VencidoPill({ className }: { className?: string }) {
  return (
    <span
      className={cn(pill, "border-transparent bg-danger-dim text-danger", className)}
      aria-label="Validade vencida"
    >
      Vencido
    </span>
  )
}

/** Aguardando e validade anterior a hoje (BRT). */
export function isQuoteVencido(q: { status: QuoteStatus; validade: string }, hoje: string): boolean {
  return q.status === "aguardando" && q.validade.slice(0, 10) < hoje
}
