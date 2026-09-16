"use client"

import * as React from "react"
import { cn } from "cn"
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfWeek,
} from "date-fns"
import { ptBR } from "date-fns/locale"

import type { PmocPlanDetail } from "@/server/pmoc"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  EVENTO_META,
  parseDia,
  rotuloManutencoes,
  type PmocEvento,
} from "./evento"
import { PmocEventSheet } from "./event-sheet"

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]
const MAX_CHIPS = 3

type PmocCalendarProps = {
  /** Mês exibido, "YYYY-MM". */
  mes: string
  /** Hoje, "YYYY-MM-DD" (calculado no servidor). */
  hoje: string
  eventos: PmocEvento[]
  detalhes: Record<string, PmocPlanDetail>
}

/**
 * Calendário mensal PMOC: grid próprio de 7 colunas no desktop e lista
 * agrupada por dia no mobile. Clique num evento abre o Sheet de detalhes.
 */
export function PmocCalendar({ mes, hoje, eventos, detalhes }: PmocCalendarProps) {
  const [selecionado, setSelecionado] = React.useState<PmocEvento | null>(null)
  const [diaPopover, setDiaPopover] = React.useState<string | null>(null)

  const porDia = React.useMemo(() => {
    const map = new Map<string, PmocEvento[]>()
    for (const ev of eventos) {
      const lista = map.get(ev.data)
      if (lista) lista.push(ev)
      else map.set(ev.data, [ev])
    }
    return map
  }, [eventos])

  const [ano, mesNum] = mes.split("-").map(Number)
  const inicioMes = new Date(ano, mesNum - 1, 1)
  const dias = eachDayOfInterval({
    start: startOfWeek(inicioMes, { locale: ptBR }),
    end: endOfWeek(endOfMonth(inicioMes), { locale: ptBR }),
  })

  const abrirEvento = (ev: PmocEvento) => {
    setDiaPopover(null)
    setSelecionado(ev)
  }

  const diasComEventos = React.useMemo(
    () =>
      [...porDia.entries()]
        .filter(([key]) => key.startsWith(mes))
        .sort(([a], [b]) => a.localeCompare(b)),
    [porDia, mes],
  )

  return (
    <>
      {/* Desktop: grid mensal de 7 colunas */}
      <div className="overflow-hidden rounded-xl border border-line bg-console max-md:hidden">
        <div className="grid grid-cols-7 border-b border-line-soft" aria-hidden="true">
          {DIAS_SEMANA.map((dia) => (
            <div
              key={dia}
              className="px-2 py-2 text-center text-[0.68rem] font-medium tracking-[0.08em] text-ink-faint uppercase"
            >
              {dia}
            </div>
          ))}
        </div>
        <ul role="list" className="grid grid-cols-7 gap-px bg-line-soft">
          {dias.map((dia) => {
            const key = format(dia, "yyyy-MM-dd")
            const doMes = dia.getMonth() === mesNum - 1
            const evs = doMes ? (porDia.get(key) ?? []) : []
            const ehHoje = doMes && key === hoje
            const ocultos = evs.length - MAX_CHIPS

            return (
              <li
                key={key}
                aria-hidden={doMes ? undefined : true}
                aria-label={
                  doMes
                    ? `${format(dia, "d 'de' MMMM", { locale: ptBR })}, ${rotuloManutencoes(evs.length)}`
                    : undefined
                }
                className={cn(
                  "relative flex min-h-24 flex-col gap-1 bg-console p-1.5",
                  !doMes && "bg-console/40",
                  ehHoje && "ring-1 ring-signal ring-inset"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-5 items-center justify-center self-end rounded-full font-mono text-xs tabular-nums",
                    doMes ? "text-ink-dim" : "text-ink-faint/60",
                    ehHoje && "bg-signal font-semibold text-primary-foreground"
                  )}
                >
                  {dia.getDate()}
                </span>
                {evs.slice(0, MAX_CHIPS).map((ev, i) => (
                  <ChipEvento
                    key={`${ev.pmoc_plan_id ?? ev.os_id ?? i}-${i}`}
                    evento={ev}
                    onSelect={abrirEvento}
                  />
                ))}
                {ocultos > 0 && (
                  <Popover
                    open={diaPopover === key}
                    onOpenChange={(open) => setDiaPopover(open ? key : null)}
                  >
                    <PopoverTrigger
                      aria-label={`Ver as ${evs.length} manutenções de ${format(dia, "d 'de' MMMM", { locale: ptBR })}`}
                      className="rounded px-1.5 py-0.5 text-left text-[0.68rem] leading-4 font-medium text-ink-dim transition-colors outline-none hover:bg-console-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-ring/60"
                    >
                      +{ocultos} mais
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-72 border border-line p-2.5">
                      <p className="px-0.5 text-xs font-medium text-ink-dim">
                        {format(dia, "EEEE, d 'de' MMMM", { locale: ptBR })}
                      </p>
                      <ul role="list" className="flex flex-col gap-1">
                        {evs.map((ev, i) => (
                          <li key={`${ev.pmoc_plan_id ?? ev.os_id ?? i}-${i}`}>
                            <ChipEvento evento={ev} onSelect={abrirEvento} detalhado />
                          </li>
                        ))}
                      </ul>
                    </PopoverContent>
                  </Popover>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {/* Mobile: lista agrupada por dia (só dias com eventos) */}
      <div className="flex flex-col gap-3 md:hidden">
        {diasComEventos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-console/50 px-4 py-8 text-center text-sm text-ink-dim">
            Nenhuma manutenção prevista neste mês.
          </p>
        ) : (
          diasComEventos.map(([key, evs]) => (
            <section
              key={key}
              aria-label={`${format(parseDia(key), "d 'de' MMMM", { locale: ptBR })}, ${rotuloManutencoes(evs.length)}`}
              className="overflow-hidden rounded-xl border border-line bg-console"
            >
              <header className="flex items-center justify-between gap-2 border-b border-line-soft px-3 py-2">
                <h3 className="text-sm font-medium text-ink first-letter:uppercase">
                  {format(parseDia(key), "EEEE, d 'de' MMMM", { locale: ptBR })}
                </h3>
                {key === hoje && (
                  <Badge
                    variant="outline"
                    className="border-transparent bg-signal-dim font-medium text-signal"
                  >
                    Hoje
                  </Badge>
                )}
              </header>
              <ul role="list" className="divide-y divide-line-soft">
                {evs.map((ev, i) => {
                  const meta = EVENTO_META[ev.situacao]
                  return (
                    <li key={`${ev.pmoc_plan_id ?? ev.os_id ?? i}-${i}`}>
                      <button
                        type="button"
                        onClick={() => abrirEvento(ev)}
                        aria-label={`${meta.label}: ${ev.codigo_interno} — ${ev.predio}. Abrir detalhes`}
                        className="flex w-full items-center gap-2.5 px-3 py-3 text-left transition-colors outline-none hover:bg-console-2/60 focus-visible:bg-console-2/60"
                      >
                        <span
                          className={cn("size-2 shrink-0 rounded-full", meta.dot)}
                          aria-hidden="true"
                        />
                        <span className="shrink-0 font-mono text-xs text-ink">
                          {ev.codigo_interno}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-ink-dim">
                          {ev.predio}
                        </span>
                        <span className={cn("shrink-0 text-xs font-medium", meta.text)}>
                          {meta.label}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))
        )}
      </div>

      <PmocEventSheet
        evento={selecionado}
        detalhe={
          selecionado?.pmoc_plan_id
            ? detalhes[selecionado.pmoc_plan_id]
            : undefined
        }
        onClose={() => setSelecionado(null)}
      />
    </>
  )
}

function ChipEvento({
  evento,
  onSelect,
  detalhado = false,
}: {
  evento: PmocEvento
  onSelect: (ev: PmocEvento) => void
  detalhado?: boolean
}) {
  const meta = EVENTO_META[evento.situacao]
  return (
    <button
      type="button"
      onClick={() => onSelect(evento)}
      aria-label={`${meta.label}: ${evento.codigo_interno} — ${evento.predio}. Abrir detalhes`}
      className={cn(
        "flex w-full min-w-0 items-center gap-1 rounded px-1.5 text-left text-[0.68rem] leading-4 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        detalhado ? "py-1.5" : "py-0.5",
        meta.chip
      )}
    >
      <span className="shrink-0 font-mono font-medium tracking-tight">
        {evento.codigo_interno}
      </span>
      <span className="truncate opacity-80">{evento.predio}</span>
    </button>
  )
}
