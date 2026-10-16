"use client"

import dynamic from "next/dynamic"

import { Skeleton } from "@/components/ui/skeleton"
import type { ChamadosPorMesPoint } from "@/lib/types"

const BARRAS = [55, 70, 48, 62, 38, 80]

/** Placeholder com a mesma proporção do gráfico (sem salto de layout). */
function ChamadosChartPlaceholder() {
  return (
    <div
      className="flex h-52 w-full items-end gap-3 pb-7 pl-8 sm:h-64 sm:gap-5 lg:h-72"
      aria-label="Carregando gráfico de chamados"
      aria-busy="true"
    >
      {BARRAS.map((h, i) => (
        <Skeleton key={i} className="flex-1 rounded-t-md rounded-b-sm" style={{ height: `${h}%` }} />
      ))}
    </div>
  )
}

// Recharts (~100 kB gz) sai do bundle inicial: carrega só no cliente, depois
// dos KPIs, com skeleton no lugar.
const ChamadosChartDynamic = dynamic(
  () => import("./chamados-chart").then((m) => m.ChamadosChart),
  { ssr: false, loading: () => <ChamadosChartPlaceholder /> },
)

export function ChamadosChartLazy({ points }: { points: ChamadosPorMesPoint[] }) {
  return <ChamadosChartDynamic points={points} />
}
