"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { ptBR } from "date-fns/locale"
import { cn } from "cn"

import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

/** "2026-11-05" -> "05/11/2026" */
function isoToBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ""
}

/** "05/11/2026" -> "2026-11-05" (vazio se incompleta ou inexistente). */
function brToIso(br: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br)
  if (!m) return ""
  const [, d, mo, y] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d))
  if (date.getFullYear() !== Number(y) || date.getMonth() !== Number(mo) - 1 || date.getDate() !== Number(d)) {
    return ""
  }
  return `${y}-${mo}-${d}`
}

/** Digitação livre vira dd/mm/aaaa. */
function maskBR(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

function isoToDate(iso: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined
}

function dateToIso(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${mm}-${dd}`
}

type DateFieldProps = {
  id: string
  /** Data ISO (aaaa-mm-dd) ou vazio. */
  value: string
  onChange: (iso: string) => void
  /** Data mínima ISO (bloqueia dias anteriores no calendário). */
  min?: string
  className?: string
} & Pick<React.ComponentProps<"input">, "aria-invalid" | "aria-describedby" | "disabled">

/**
 * Campo de data sempre em pt-BR (dd/mm/aaaa), independente do idioma do
 * navegador: aceita digitação com máscara e abre o calendário claro
 * (`.surface-paper`) pelo botão à direita. Entrega ISO para o formulário.
 */
export function DateField({ id, value, onChange, min, className, disabled, ...aria }: DateFieldProps) {
  const [text, setText] = React.useState(() => isoToBR(value))
  const [open, setOpen] = React.useState(false)

  // Valor mudou por fora (calendário, reset): reflete no texto.
  const [prevValue, setPrevValue] = React.useState(value)
  if (prevValue !== value) {
    setPrevValue(value)
    if (brToIso(text) !== value) setText(isoToBR(value))
  }

  const selected = isoToDate(value)
  const minDate = min ? isoToDate(min) : undefined

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/aaaa"
        maxLength={10}
        value={text}
        disabled={disabled}
        onChange={(e) => {
          const next = maskBR(e.target.value)
          setText(next)
          const iso = brToIso(next)
          setPrevValue(iso)
          onChange(iso)
        }}
        className="pr-12 tabular-nums"
        {...aria}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={disabled}
          aria-label="Abrir calendário"
          className="absolute top-0 right-0 inline-flex h-11 w-11 cursor-pointer md:h-10 items-center justify-center rounded-r-xl text-ink-faint outline-none hover:text-ink focus-visible:text-ink focus-visible:ring-3 focus-visible:ring-signal/50"
        >
          <CalendarIcon className="size-4" aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent className="surface-paper w-auto p-3" align="end">
          <Calendar
            mode="single"
            locale={ptBR}
            selected={selected}
            defaultMonth={selected}
            disabled={minDate ? { before: minDate } : undefined}
            onSelect={(d) => {
              if (!d) return
              const iso = dateToIso(d)
              setPrevValue(iso)
              setText(isoToBR(iso))
              onChange(iso)
              setOpen(false)
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
