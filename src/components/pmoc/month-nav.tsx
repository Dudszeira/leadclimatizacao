"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "cn"
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
]

const ANO_MIN = 2020
const ANO_MAX = 2100

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

/** "YYYY-MM" deslocado em `delta` meses. */
function somaMeses(mes: string, delta: number): string {
  const [ano, m] = mes.split("-").map(Number)
  const total = ano * 12 + (m - 1) + delta
  return `${Math.floor(total / 12)}-${pad2((total % 12) + 1)}`
}

function rotuloMes(mes: string): string {
  const [ano, m] = mes.split("-").map(Number)
  return `${MESES[m - 1]} de ${ano}`
}

type Atalho = { label: string; delta: number }

const ATALHOS: Atalho[] = [
  { label: "Este mês", delta: 0 },
  { label: "Mês passado", delta: -1 },
  { label: "Próximo mês", delta: 1 },
  { label: "Daqui a 3 meses", delta: 3 },
]

/**
 * Navegação de mês do Calendário PMOC: setas para o mês vizinho e um seletor
 * de mês em papel claro (grade de meses, atalhos em pílula, Fechar/Aplicar).
 */
export function PmocMonthNav({
  mes,
  mesAtual,
  query = "",
}: {
  /** Mês exibido, "YYYY-MM". */
  mes: string
  /** Mês corrente no fuso do servidor, "YYYY-MM". */
  mesAtual: string
  /** Resto da query string a manter ao trocar de mês (ex.: "&planos=todos"). */
  query?: string
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [rascunho, setRascunho] = React.useState(mes)
  const [ano, setAno] = React.useState(() => Number(mes.slice(0, 4)))

  const href = (m: string) => `/pmoc?mes=${m}${query}`
  const anterior = somaMeses(mes, -1)
  const proximo = somaMeses(mes, 1)

  function onOpenChange(next: boolean) {
    if (next) {
      setRascunho(mes)
      setAno(Number(mes.slice(0, 4)))
    }
    setOpen(next)
  }

  function escolher(m: string) {
    setRascunho(m)
    setAno(Number(m.slice(0, 4)))
  }

  function aplicar() {
    setOpen(false)
    if (rascunho !== mes) router.push(href(rascunho))
  }

  return (
    <nav aria-label="Navegação de mês" className="flex w-full items-center gap-2 md:w-auto">
      <Link
        href={href(anterior)}
        aria-label={`Mês anterior, ${rotuloMes(anterior)}`}
        className={buttonVariants({ variant: "outline", size: "icon" })}
      >
        <ChevronLeftIcon aria-hidden="true" />
      </Link>

      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger
          render={
            <Button
              variant="secondary"
              className="min-w-0 flex-1 md:min-w-44 md:flex-none"
              aria-label={`Escolher mês. Exibindo ${rotuloMes(mes)}`}
            />
          }
        >
          <CalendarDaysIcon aria-hidden="true" className="text-ink-dim" />
          <span aria-live="polite" className="truncate">
            {rotuloMes(mes)}
          </span>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={8}
          className="surface-paper w-[min(23rem,calc(100vw-2rem))] gap-5 rounded-[1.5rem] p-5 ring-0 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.85)]"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 font-display text-xl leading-tight font-medium tracking-[-0.02em] text-ink">
              {rotuloMes(rascunho)}
            </p>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="bg-black/[0.07] hover:bg-black/[0.12]"
                onClick={() => setOpen(false)}
              >
                Fechar
              </Button>
              <Button size="sm" onClick={aplicar}>
                Aplicar
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Ano anterior"
              disabled={ano <= ANO_MIN}
              onClick={() => setAno((a) => a - 1)}
            >
              <ChevronLeftIcon aria-hidden="true" />
            </Button>
            <span className="font-display text-base font-medium tabular-nums" aria-live="polite">
              {ano}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Próximo ano"
              disabled={ano >= ANO_MAX}
              onClick={() => setAno((a) => a + 1)}
            >
              <ChevronRightIcon aria-hidden="true" />
            </Button>
          </div>

          <div role="group" aria-label={`Meses de ${ano}`} className="grid grid-cols-4 gap-1.5">
            {MESES.map((nome, i) => {
              const valor = `${ano}-${pad2(i + 1)}`
              const ativo = valor === rascunho
              const corrente = valor === mesAtual
              return (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setRascunho(valor)}
                  aria-pressed={ativo}
                  aria-label={`${nome} de ${ano}${corrente ? ", mês atual" : ""}`}
                  className={cn(
                    "relative flex h-12 cursor-pointer items-center justify-center rounded-xl text-sm transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-black/25",
                    ativo
                      ? "bg-primary font-medium text-primary-foreground"
                      : "bg-black/[0.045] text-ink-dim hover:bg-black/[0.09] hover:text-ink"
                  )}
                >
                  {nome.slice(0, 3)}
                  {corrente && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute bottom-1.5 size-1 rounded-full",
                        ativo ? "bg-primary-foreground" : "bg-ink"
                      )}
                    />
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            {ATALHOS.map((a) => {
              const valor = somaMeses(mesAtual, a.delta)
              return (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => escolher(valor)}
                  aria-pressed={valor === rascunho}
                  className={cn(
                    "h-10 cursor-pointer rounded-full border px-3.5 md:h-9 text-[0.8125rem] transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-black/25",
                    valor === rascunho
                      ? "border-ink text-ink"
                      : "border-line text-ink-dim hover:border-ink-faint hover:text-ink"
                  )}
                >
                  {a.label}
                </button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>

      <Link
        href={href(proximo)}
        aria-label={`Próximo mês, ${rotuloMes(proximo)}`}
        className={buttonVariants({ variant: "outline", size: "icon" })}
      >
        <ChevronRightIcon aria-hidden="true" />
      </Link>

      {mes !== mesAtual && (
        <Link href={href(mesAtual)} className={buttonVariants({ variant: "ghost" })}>
          Hoje
        </Link>
      )}
    </nav>
  )
}
