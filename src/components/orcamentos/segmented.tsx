"use client"

import * as React from "react"
import { cn } from "cn"

/**
 * Escolha única em pílula segmentada (rádio acessível com setas), no
 * visual do Tabs default: trilho grafite, ativo branco.
 */
export function Segmented({
  value,
  onChange,
  options,
  labelledBy,
  ariaLabel,
  wrap = false,
}: {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  labelledBy?: string
  ariaLabel?: string
  /** Quebra em grade 2×2 quando o contêiner é estreito (4+ opções no celular). */
  wrap?: boolean
}) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([])
  function onKeyDown(e: React.KeyboardEvent, index: number) {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) return
    e.preventDefault()
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1
    const next = (index + dir + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }
  const group = (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-label={ariaLabel}
      className={cn(
        "gap-1 bg-console-2 p-1",
        wrap
          ? "grid grid-cols-2 rounded-[1.375rem] @md:flex @md:h-10 @md:items-center @md:rounded-full"
          : "flex h-11 items-center rounded-full md:h-10",
      )}
    >
      {options.map((o, i) => {
        const checked = o.value === value
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "inline-flex flex-1 items-center justify-center rounded-full px-3 text-sm font-medium whitespace-nowrap transition-[color,background-color] duration-150 outline-none focus-visible:ring-3 focus-visible:ring-signal/50",
              wrap ? "h-9 @md:h-full" : "h-full",
              checked ? "bg-ink text-void" : "text-ink-dim hover:text-ink",
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
  return wrap ? <div className="@container">{group}</div> : group
}
