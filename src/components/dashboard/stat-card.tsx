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

/** Card de KPI no padrão "console de operações": label uppercase, número grande em mono, sublegenda colorida. */
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
      <div className="flex items-start justify-between gap-2 px-(--card-spacing)">
        <span className="text-[0.71rem] leading-snug tracking-[0.05em] text-ink-faint uppercase">
          {label}
        </span>
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-console-3 text-signal"
          aria-hidden="true"
        >
          <Icon className="size-4" />
        </span>
      </div>
      <div
        className={cn(
          "mt-2 px-(--card-spacing) font-mono text-[1.75rem] leading-none font-semibold tracking-tight text-ink tabular-nums",
          valueClassName
        )}
      >
        {value}
      </div>
      <div
        className={cn(
          "mt-2 flex items-center gap-1.5 px-(--card-spacing) text-xs",
          toneClass[tone]
        )}
      >
        {SubIcon ? <SubIcon className="size-3 shrink-0" aria-hidden="true" /> : null}
        <span>{sub}</span>
      </div>
    </Card>
  )
}
