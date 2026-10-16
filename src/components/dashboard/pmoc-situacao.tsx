import type { CSSProperties } from "react"
import Link from "next/link"
import { CalendarCheckIcon, ChevronRightIcon } from "lucide-react"
import { cn } from "cn"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DataError } from "@/components/data-error"
import { formatInteiro } from "@/lib/format"
import { plural, pmocDoRequest } from "./data"

type Faixa = {
  key: string
  label: string
  detalhe: string
  valor: number
  dot: string
  bar: string
  valorClass: string
}

/** Situação PMOC (Lei 13.589/2018): barra de proporção + linhas por faixa. */
export async function PmocSituacaoCards({ className }: { className?: string }) {
  const result = await pmocDoRequest()

  return (
    <Card
      className={cn("console-enter", className)}
      style={{ "--enter-delay": "0.12s" } as CSSProperties}
    >
      <CardHeader>
        <CardTitle>Situação PMOC</CardTitle>
        <CardDescription>
          {result.error === null
            ? `${formatInteiro(result.data.total)} ${plural(result.data.total, "plano ativo", "planos ativos")}`
            : "Planos de manutenção ativos"}
        </CardDescription>
        <CardAction>
          <Link
            href="/pmoc"
            className="-mr-2 inline-flex h-11 items-center gap-1 rounded-full px-2 text-sm font-medium text-ink-dim outline-none transition-colors hover:text-ink focus-visible:ring-[3px] focus-visible:ring-ring/50 md:h-8"
          >
            Calendário
            <ChevronRightIcon className="size-4" aria-hidden="true" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {result.error !== null ? (
          <DataError message={result.error} compact />
        ) : result.data.total === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
            <CalendarCheckIcon className="size-6 text-ink-faint" aria-hidden="true" />
            <p className="text-sm text-ink-dim">
              Nenhum plano PMOC ativo. Crie um a partir do cadastro do prédio.
            </p>
          </div>
        ) : (
          (() => {
            const c = result.data
            const faixas: Faixa[] = [
              {
                key: "atrasados",
                label: "Atrasados",
                detalhe: c.atrasados > 0 ? "Risco de multa, regularize já" : "Nenhum plano em atraso",
                valor: c.atrasados,
                dot: "bg-danger",
                bar: "bg-danger",
                valorClass: c.atrasados > 0 ? "text-danger" : "text-ink",
              },
              {
                key: "vencendo",
                label: "Vencendo em 7 dias",
                detalhe: c.vencendo_7d > 0 ? "Confirme técnico e horário" : "Nada a agendar por ora",
                valor: c.vencendo_7d,
                dot: "bg-amber",
                bar: "bg-amber",
                valorClass: c.vencendo_7d > 0 ? "text-amber" : "text-ink",
              },
              {
                key: "em-dia",
                label: "Em dia",
                detalhe: "Manutenção dentro do prazo",
                valor: c.em_dia,
                dot: "bg-clear",
                bar: "bg-clear",
                valorClass: "text-ink",
              },
            ]
            const total = Math.max(1, c.total)
            return (
              <>
                <div
                  className="flex h-2 gap-1 overflow-hidden rounded-full"
                  role="img"
                  aria-label={`${c.em_dia} em dia, ${c.vencendo_7d} vencendo em 7 dias, ${c.atrasados} atrasados`}
                >
                  {[...faixas].reverse().map((f) =>
                    f.valor > 0 ? (
                      <div
                        key={f.key}
                        className={cn("h-full basis-0 rounded-full", f.bar)}
                        style={{ flexGrow: f.valor / total }}
                      />
                    ) : null
                  )}
                </div>
                <ul aria-label="Planos PMOC por situação" className="-mx-2 mt-3 divide-y divide-line-soft">
                  {faixas.map((f) => (
                    <li key={f.key}>
                      <Link
                        href="/pmoc"
                        className="flex min-h-14 items-center gap-3 rounded-2xl px-2 py-2.5 outline-none transition-colors duration-200 hover:bg-console-2 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      >
                        <span className={cn("size-2 shrink-0 rounded-full", f.dot)} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">{f.label}</span>
                          <span className="mt-0.5 block truncate text-[0.8125rem] text-ink-faint">
                            {f.detalhe}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "font-display text-2xl leading-none font-medium tracking-[-0.02em] tabular-nums",
                            f.valorClass
                          )}
                        >
                          {formatInteiro(f.valor)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )
          })()
        )}
      </CardContent>
    </Card>
  )
}
