import type { CSSProperties } from "react"
import { BarChart3Icon } from "lucide-react"
import { cn } from "cn"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getChamadosPorMes } from "@/server/dashboard"
import { DataError } from "@/components/data-error"
import { formatInteiro, formatPct } from "@/lib/format"
import { ChamadosChartLazy } from "./chamados-chart-lazy"
import { SwatchHachurado, SwatchSolido } from "./chart-swatches"
import {
  idxDeIso,
  intervaloCurto,
  JANELA_MESES,
  mesesNoPeriodo,
  type Periodo,
} from "./periodo"

/** Gráfico de chamados do período escolhido: todos os tipos x corretivas. */
export async function ChamadosChartCard({
  periodo,
  className,
}: {
  periodo: Periodo
  className?: string
}) {
  // A série vem dos últimos 12 meses e o período escolhido recorta os meses.
  const serie = await getChamadosPorMes(JANELA_MESES)
  const result =
    serie.error !== null
      ? serie
      : {
          data: serie.data.filter((p) => {
            const i = idxDeIso(p.mes)
            return i >= periodo.inicio && i <= periodo.fim
          }),
          error: null,
        }
  const n = mesesNoPeriodo(periodo)

  return (
    <Card
      className={cn("console-enter", className)}
      style={{ "--enter-delay": "0.1s" } as CSSProperties}
    >
      <CardHeader>
        <CardTitle>Chamados por mês</CardTitle>
        <CardDescription>
          {n === 1
            ? `Em ${intervaloCurto(periodo)}, com as corretivas ao lado`
            : `De ${intervaloCurto(periodo)}, com as corretivas ao lado`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-end">
        {result.error !== null ? (
          <DataError message={result.error} compact />
        ) : result.data.every((p) => p.total === 0) ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
            <BarChart3Icon className="size-6 text-ink-faint" aria-hidden="true" />
            <p className="text-sm text-ink-dim">
              Nenhum chamado neste período. Escolha outro período ou aguarde os novos.
            </p>
          </div>
        ) : (
          (() => {
            const pontos = result.data
            const total = pontos.reduce((s, p) => s + p.total, 0)
            const corretivas = pontos.reduce((s, p) => s + p.por_tipo.corretiva, 0)
            return (
              <>
                <ChamadosChartLazy points={pontos} />
                <dl className="mt-4 grid grid-cols-2 divide-x divide-line-soft border-t border-line-soft pt-4">
                  <div className="flex min-w-0 flex-col gap-1 pr-4">
                    <dt className="flex items-center gap-2 text-xs text-ink-faint md:text-[0.8125rem]">
                      <SwatchSolido />
                      <span className="truncate">Todos os tipos</span>
                    </dt>
                    <dd className="font-display text-xl font-medium tracking-[-0.02em] text-ink tabular-nums md:text-2xl">
                      {formatInteiro(total)}
                    </dd>
                  </div>
                  <div className="flex min-w-0 flex-col gap-1 pl-4">
                    <dt className="flex items-center gap-2 text-xs text-ink-faint md:text-[0.8125rem]">
                      <SwatchHachurado />
                      <span className="truncate">Corretivas</span>
                    </dt>
                    <dd className="flex items-baseline gap-2 font-display text-xl font-medium tracking-[-0.02em] text-ink tabular-nums md:text-2xl">
                      {formatInteiro(corretivas)}
                      <span className="font-sans text-xs font-normal tracking-normal text-ink-faint">
                        {formatPct(total > 0 ? Math.round((corretivas / total) * 1000) / 10 : null)} do total
                      </span>
                    </dd>
                  </div>
                </dl>
              </>
            )
          })()
        )}
      </CardContent>
    </Card>
  )
}
