import type { CSSProperties } from "react"
import { cn } from "cn"

import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export type KpiTone = "clear" | "amber" | "danger" | "neutral"

const pillTone: Record<KpiTone, string> = {
  clear: "bg-clear-dim text-clear",
  amber: "bg-amber-dim text-amber",
  danger: "bg-danger-dim text-danger",
  neutral: "bg-console-2 text-ink-dim",
}

type FinKpiProps = {
  /** Rótulo em frase, como nas referências ("Recebido no mês"). */
  label: string
  value: string
  /** Pílula ao lado do valor (percentual, estado). */
  pill?: string | null
  tone?: KpiTone
  /** Linha de apoio, 13px. */
  sub?: string
  className?: string
  style?: CSSProperties
}

/** KPI do Financeiro: rótulo em frase, valor grande em Onest e pílula de estado. */
export function FinKpi({ label, value, pill, tone = "neutral", sub, className, style }: FinKpiProps) {
  return (
    <Card
      className={cn("console-enter min-w-0 gap-3", className)}
      style={style}
      aria-label={[label, value, pill, sub].filter(Boolean).join(", ")}
    >
      <p className="px-(--card-spacing) text-[0.8125rem] leading-snug text-ink-dim md:text-sm">{label}</p>
      <div className="flex flex-col gap-2 px-(--card-spacing)">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <span className="font-display text-[1.5rem] leading-none font-medium tracking-[-0.03em] whitespace-nowrap text-ink tabular-nums min-[400px]:text-[1.75rem] md:text-[2.25rem]">
            {value}
          </span>
          {pill ? (
            <span
              className={cn(
                "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap tabular-nums",
                pillTone[tone],
              )}
            >
              {pill}
            </span>
          ) : null}
        </div>
        {sub ? <p className="text-[0.8125rem] leading-snug text-ink-faint">{sub}</p> : null}
      </div>
    </Card>
  )
}

export function FinKpiSkeleton() {
  return (
    <Card className="gap-3" aria-hidden="true">
      <Skeleton className="mx-(--card-spacing) h-4 w-28" />
      <div className="flex flex-col gap-2 px-(--card-spacing)">
        <Skeleton className="h-7 w-28 md:h-9 md:w-36" />
        <Skeleton className="h-3.5 w-24" />
      </div>
    </Card>
  )
}
