import type { CSSProperties, ReactNode } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { cn } from "cn"

export type StatTone = "clear" | "amber" | "danger" | "signal" | "neutral"

const toneClass: Record<StatTone, string> = {
  clear: "text-clear",
  amber: "text-amber",
  danger: "text-danger",
  signal: "text-signal",
  neutral: "text-ink-faint",
}

const pillClass: Record<StatTone, string> = {
  clear: "bg-clear-dim text-clear",
  amber: "bg-amber-dim text-amber",
  danger: "bg-danger-dim text-danger",
  signal: "bg-signal-dim text-signal",
  neutral: "bg-console-3 text-ink-dim",
}

type StatCardProps = {
  label: string
  /** Valor principal; null quando a fonte falhou (mostra aviso discreto). */
  value: string | null
  /** Texto no lugar do valor quando ele é null (padrão: "Não carregou"). */
  valueFallback?: string
  /** Pílula curta ao lado do valor (ex.: "2 em campo"), como na referência. */
  pill?: { text: string; tone: StatTone } | null
  /** Linha de contexto abaixo do valor. */
  sub?: ReactNode
  /** Cor da linha de contexto (padrão: discreta). */
  tone?: StatTone
  /** Ícone opcional à frente da linha de contexto. */
  subIcon?: LucideIcon
  /** Ícone opcional discreto no canto (usado por outras telas). */
  icon?: LucideIcon
  /** Card inteiro vira atalho para a tela correspondente. */
  href?: string
  valueClassName?: string
  className?: string
  style?: CSSProperties
}

/**
 * KPI no estilo das referências: rótulo em frase, número grande em Onest,
 * pílula de estado opcional e uma linha de contexto. Compacto no celular
 * (cabe em grade 2x2), mais respirado no desktop.
 */
export function StatCard({
  label,
  value,
  valueFallback = "Não carregou",
  pill,
  sub,
  tone = "neutral",
  subIcon: SubIcon,
  icon: Icon,
  href,
  valueClassName,
  className,
  style,
}: StatCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 min-w-0 text-[0.8125rem] leading-snug text-ink-dim md:text-sm">
          {label}
        </span>
        {Icon ? (
          <Icon className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden="true" />
        ) : null}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1.5 pt-3 md:pt-4">
        {value === null ? (
          <span className="text-sm text-ink-faint">{valueFallback}</span>
        ) : (
          <span
            className={cn(
              "font-display text-[1.75rem] leading-none font-medium tracking-[-0.03em] text-ink tabular-nums md:text-[2.25rem]",
              valueClassName
            )}
          >
            {value}
          </span>
        )}
        {pill ? (
          <span
            className={cn(
              "inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap tabular-nums",
              pillClass[pill.tone]
            )}
          >
            {pill.text}
          </span>
        ) : null}
      </div>
      {sub ? (
        <p
          className={cn(
            "mt-2 flex items-start gap-1.5 text-xs leading-snug md:text-[0.8125rem]",
            toneClass[tone]
          )}
        >
          {SubIcon ? (
            <SubIcon className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          ) : null}
          <span className="line-clamp-2 min-w-0">{sub}</span>
        </p>
      ) : null}
    </>
  )

  const base = cn(
    "console-enter flex min-w-0 flex-col rounded-[1.375rem] bg-card p-3.5 ring-1 ring-line md:p-5",
    className
  )

  if (href) {
    return (
      <Link
        href={href}
        style={style}
        className={cn(
          base,
          "outline-none transition-colors duration-200 ease-(--ease-out-expo) hover:bg-console-2 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        )}
      >
        {body}
      </Link>
    )
  }

  return (
    <div className={base} style={style}>
      {body}
    </div>
  )
}
