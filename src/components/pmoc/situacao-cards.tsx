import type { CSSProperties } from "react"
import {
  CalendarClockIcon,
  CircleCheckIcon,
  TriangleAlertIcon,
} from "lucide-react"

import type { PmocContadores } from "@/lib/types"
import { formatInteiro } from "@/lib/format"
import { StatCard } from "@/components/dashboard/stat-card"

function delay(s: number): CSSProperties {
  return { "--enter-delay": `${s}s` } as CSSProperties
}

/** Linha de 3 cards de situação PMOC no topo do calendário. */
export function PmocSituacaoCards({ contadores }: { contadores: PmocContadores }) {
  return (
    <section
      aria-label="Situação dos planos PMOC (Lei 13.589/2018)"
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
    >
      <StatCard
        style={delay(0)}
        label="PMOCs em dia"
        value={formatInteiro(contadores.em_dia)}
        icon={CircleCheckIcon}
        sub={`de ${formatInteiro(contadores.total)} planos ativos`}
        tone="clear"
        valueClassName="text-clear"
      />
      <StatCard
        style={delay(0.06)}
        label="Vencendo nos próximos 7 dias"
        value={formatInteiro(contadores.vencendo_7d)}
        icon={CalendarClockIcon}
        sub={
          contadores.vencendo_7d > 0
            ? "agendar visita esta semana"
            : "nada a vencer esta semana"
        }
        subIcon={contadores.vencendo_7d > 0 ? TriangleAlertIcon : undefined}
        tone={contadores.vencendo_7d > 0 ? "amber" : "neutral"}
        valueClassName="text-amber"
      />
      <StatCard
        style={delay(0.12)}
        label="Atrasados"
        value={formatInteiro(contadores.atrasados)}
        icon={TriangleAlertIcon}
        sub={
          contadores.atrasados > 0
            ? "risco de multa · Lei 13.589/2018"
            : "nenhum plano em atraso"
        }
        subIcon={contadores.atrasados > 0 ? TriangleAlertIcon : undefined}
        tone={contadores.atrasados > 0 ? "danger" : "neutral"}
        valueClassName="text-danger"
      />
    </section>
  )
}
