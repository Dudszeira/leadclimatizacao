"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { CalendarDaysIcon, ChevronDownIcon, LoaderCircleIcon, SearchIcon, XIcon } from "lucide-react"
import { cn } from "cn"

import type { InvoiceStatus } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export type StatusParam = InvoiceStatus | "todos"

export type CompetenciaOption = { value: string; label: string }

const STATUS_CHIPS: Array<{ value: StatusParam; label: string }> = [
  { value: "todos", label: "Todas" },
  { value: "pendente", label: "Pendentes" },
  { value: "atrasado", label: "Atrasadas" },
  { value: "pago", label: "Pagas" },
  { value: "cancelado", label: "Canceladas" },
]

type FaturasToolbarProps = {
  q: string
  status: StatusParam
  /** "" = todas as competências. */
  competencia: string
  /** Mais recente primeiro (a primeira é o mês corrente). */
  competencias: CompetenciaOption[]
}

type State = { q: string; status: StatusParam; competencia: string }

/** Abreviação do mês ("out") e ano a partir de "YYYY-MM-01". */
function mesCurto(value: string): { mes: string; ano: string } {
  const [y, m] = value.split("-").map(Number)
  const mes = new Date(y, m - 1, 1)
    .toLocaleDateString("pt-BR", { month: "short" })
    .replace(".", "")
  return { mes: mes.charAt(0).toUpperCase() + mes.slice(1), ano: String(y) }
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/**
 * Busca (com debounce), status em chips e competência num seletor de papel
 * claro. Tudo vive na URL para o server component refazer a consulta;
 * cada mudança preserva os outros filtros e volta para a página 1.
 */
export function FaturasToolbar({ q, status, competencia, competencias }: FaturasToolbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [text, setText] = React.useState(q)
  const [periodoOpen, setPeriodoOpen] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()
  const lastAppliedQ = React.useRef(q)

  const apply = React.useCallback(
    (next: State) => {
      lastAppliedQ.current = next.q
      const params = new URLSearchParams()
      if (next.q) params.set("q", next.q)
      if (next.status !== "todos") params.set("status", next.status)
      if (next.competencia) params.set("competencia", next.competencia)
      const qs = params.toString()
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      })
    },
    [pathname, router],
  )

  // Voltar/avançar no histórico: ressincroniza o campo de busca.
  React.useEffect(() => {
    if (q !== lastAppliedQ.current) {
      lastAppliedQ.current = q
      setText(q)
    }
  }, [q])

  React.useEffect(() => {
    if (text === q) return
    const timer = setTimeout(() => apply({ q: text, status, competencia }), 350)
    return () => clearTimeout(timer)
  }, [text, q, status, competencia, apply])

  const hasFilters = q !== "" || status !== "todos" || competencia !== ""
  const competenciaLabel = competencia
    ? capitalizar(competencias.find((c) => c.value === competencia)?.label ?? competencia)
    : "Todas as competências"
  const atual = competencias[0]?.value ?? ""
  const anterior = competencias[1]?.value ?? ""

  function escolherCompetencia(value: string) {
    setPeriodoOpen(false)
    if (value === competencia) return
    apply({ q: text, status, competencia: value })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative w-full min-w-0 md:max-w-sm">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-faint"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Buscar cliente ou nº da nota"
            aria-label="Buscar faturas"
            className="pl-10 [&::-webkit-search-cancel-button]:hidden"
          />
          {isPending ? (
            <LoaderCircleIcon
              className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-ink-faint"
              aria-hidden="true"
            />
          ) : null}
        </div>

        <Popover open={periodoOpen} onOpenChange={setPeriodoOpen}>
          <PopoverTrigger
            render={
              <Button
                variant="secondary"
                className={cn(
                  "justify-between md:ml-auto md:min-w-52",
                  competencia && "bg-ink text-void hover:bg-ink/88 aria-expanded:bg-ink",
                )}
                aria-label={`Competência: ${competenciaLabel}`}
              />
            }
          >
            <span className="flex min-w-0 items-center gap-2">
              <CalendarDaysIcon aria-hidden="true" />
              <span className="truncate">{competenciaLabel}</span>
            </span>
            <ChevronDownIcon className="opacity-60" aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="surface-paper w-[min(24rem,calc(100vw-2rem))] gap-5 rounded-[1.5rem] p-5 ring-0"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-display text-xl font-medium tracking-[-0.02em]">Competência</p>
              <p className="text-[0.8125rem] text-ink-dim">Últimos 6 meses</p>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[...competencias].reverse().map((c) => {
                const { mes, ano } = mesCurto(c.value)
                const ativo = c.value === competencia
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => escolherCompetencia(c.value)}
                    aria-pressed={ativo}
                    aria-label={capitalizar(c.label)}
                    className={cn(
                      "flex h-20 flex-col items-start justify-end rounded-2xl px-3 pb-2.5 text-left transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-signal/50",
                      ativo
                        ? "bg-primary text-primary-foreground"
                        : "bg-console text-ink ring-1 ring-line hover:bg-console-2",
                    )}
                  >
                    <span className="text-[0.9375rem] font-medium">{mes}</span>
                    <span className={cn("text-xs tabular-nums", ativo ? "opacity-70" : "text-ink-faint")}>
                      {ano}
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Este mês", value: atual },
                { label: "Mês passado", value: anterior },
                { label: "Todas", value: "" },
              ].map((atalho) => (
                <button
                  key={atalho.label}
                  type="button"
                  onClick={() => escolherCompetencia(atalho.value)}
                  aria-pressed={competencia === atalho.value}
                  className={cn(
                    "inline-flex h-10 items-center rounded-full border px-4 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-signal/50",
                    competencia === atalho.value
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-line text-ink hover:bg-console-2",
                  )}
                >
                  {atalho.label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div
        role="group"
        aria-label="Filtrar por status"
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0"
      >
        {STATUS_CHIPS.map((chip) => {
          const ativo = chip.value === status
          return (
            <button
              key={chip.value}
              type="button"
              aria-pressed={ativo}
              onClick={() => {
                if (!ativo) apply({ q: text, status: chip.value, competencia })
              }}
              className={cn(
                "inline-flex h-11 shrink-0 items-center rounded-full px-4 text-sm font-medium transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-signal/50 md:h-9",
                ativo ? "bg-ink text-void" : "bg-console-2 text-ink-dim hover:bg-console-3 hover:text-ink",
              )}
            >
              {chip.label}
            </button>
          )
        })}
        {hasFilters ? (
          <Button
            variant="ghost"
            className="shrink-0"
            onClick={() => {
              setText("")
              apply({ q: "", status: "todos", competencia: "" })
            }}
          >
            <XIcon aria-hidden="true" />
            Limpar filtros
          </Button>
        ) : null}
      </div>
    </div>
  )
}
