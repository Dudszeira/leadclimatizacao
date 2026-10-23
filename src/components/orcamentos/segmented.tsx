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
}: {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  labelledBy?: string
  ariaLabel?: string
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
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-label={ariaLabel}
      className="flex h-11 items-center gap-1 rounded-full bg-console-2 p-1 md:h-10"
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
              "inline-flex h-full flex-1 items-center justify-center rounded-full px-3 text-sm font-medium whitespace-nowrap transition-[color,background-color] duration-150 outline-none focus-visible:ring-3 focus-visible:ring-signal/50",
              checked ? "bg-ink text-void" : "text-ink-dim hover:text-ink",
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
