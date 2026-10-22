"use client"

import { useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CalendarIcon, ChevronDownIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { atalhosPeriodo, rotuloPeriodo, type PeriodoDatas } from "./periodo"

/**
 * Pílula de período + seletor claro (`.surface-paper`): atalhos (este mês,
 * mês passado, 90 dias, ano) ou intervalo livre. Grava `inicio` e `fim` na
 * URL, mantém status e busca e volta para a página 1.
 */
export function QuotesPeriodoPicker({ periodo }: { periodo: PeriodoDatas }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<PeriodoDatas>(periodo)
  const atalhos = atalhosPeriodo()
  const invalido = !draft.inicio || !draft.fim || draft.inicio > draft.fim

  function abrir(next: boolean) {
    if (next) setDraft(periodo)
    setOpen(next)
  }

  function aplicar(p: PeriodoDatas) {
    const qs = new URLSearchParams(searchParams.toString())
    qs.set("inicio", p.inicio)
    qs.set("fim", p.fim)
    qs.delete("pagina")
    setOpen(false)
    startTransition(() => {
      router.replace(`${pathname}?${qs.toString()}`, { scroll: false })
    })
  }

  return (
    <Popover open={open} onOpenChange={abrir}>
      <PopoverTrigger
        render={<Button variant="outline" className="min-w-0 justify-start md:justify-center" />}
      >
        <CalendarIcon aria-hidden="true" />
        <span className="sr-only">Período: </span>
        <span className={cn("truncate", pending && "opacity-60")}>{rotuloPeriodo(periodo)}</span>
        <ChevronDownIcon className="ml-auto text-ink-faint md:ml-0" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="surface-paper max-h-(--available-height) w-[min(calc(100vw-2rem),28rem)] gap-5 overflow-y-auto overscroll-contain rounded-[1.75rem] p-5 ring-0 md:p-6"
      >
        <p className="font-display text-xl font-medium tracking-[-0.02em]" aria-live="polite">
          {invalido ? "Escolha o intervalo" : rotuloPeriodo(draft)}
        </p>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Atalhos de período">
          {atalhos.map((a) => {
            const ativo = a.periodo.inicio === draft.inicio && a.periodo.fim === draft.fim
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={ativo}
                onClick={() => aplicar(a.periodo)}
                className={cn(
                  "inline-flex h-11 shrink-0 items-center rounded-full border px-4 text-[0.8125rem] font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-signal/50 md:h-9",
                  ativo
                    ? "border-paper-ink bg-paper-ink text-white"
                    : "border-black/15 bg-white/55 text-ink hover:bg-white",
                )}
              >
                {a.label}
              </button>
            )
          })}
        </div>

        <fieldset className="grid gap-3">
          <legend className="mb-2 text-sm text-ink-dim">Intervalo personalizado</legend>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="periodo-inicio">De</Label>
              <Input
                id="periodo-inicio"
                type="date"
                value={draft.inicio}
                onChange={(e) => setDraft((d) => ({ ...d, inicio: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="periodo-fim">Até</Label>
              <Input
                id="periodo-fim"
                type="date"
                value={draft.fim}
                min={draft.inicio || undefined}
                onChange={(e) => setDraft((d) => ({ ...d, fim: e.target.value }))}
              />
            </div>
          </div>
          {draft.inicio && draft.fim && draft.inicio > draft.fim ? (
            <p role="alert" className="text-[0.8125rem] text-danger">
              A data final precisa ser igual ou depois da inicial.
            </p>
          ) : null}
        </fieldset>

        <div className="flex gap-2 max-sm:[&>*]:flex-1 sm:justify-end">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Fechar
          </Button>
          <Button disabled={invalido} onClick={() => aplicar(draft)}>
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
