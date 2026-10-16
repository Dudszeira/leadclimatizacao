import type { CSSProperties } from "react"
import {
  CalendarClockIcon,
  CircleCheckIcon,
  ClipboardListIcon,
  TriangleAlertIcon,
} from "lucide-react"

import type { PmocContadores } from "@/lib/types"
import { formatInteiro } from "@/lib/format"
import { StatCard } from "@/components/dashboard/stat-card"

function delay(s: number): CSSProperties {
  return { "--enter-delay": `${s}s` } as CSSProperties
}

/** Situação dos planos PMOC: grade 2x2 no celular, 4 colunas no desktop. */
export function PmocSituacaoCards({ contadores }: { contadores: PmocContadores }) {
  return (
    <section
      aria-label="Situação dos planos PMOC (Lei 13.589/2018)"
      className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4"
    >
      <StatCard
        style={delay(0)}
        label="Planos ativos"
        value={formatInteiro(contadores.total)}
        icon={ClipboardListIcon}
        sub="com visita programada"
      />
      <StatCard
        style={delay(0.05)}
        label="Em dia"
        value={formatInteiro(contadores.em_dia)}
        icon={CircleCheckIcon}
        sub={`de ${formatInteiro(contadores.total)} planos ativos`}
        tone="clear"
        valueClassName="text-clear"
      />
      <StatCard
        style={delay(0.1)}
        label="Vencendo em 7 dias"
        value={formatInteiro(contadores.vencendo_7d)}
        icon={CalendarClockIcon}
        sub={
          contadores.vencendo_7d > 0
            ? "agendar visita esta semana"
            : "nada a vencer esta semana"
        }
        tone={contadores.vencendo_7d > 0 ? "amber" : "neutral"}
        valueClassName={contadores.vencendo_7d > 0 ? "text-amber" : undefined}
      />
      <StatCard
        style={delay(0.15)}
        label="Atrasados"
        value={formatInteiro(contadores.atrasados)}
        icon={TriangleAlertIcon}
        sub={
          contadores.atrasados > 0
            ? "risco de multa pela Lei 13.589"
            : "nenhum plano em atraso"
        }
        tone={contadores.atrasados > 0 ? "danger" : "neutral"}
        valueClassName={contadores.atrasados > 0 ? "text-danger" : undefined}
      />
    </section>
  )
}
