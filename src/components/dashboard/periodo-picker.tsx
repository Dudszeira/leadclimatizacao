"use client"

import { useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  ArrowRightIcon,
  CalendarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  anoDe,
  atalhos,
  janela,
  mesCurto,
  mesIdx,
  rotuloPeriodo,
  serializePeriodo,
  type MesIdx,
  type Periodo,
} from "./periodo"

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Pílula de período + seletor claro (`.surface-paper`), no estilo das
 * referências: abas sublinhadas, grade de meses com faixa cinza e extremos
 * pretos, atalhos em pílulas contornadas, Fechar/Aplicar. Grava em `?periodo=`.
 */
export function PeriodoPicker({ periodo, atual }: { periodo: Periodo; atual: MesIdx }) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Periodo>(periodo)
  /** true depois do 1º clique: o próximo clique fecha a faixa. */
  const [escolhendoFim, setEscolhendoFim] = useState(false)
  const [ano, setAno] = useState(anoDe(periodo.fim))

  const { min, max } = janela(atual)
  const anoMin = anoDe(min)
  const anoMax = anoDe(max)
  const anos = Array.from({ length: anoMax - anoMin + 1 }, (_, i) => anoMax - i)

  function abrir(next: boolean) {
    if (next) {
      setDraft(periodo)
      setEscolhendoFim(false)
      setAno(anoDe(periodo.fim))
    }
    setOpen(next)
  }

  function clicarMes(i: MesIdx) {
    if (!escolhendoFim) {
      setDraft({ inicio: i, fim: i })
      setEscolhendoFim(true)
    } else {
      setDraft((d) => ({ inicio: Math.min(d.inicio, i), fim: Math.max(d.inicio, i) }))
      setEscolhendoFim(false)
    }
  }

  function escolherAno(a: number) {
    setDraft({ inicio: Math.max(min, mesIdx(a, 1)), fim: Math.min(max, mesIdx(a, 12)) })
    setEscolhendoFim(false)
    setAno(a)
  }

  function aplicar() {
    const qs = new URLSearchParams({ periodo: serializePeriodo(draft) })
    setOpen(false)
    startTransition(() => {
      router.replace(`${pathname}?${qs.toString()}`, { scroll: false })
    })
  }

  const meses = Array.from({ length: 12 }, (_, k) => mesIdx(ano, k + 1))

  return (
    <Popover open={open} onOpenChange={abrir}>
      <PopoverTrigger
        render={
          <Button variant="outline" className="min-w-0 justify-start md:justify-center" />
        }
      >
        <CalendarIcon aria-hidden="true" />
        <span className="sr-only">Período: </span>
        <span className={cn("truncate", pending && "opacity-60")}>
          {rotuloPeriodo(periodo, atual)}
        </span>
        <ChevronDownIcon className="ml-auto text-ink-faint md:ml-0" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="surface-paper max-h-(--available-height) w-[min(calc(100vw-2rem),40rem)] gap-4 overflow-y-auto overscroll-contain rounded-[1.75rem] p-4 ring-0 sm:gap-5 md:p-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <p
            className="flex items-center gap-2.5 font-display text-xl font-medium tracking-[-0.02em] md:text-2xl"
            aria-live="polite"
          >
            <span>{capital(mesCurto(draft.inicio))} {anoDe(draft.inicio)}</span>
            {draft.fim !== draft.inicio ? (
              <>
                <ArrowRightIcon className="size-5 text-ink-faint" aria-label="até" />
                <span>{capital(mesCurto(draft.fim))} {anoDe(draft.fim)}</span>
              </>
            ) : null}
          </p>
          <div className="flex gap-2 max-sm:w-full max-sm:[&>*]:flex-1">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Fechar
            </Button>
            <Button onClick={aplicar}>Aplicar</Button>
          </div>
        </div>

        <Tabs defaultValue="meses" className="gap-4">
          <TabsList variant="line" className="border-b-0">
            <TabsTrigger value="meses">Meses</TabsTrigger>
            <TabsTrigger value="anos">Anos</TabsTrigger>
          </TabsList>

          <TabsContent value="meses" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Ano anterior"
                disabled={ano <= anoMin}
                onClick={() => setAno((a) => a - 1)}
              >
                <ChevronLeftIcon />
              </Button>
              <span className="font-display text-base font-medium">{ano}</span>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Próximo ano"
                disabled={ano >= anoMax}
                onClick={() => setAno((a) => a + 1)}
              >
                <ChevronRightIcon />
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6" role="group" aria-label={`Meses de ${ano}`}>
              {meses.map((i) => {
                const fora = i < min || i > max
                const extremo = i === draft.inicio || i === draft.fim
                const dentro = i > draft.inicio && i < draft.fim
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={fora}
                    aria-pressed={extremo || dentro}
                    onClick={() => clicarMes(i)}
                    className={cn(
                      "flex h-11 items-end justify-center rounded-xl pb-1.5 text-sm font-medium capitalize transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-signal/50 sm:h-20 sm:pb-2",
                      extremo
                        ? "bg-paper-ink text-white"
                        : dentro
                          ? "bg-console-3 text-ink"
                          : "bg-white/55 text-ink-dim ring-1 ring-black/[0.04] ring-inset hover:bg-console-2",
                      fora && "cursor-not-allowed bg-transparent text-ink-faint/50 hover:bg-transparent"
                    )}
                  >
                    {mesCurto(i)}
                  </button>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="anos">
            <div className="grid grid-cols-2 gap-1.5">
              {anos.map((a) => {
                const ativo = draft.inicio === Math.max(min, mesIdx(a, 1)) && draft.fim === Math.min(max, mesIdx(a, 12))
                return (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => escolherAno(a)}
                    className={cn(
                      "flex h-14 items-end justify-center rounded-xl pb-2.5 font-display sm:h-16 text-base font-medium transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-signal/50",
                      ativo ? "bg-paper-ink text-white" : "bg-white/55 text-ink-dim ring-1 ring-black/[0.04] ring-inset hover:bg-console-2"
                    )}
                  >
                    {a}
                  </button>
                )
              })}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex flex-wrap gap-2">
          {atalhos(atual).map((a) => {
            const ativo = a.periodo.inicio === draft.inicio && a.periodo.fim === draft.fim
            return (
              <button
                key={a.label}
                type="button"
                aria-pressed={ativo}
                onClick={() => {
                  setDraft(a.periodo)
                  setEscolhendoFim(false)
                  setAno(anoDe(a.periodo.fim))
                }}
                className={cn(
                  "inline-flex h-11 shrink-0 items-center rounded-full border px-4 text-[0.8125rem] font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-signal/50 md:h-9",
                  ativo
                    ? "border-paper-ink bg-paper-ink text-white"
                    : "border-black/15 bg-white/55 text-ink hover:bg-white"
                )}
              >
                {a.label}
              </button>
            )
          })}
        </div>

        <p className="text-xs text-ink-faint">
          Vale para o gráfico de chamados. Há dados dos últimos 12 meses.
        </p>
      </PopoverContent>
    </Popover>
  )
}
