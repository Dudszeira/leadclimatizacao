"use client"

import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { ChamadosPorMesPoint } from "@/lib/types"

const chartConfig = {
  preventiva_pmoc: { label: "Preventiva PMOC", color: "var(--chart-1)" },
  corretiva: { label: "Corretiva", color: "var(--chart-3)" },
  instalacao: { label: "Instalação", color: "var(--chart-2)" },
  orcamento: { label: "Orçamento", color: "var(--chart-5)" },
} satisfies ChartConfig

/** "YYYY-MM-DD" → Date local (evita voltar um dia por fuso). */
function mesToDate(mes: string): Date {
  const [ano, mesNum] = mes.split("-").map(Number)
  return new Date(ano, mesNum - 1, 1)
}

function mesPorExtenso(mes: string): string {
  return format(mesToDate(mes), "MMMM 'de' yyyy", { locale: ptBR })
}

export function ChamadosChart({ points }: { points: ChamadosPorMesPoint[] }) {
  const data = points.map((p) => ({
    mes: p.mes,
    label: format(mesToDate(p.mes), "MMM", { locale: ptBR }).replace(".", ""),
    ...p.por_tipo,
  }))

  const resumo = points
    .map((p) => `${mesPorExtenso(p.mes)}: ${p.total}`)
    .join("; ")

  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-[16/8] w-full"
      role="img"
      aria-label={`Chamados abertos por mês nos últimos 6 meses: ${resumo}`}
    >
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -16 }}>
        <CartesianGrid vertical={false} strokeDasharray="2 3" stroke="var(--line)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
        <ChartTooltip
          cursor={{ fill: "var(--console-2)" }}
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const primeiro = payload?.[0]?.payload as { mes?: string } | undefined
                return primeiro?.mes ? mesPorExtenso(primeiro.mes) : null
              }}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="preventiva_pmoc" stackId="os" fill="var(--color-preventiva_pmoc)" />
        <Bar dataKey="corretiva" stackId="os" fill="var(--color-corretiva)" />
        <Bar dataKey="instalacao" stackId="os" fill="var(--color-instalacao)" />
        <Bar dataKey="orcamento" stackId="os" fill="var(--color-orcamento)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
