import type { Metadata } from "next"
import { Suspense } from "react"

import { AtividadeSistema } from "@/components/dashboard/atividade-sistema"
import { ChamadosChartCard } from "@/components/dashboard/chamados-chart-card"
import { ChamadosRecentes } from "@/components/dashboard/chamados-recentes"
import { FunilComercial } from "@/components/dashboard/funil-comercial"
import { KpiCards } from "@/components/dashboard/kpi-cards"
import { PmocSituacaoCards } from "@/components/dashboard/pmoc-situacao"
import {
  ChartSkeleton,
  FunilSkeleton,
  KpisSkeleton,
  ListaSkeleton,
  PmocSkeleton,
} from "@/components/dashboard/skeletons"

export const metadata: Metadata = {
  title: "Dashboard",
}

export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-5">
      <Suspense fallback={<KpisSkeleton />}>
        <KpiCards />
      </Suspense>

      <div className="grid grid-cols-1 items-stretch gap-4 md:gap-5 xl:grid-cols-2">
        <Suspense fallback={<ChartSkeleton />}>
          <ChamadosChartCard />
        </Suspense>
        <Suspense fallback={<ListaSkeleton />}>
          <ChamadosRecentes />
        </Suspense>
      </div>

      <Suspense fallback={<ListaSkeleton linhas={6} />}>
        <AtividadeSistema />
      </Suspense>

      <Suspense fallback={<FunilSkeleton />}>
        <FunilComercial />
      </Suspense>

      <Suspense fallback={<PmocSkeleton />}>
        <PmocSituacaoCards />
      </Suspense>
    </div>
  )
}
