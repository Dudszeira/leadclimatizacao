"use client"

import dynamic from "next/dynamic"

import { Skeleton } from "@/components/ui/skeleton"
import type { ChamadosPorMesPoint } from "@/lib/types"

/** Placeholder com a mesma proporção do gráfico (sem salto de layout). */
function ChamadosChartPlaceholder() {
  return (
    <div
      className="flex aspect-[16/8] w-full items-end gap-4 px-2 pb-6"
      aria-label="Carregando gráfico de chamados"
      aria-busy="true"
    >
      <Skeleton className="h-[70%] flex-1" />
      <Skeleton className="h-[85%] flex-1" />
      <Skeleton className="h-[60%] flex-1" />
      <Skeleton className="h-[75%] flex-1" />
      <Skeleton className="h-[45%] flex-1" />
      <Skeleton className="h-[55%] flex-1" />
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
