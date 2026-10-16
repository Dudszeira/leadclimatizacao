"use client"

import { useId } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import type { ChamadosPorMesPoint } from "@/lib/types"
import { SwatchHachurado, SwatchSolido } from "./chart-swatches"

const chartConfig = {
  total: { label: "Todos os chamados", color: "var(--ink)" },
  corretiva: { label: "Corretivas", color: "var(--ink-faint)" },
} satisfies ChartConfig

const OUTROS_TIPOS = [
  ["preventiva_pmoc", "Preventiva PMOC"],
  ["instalacao", "Instalação"],
  ["orcamento", "Orçamento"],
] as const

type Linha = {
  mes: string
  label: string
  total: number
  corretiva: number
  preventiva_pmoc: number
  instalacao: number
  orcamento: number
}

/** "YYYY-MM-DD" → Date local (evita voltar um dia por fuso). */
function mesToDate(mes: string): Date {
  const [ano, mesNum] = mes.split("-").map(Number)
  return new Date(ano, mesNum - 1, 1)
}

function mesPorExtenso(mes: string): string {
  return format(mesToDate(mes), "MMMM 'de' yyyy", { locale: ptBR })
}

type TooltipProps = {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: Linha }>
}

/** Tooltip escuro e arredondado, como o da referência. */
function ChamadosTooltip({ active, payload }: TooltipProps) {
  const linha = payload?.[0]?.payload
  if (!active || !linha) return null
  return (
    <div className="min-w-44 rounded-2xl bg-console-2/95 px-3 py-2.5 text-xs shadow-xl ring-1 ring-line backdrop-blur-sm">
      <p className="mb-2 font-medium text-ink first-letter:uppercase">
        {mesPorExtenso(linha.mes)}
      </p>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <SwatchSolido />
          <span className="text-ink-dim">Todos</span>
          <span className="ml-auto font-medium text-ink tabular-nums">{linha.total}</span>
        </div>
        <div className="flex items-center gap-2">
          <SwatchHachurado />
          <span className="text-ink-dim">Corretivas</span>
          <span className="ml-auto font-medium text-ink tabular-nums">{linha.corretiva}</span>
        </div>
      </div>
      <div className="mt-2 space-y-1 border-t border-line pt-2">
        {OUTROS_TIPOS.map(([key, label]) => (
          <div key={key} className="flex items-center gap-2 text-ink-faint">
            <span>{label}</span>
            <span className="ml-auto tabular-nums">{linha[key]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Barras no estilo Copecart: todos os chamados do mês em branco com degradê
 * vertical e, ao lado, as corretivas em barra hachurada para comparação.
 */
export function ChamadosChart({ points }: { points: ChamadosPorMesPoint[] }) {
  const uid = useId().replace(/:/g, "")
  const gradId = `cl-grad-${uid}`
  const hatchId = `cl-hatch-${uid}`

  const data: Linha[] = points.map((p) => ({
    mes: p.mes,
    label: format(mesToDate(p.mes), "MMM", { locale: ptBR }).replace(".", ""),
    total: p.total,
    corretiva: p.por_tipo.corretiva,
    preventiva_pmoc: p.por_tipo.preventiva_pmoc,
    instalacao: p.por_tipo.instalacao,
    orcamento: p.por_tipo.orcamento,
  }))

  const resumo = points
    .map((p) => `${mesPorExtenso(p.mes)}: ${p.total} no total, ${p.por_tipo.corretiva} corretivas`)
    .join("; ")

  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto h-52 w-full sm:h-64 lg:h-72"
      role="img"
      aria-label={`Chamados abertos por mês no período: ${resumo}`}
    >
      <BarChart
        data={data}
        margin={{ top: 8, right: 0, bottom: 0, left: -14 }}
        barGap={4}
        barCategoryGap="28%"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ink)" stopOpacity={1} />
            <stop offset="100%" stopColor="var(--ink)" stopOpacity={0.22} />
          </linearGradient>
          <pattern
            id={hatchId}
            width="5"
            height="5"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="5" height="5" fill="var(--ink)" fillOpacity={0.06} />
            <line x1="0" y1="0" x2="0" y2="5" stroke="var(--ink-dim)" strokeWidth={1.6} />
          </pattern>
        </defs>
        <CartesianGrid
          vertical={false}
          strokeDasharray="3 5"
          stroke="var(--line)"
        />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          interval={data.length > 6 ? "preserveStartEnd" : 0}
          minTickGap={6}
          tick={{ fill: "var(--ink-faint)", fontSize: 12 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          tickCount={4}
          width={36}
          tick={{ fill: "var(--ink-faint)", fontSize: 12 }}
        />
        <ChartTooltip
          cursor={{ fill: "var(--console-2)", radius: 10 }}
          content={<ChamadosTooltip />}
        />
        <Bar
          dataKey="total"
          fill={`url(#${gradId})`}
          radius={[6, 6, 2, 2]}
          maxBarSize={22}
        />
        <Bar
          dataKey="corretiva"
          fill={`url(#${hatchId})`}
          stroke="var(--ink-faint)"
          strokeOpacity={0.35}
          radius={[6, 6, 2, 2]}
          maxBarSize={22}
        />
      </BarChart>
    </ChartContainer>
  )
}
