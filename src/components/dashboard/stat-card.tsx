import type { CSSProperties } from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "cn"

import { Card } from "@/components/ui/card"

export type StatTone = "clear" | "amber" | "danger" | "signal" | "neutral"

const toneClass: Record<StatTone, string> = {
  clear: "text-clear",
  amber: "text-amber",
  danger: "text-danger",
  signal: "text-signal",
  neutral: "text-ink-faint",
}

type StatCardProps = {
  label: string
  value: string
  icon: LucideIcon
  sub: string
  subIcon?: LucideIcon
  tone?: StatTone
  valueClassName?: string
  className?: string
  style?: CSSProperties
}

/** Card de KPI: rótulo em frase, número grande em Onest, sublegenda com a cor do estado. */
export function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  subIcon: SubIcon,
  tone = "neutral",
  valueClassName,
  className,
  style,
}: StatCardProps) {
  return (
    <Card
      size="sm"
      className={cn("console-enter gap-0", className)}
      style={style}
      aria-label={`${label}: ${value}, ${sub}`}
    >
      <div className="flex items-start justify-between gap-3 px-(--card-spacing)">
        <span className="text-[0.8125rem] leading-snug text-ink-dim md:text-sm">
          {label}
        </span>
        <Icon className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden="true" />
      </div>
      <div
        className={cn(
          "mt-3 px-(--card-spacing) font-display text-[1.875rem] leading-none font-medium tracking-[-0.03em] text-ink tabular-nums md:mt-4 md:text-[2.25rem]",
          valueClassName
        )}
      >
        {value}
      </div>
      <div
        className={cn(
          "mt-3 flex items-start gap-1.5 px-(--card-spacing) text-xs leading-snug",
          toneClass[tone]
        )}
      >
        {SubIcon ? <SubIcon className="mt-px size-3 shrink-0" aria-hidden="true" /> : null}
        <span>{sub}</span>
      </div>
    </Card>
  )
}
