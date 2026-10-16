import type { Metadata } from "next"
import { Suspense } from "react"

import { PageHeader } from "@/components/page-header"
import { AtividadeSistema } from "@/components/dashboard/atividade-sistema"
import { ChamadosChartCard } from "@/components/dashboard/chamados-chart-card"
import { ChamadosRecentes } from "@/components/dashboard/chamados-recentes"
import { FunilComercial } from "@/components/dashboard/funil-comercial"
import { KpiCards } from "@/components/dashboard/kpi-cards"
import { mesAtualBRT, parsePeriodo, serializePeriodo } from "@/components/dashboard/periodo"
import { PeriodoPicker } from "@/components/dashboard/periodo-picker"
import { PmocSituacaoCards } from "@/components/dashboard/pmoc-situacao"
import {
  ChartSkeleton,
  FunilSkeleton,
  KpisSkeleton,
  ListaSkeleton,
  PmocSkeleton,
} from "@/components/dashboard/skeletons"
import { requireRole } from "@/server/auth"

export const metadata: Metadata = {
  title: "Dashboard",
}

const dataHoje = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  weekday: "long",
  day: "numeric",
  month: "long",
})

// No celular a ordem segue a urgência (próximas visitas e PMOC antes do
// gráfico). No desktop são duas colunas independentes: gráfico + funil à
// esquerda (2/3) e visitas + PMOC à direita, cada card do tamanho do conteúdo.
// Os wrappers de coluna viram `contents` no celular para a ordem valer.
const ORDEM = {
  recentes: "max-lg:order-1",
  pmoc: "max-lg:order-2",
  chart: "max-lg:order-3",
  funil: "max-lg:order-5",
} as const

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // Técnico não tem dashboard (nav.ts/homeFor): vai para /chamados.
  const profile = await requireRole("admin", "atendente")
  const hoje = dataHoje.format(new Date())
  const atual = mesAtualBRT()
  const periodo = parsePeriodo((await searchParams).periodo, atual)

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Dashboard"
        description={`${hoje.charAt(0).toUpperCase()}${hoje.slice(1)}. O que pede atenção na operação hoje.`}
        actions={
          <PeriodoPicker key={serializePeriodo(periodo)} periodo={periodo} atual={atual} />
        }
      />

      <div className="flex flex-col gap-4 md:gap-6">
        <Suspense fallback={<KpisSkeleton />}>
          <KpiCards role={profile.role} />
        </Suspense>

        <div className="flex flex-col gap-4 md:gap-6 lg:grid lg:grid-cols-3 lg:items-start">
          <div className="max-lg:contents lg:col-span-2 lg:flex lg:flex-col lg:gap-6">
            <Suspense
              key={serializePeriodo(periodo)}
              fallback={<ChartSkeleton className={ORDEM.chart} />}
            >
              <ChamadosChartCard periodo={periodo} className={ORDEM.chart} />
            </Suspense>
            <Suspense fallback={<FunilSkeleton className={ORDEM.funil} />}>
              <FunilComercial className={ORDEM.funil} />
            </Suspense>
          </div>
          <div className="max-lg:contents lg:flex lg:flex-col lg:gap-6">
            <Suspense fallback={<ListaSkeleton className={ORDEM.recentes} />}>
              <ChamadosRecentes className={ORDEM.recentes} />
            </Suspense>
            <Suspense fallback={<PmocSkeleton className={ORDEM.pmoc} />}>
              <PmocSituacaoCards className={ORDEM.pmoc} />
            </Suspense>
          </div>
          <Suspense
            fallback={<ListaSkeleton linhas={4} colunas={2} className="max-lg:order-4 lg:col-span-3" />}
          >
            <AtividadeSistema className="max-lg:order-4 lg:col-span-3" />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
