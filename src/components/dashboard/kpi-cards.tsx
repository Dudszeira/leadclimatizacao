import type { CSSProperties } from "react"
import {
  AirVentIcon,
  BotIcon,
  TimerIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
  WrenchIcon,
} from "lucide-react"

import { getDashboardKpis } from "@/server/dashboard"
import { DataError } from "@/components/data-error"
import { formatInteiro, formatMinutos, formatPct } from "@/lib/format"
import { StatCard } from "./stat-card"

function delay(s: number): CSSProperties {
  return { "--enter-delay": `${s}s` } as CSSProperties
}

/** Linha de 4 KPIs do topo — espelho do "Console de Operações" da demo aceita. */
export async function KpiCards() {
  const result = await getDashboardKpis()
  if (result.error !== null) {
    return <DataError message={result.error} compact />
  }
  const kpis = result.data

  return (
    <section
      aria-label="Indicadores da operação"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      <StatCard
        style={delay(0.02)}
        label="Equipamentos sob contrato"
        value={formatInteiro(kpis.equipamentos_sob_contrato)}
        icon={AirVentIcon}
        sub="ativos em prédios com contrato vigente"
        subIcon={TrendingUpIcon}
        tone="clear"
      />
      <StatCard
        style={delay(0.08)}
        label="Chamados abertos"
        value={formatInteiro(kpis.chamados_abertos)}
        icon={WrenchIcon}
        sub="aguardando, agendados e em campo"
        subIcon={TriangleAlertIcon}
        tone={kpis.chamados_abertos > 0 ? "amber" : "clear"}
      />
      <StatCard
        style={delay(0.14)}
        label="Resolvidos pela IA"
        value={formatPct(kpis.triagem_ia_pct)}
        icon={BotIcon}
        sub="das triagens sem transferir para humano"
        subIcon={TrendingUpIcon}
        tone="clear"
      />
      <StatCard
        style={delay(0.2)}
        label="Tempo médio de 1ª resposta"
        value={formatMinutos(kpis.tempo_primeira_resposta_min)}
        icon={TimerIcon}
        sub="entre a mensagem do cliente e a resposta"
        tone="neutral"
      />
    </section>
  )
}
