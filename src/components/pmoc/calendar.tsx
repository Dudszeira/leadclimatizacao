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
import { ChevronRightIcon } from "lucide-react"

import type { PmocPlanDetail } from "@/server/pmoc"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  EQUIPMENT_TYPE_LABELS,
  EVENTO_META,
  SITUACAO_ORDEM,
  parseDia,
  rotuloManutencoes,
  type PmocEvento,
  type PmocEventoSituacao,
} from "./evento"
import { PmocEventSheet } from "./event-sheet"

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
const MAX_CHIPS = 3

type PmocCalendarProps = {
  /** Mês exibido, "YYYY-MM". */
  mes: string
  /** Hoje, "YYYY-MM-DD" (calculado no servidor). */
  hoje: string
  eventos: PmocEvento[]
  detalhes: Record<string, PmocPlanDetail>
}

function chaveEvento(ev: PmocEvento, i: number): string {
  return `${ev.pmoc_plan_id ?? ev.os_id ?? i}-${ev.situacao}-${i}`
}

function situacoesDoDia(evs: PmocEvento[]): PmocEventoSituacao[] {
  const presentes = new Set(evs.map((e) => e.situacao))
  return SITUACAO_ORDEM.filter((s) => presentes.has(s))
}

const desktopQuery = "(min-width: 768px)"

function subscribeDesktop(cb: () => void) {
  const mql = window.matchMedia(desktopQuery)
  mql.addEventListener("change", cb)
  return () => mql.removeEventListener("change", cb)
}

/** true a partir de 768px (o Sheet do evento abre à direita; no celular, de baixo). */
function useIsDesktop(): boolean {
  return React.useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(desktopQuery).matches,
    () => true
  )
}

/**
 * Calendário mensal PMOC. Desktop: grade de 7 colunas com pílulas por evento.
 * Celular: faixa de dias com ponto de status e agenda do dia escolhido (ou
 * do mês inteiro). Tocar num evento abre o Sheet de detalhes.
 */
export function PmocCalendar({ mes, hoje, eventos, detalhes }: PmocCalendarProps) {
  const [selecionado, setSelecionado] = React.useState<PmocEvento | null>(null)
  const [diaPopover, setDiaPopover] = React.useState<string | null>(null)
  const isDesktop = useIsDesktop()

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

  return (
    <>
      {/* Desktop: grade mensal de 7 colunas */}
      <Card className="hidden gap-0 py-0 md:flex">
        <div className="grid grid-cols-7 border-b border-line-soft" aria-hidden="true">
          {DIAS_SEMANA.map((dia) => (
            <div key={dia} className="px-3 py-3 text-[0.8125rem] text-ink-faint">
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
                    ? `${format(dia, "d 'de' MMMM", { locale: ptBR })}${ehHoje ? ", hoje" : ""}, ${rotuloManutencoes(evs.length)}`
                    : undefined
                }
                className={cn(
                  "flex min-h-28 min-w-0 flex-col gap-1 bg-console p-2",
                  !doMes && "bg-void/60"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "mb-0.5 flex size-7 items-center justify-center rounded-full text-[0.8125rem] tabular-nums",
                    doMes ? "text-ink-dim" : "text-ink-faint/50",
                    ehHoje && "bg-ink font-medium text-void"
                  )}
                >
                  {dia.getDate()}
                </span>
                {evs.slice(0, MAX_CHIPS).map((ev, i) => (
                  <ChipEvento key={chaveEvento(ev, i)} evento={ev} onSelect={abrirEvento} />
                ))}
                {ocultos > 0 && (
                  <Popover
                    open={diaPopover === key}
                    onOpenChange={(open) => setDiaPopover(open ? key : null)}
                  >
                    <PopoverTrigger
                      aria-label={`Ver as ${evs.length} manutenções de ${format(dia, "d 'de' MMMM", { locale: ptBR })}`}
                      className="h-6 cursor-pointer self-start rounded-full px-2 text-xs font-medium text-ink-dim transition-colors outline-none hover:bg-console-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-ring/60"
                    >
                      +{ocultos} mais
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-72 p-2.5">
                      <p className="px-1 text-[0.8125rem] text-ink-dim first-letter:uppercase">
                        {format(dia, "EEEE, d 'de' MMMM", { locale: ptBR })}
                      </p>
                      <ul role="list" className="flex flex-col gap-1">
                        {evs.map((ev, i) => (
                          <li key={chaveEvento(ev, i)}>
                            <ChipEvento evento={ev} onSelect={abrirEvento} />
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
      </Card>

      {/* Celular: faixa de dias + agenda */}
      <AgendaMobile
        key={mes}
        mes={mes}
        hoje={hoje}
        porDia={porDia}
        onSelect={abrirEvento}
      />

      <PmocEventSheet
        evento={selecionado}
        side={isDesktop ? "right" : "bottom"}
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

// ---------------------------------------------------------------------------
// Celular
// ---------------------------------------------------------------------------

function AgendaMobile({
  mes,
  hoje,
  porDia,
  onSelect,
}: {
  mes: string
  hoje: string
  porDia: Map<string, PmocEvento[]>
  onSelect: (ev: PmocEvento) => void
}) {
  const [ano, mesNum] = mes.split("-").map(Number)
  const diasDoMes = React.useMemo(
    () =>
      eachDayOfInterval({
        start: new Date(ano, mesNum - 1, 1),
        end: endOfMonth(new Date(ano, mesNum - 1, 1)),
      }).map((d) => format(d, "yyyy-MM-dd")),
    [ano, mesNum]
  )
  const diasComEventos = React.useMemo(
    () => diasDoMes.filter((d) => (porDia.get(d)?.length ?? 0) > 0),
    [diasDoMes, porDia]
  )

  const [modo, setModo] = React.useState<"dia" | "mes">("dia")
  const [dia, setDia] = React.useState(() => {
    if (hoje.startsWith(mes)) return hoje
    return diasComEventos[0] ?? diasDoMes[0]
  })

  const faixaRef = React.useRef<HTMLDivElement>(null)
  const primeiraVez = React.useRef(true)

  // Mantém o dia escolhido centralizado na faixa (sem rolar a página).
  React.useEffect(() => {
    const faixa = faixaRef.current
    const alvo = faixa?.querySelector<HTMLElement>(`[data-dia="${dia}"]`)
    if (!faixa || !alvo) return
    const reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    faixa.scrollTo({
      left: alvo.offsetLeft - faixa.clientWidth / 2 + alvo.offsetWidth / 2,
      behavior: primeiraVez.current || reduz ? "auto" : "smooth",
    })
    primeiraVez.current = false
  }, [dia, modo])

  const evsDoDia = porDia.get(dia) ?? []
  const proximoComEvento = diasComEventos.find((d) => d > dia)

  return (
    <Card className="gap-0 py-0 md:hidden">
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <h2 className="font-heading text-[1.0625rem] font-medium tracking-[-0.01em] text-ink">
          Agenda
        </h2>
        <Tabs value={modo} onValueChange={(v) => setModo(v as "dia" | "mes")}>
          <TabsList aria-label="Ver agenda por">
            <TabsTrigger value="dia">Dia</TabsTrigger>
            <TabsTrigger value="mes">Mês</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {modo === "dia" ? (
        <>
          <div
            ref={faixaRef}
            role="group"
            aria-label="Dias do mês"
            className="no-scrollbar scroll-contain flex snap-x gap-1.5 overflow-x-auto px-4 py-4"
          >
            {diasDoMes.map((d) => {
              const data = parseDia(d)
              const evs = porDia.get(d) ?? []
              const situacoes = situacoesDoDia(evs)
              const ativo = d === dia
              const ehHoje = d === hoje
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={ativo}
                  data-dia={d}
                  onClick={() => setDia(d)}
                  aria-label={`${format(data, "EEEE, d 'de' MMMM", { locale: ptBR })}${ehHoje ? ", hoje" : ""}, ${rotuloManutencoes(evs.length)}`}
                  className={cn(
                    "flex h-[4.5rem] w-12 shrink-0 cursor-pointer snap-center flex-col items-center justify-center gap-1 rounded-2xl transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-signal/50",
                    ativo
                      ? "bg-ink text-void"
                      : cn("bg-console-2 text-ink", ehHoje && "ring-1 ring-ink-faint ring-inset")
                  )}
                >
                  <span
                    className={cn(
                      "text-xs capitalize",
                      ativo ? "text-void/70" : "text-ink-faint"
                    )}
                  >
                    {format(data, "EEEEEE", { locale: ptBR })}
                  </span>
                  <span className="font-display text-base leading-none font-medium tabular-nums">
                    {data.getDate()}
                  </span>
                  <span className="flex h-1.5 items-center gap-0.5" aria-hidden="true">
                    {situacoes.slice(0, 3).map((s) => (
                      <span key={s} className={cn("size-1.5 rounded-full", EVENTO_META[s].dot)} />
                    ))}
                  </span>
                </button>
              )
            })}
          </div>

          <section
            aria-label={`Manutenções de ${format(parseDia(dia), "d 'de' MMMM", { locale: ptBR })}`}
            className="border-t border-line-soft"
          >
            <header className="flex items-baseline justify-between gap-3 px-4 pt-4 pb-1">
              <h3 className="text-[0.9375rem] font-medium text-ink first-letter:uppercase">
                {format(parseDia(dia), "EEEE, d 'de' MMMM", { locale: ptBR })}
              </h3>
              <span className="shrink-0 text-[0.8125rem] text-ink-faint">
                {rotuloManutencoes(evsDoDia.length)}
              </span>
            </header>
            {evsDoDia.length === 0 ? (
              <div className="flex flex-col items-start gap-3 px-4 pt-2 pb-5">
                <p className="text-sm text-ink-dim">Nenhuma manutenção prevista neste dia.</p>
                {proximoComEvento && (
                  <Button variant="secondary" size="sm" onClick={() => setDia(proximoComEvento)}>
                    Ir para {format(parseDia(proximoComEvento), "EEE, d/MM", { locale: ptBR })}
                    <ChevronRightIcon aria-hidden="true" />
                  </Button>
                )}
              </div>
            ) : (
              <ListaEventos evs={evsDoDia} onSelect={onSelect} />
            )}
          </section>
        </>
      ) : diasComEventos.length === 0 ? (
        <p className="px-4 pt-3 pb-6 text-sm text-ink-dim">
          Nenhuma manutenção prevista neste mês.
        </p>
      ) : (
        <div className="pt-2 pb-1">
          {diasComEventos.map((d) => (
            <section
              key={d}
              aria-label={`${format(parseDia(d), "d 'de' MMMM", { locale: ptBR })}, ${rotuloManutencoes(porDia.get(d)?.length ?? 0)}`}
              className="border-t border-line-soft first:border-t-0"
            >
              <header className="flex items-center gap-2 px-4 pt-4 pb-1">
                <h3 className="text-[0.9375rem] font-medium text-ink first-letter:uppercase">
                  {format(parseDia(d), "EEEE, d 'de' MMMM", { locale: ptBR })}
                </h3>
                {d === hoje && (
                  <Badge variant="secondary" className="bg-console-3">
                    Hoje
                  </Badge>
                )}
              </header>
              <ListaEventos evs={porDia.get(d) ?? []} onSelect={onSelect} />
            </section>
          ))}
        </div>
      )}
    </Card>
  )
}

function ListaEventos({
  evs,
  onSelect,
}: {
  evs: PmocEvento[]
  onSelect: (ev: PmocEvento) => void
}) {
  return (
    <ul role="list" className="divide-y divide-line-soft px-1 pb-1">
      {evs.map((ev, i) => {
        const meta = EVENTO_META[ev.situacao]
        return (
          <li key={chaveEvento(ev, i)}>
            <button
              type="button"
              onClick={() => onSelect(ev)}
              aria-label={`${meta.label}: ${ev.codigo_interno}, ${ev.predio}. Abrir detalhes`}
              className="flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors outline-none hover:bg-console-2/70 focus-visible:bg-console-2/70 active:bg-console-2"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="shrink-0 text-[0.9375rem] font-medium text-ink">
                    {ev.codigo_interno}
                  </span>
                  <span className="truncate text-[0.8125rem] text-ink-faint">
                    {EQUIPMENT_TYPE_LABELS[ev.equipamento_tipo]}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[0.8125rem] text-ink-dim">
                  {ev.predio}, {ev.cliente}
                </span>
              </span>
              <Badge className={cn("shrink-0", meta.badge)}>{meta.label}</Badge>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Desktop
// ---------------------------------------------------------------------------

function ChipEvento({
  evento,
  onSelect,
}: {
  evento: PmocEvento
  onSelect: (ev: PmocEvento) => void
}) {
  const meta = EVENTO_META[evento.situacao]
  return (
    <button
      type="button"
      onClick={() => onSelect(evento)}
      aria-label={`${meta.label}: ${evento.codigo_interno}, ${evento.predio}. Abrir detalhes`}
      title={`${evento.codigo_interno} · ${evento.predio}`}
      className={cn(
        "flex h-6 w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-full px-2 text-left text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        meta.chip
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", meta.dot)} aria-hidden="true" />
      <span className="shrink-0 font-medium">{evento.codigo_interno}</span>
      <span className="truncate opacity-80">{evento.predio}</span>
    </button>
  )
}
