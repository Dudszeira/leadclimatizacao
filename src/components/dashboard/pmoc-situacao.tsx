import type { CSSProperties } from "react"
import {
  CalendarClockIcon,
  CircleCheckIcon,
  TriangleAlertIcon,
} from "lucide-react"

import { getPmocContadores } from "@/server/dashboard"
import { DataError } from "@/components/data-error"
import { formatInteiro } from "@/lib/format"
import { StatCard } from "./stat-card"

function delay(s: number): CSSProperties {
  return { "--enter-delay": `${s}s` } as CSSProperties
}

/** Cards de situação PMOC: em dia / vencendo em 7 dias / atrasados. */
export async function PmocSituacaoCards() {
  const result = await getPmocContadores()
  if (result.error !== null) {
    return <DataError message={result.error} compact />
  }
  const contadores = result.data

  return (
    <section
      aria-label="Situação dos planos PMOC (Lei 13.589/2018)"
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
    >
      <StatCard
        style={delay(0.24)}
        label="PMOCs em dia"
        value={formatInteiro(contadores.em_dia)}
        icon={CircleCheckIcon}
        sub={`de ${formatInteiro(contadores.total)} planos ativos`}
        tone="clear"
        valueClassName="text-clear"
      />
      <StatCard
        style={delay(0.3)}
        label="Vencendo nos próximos 7 dias"
        value={formatInteiro(contadores.vencendo_7d)}
        icon={CalendarClockIcon}
        sub={contadores.vencendo_7d > 0 ? "precisa agendar" : "nada a agendar por ora"}
        subIcon={contadores.vencendo_7d > 0 ? TriangleAlertIcon : undefined}
        tone={contadores.vencendo_7d > 0 ? "amber" : "neutral"}
        valueClassName="text-amber"
      />
      <StatCard
        style={delay(0.36)}
        label="Atrasados"
        value={formatInteiro(contadores.atrasados)}
        icon={TriangleAlertIcon}
        sub={
          contadores.atrasados > 0
            ? "risco de multa (Lei 13.589/2018)"
            : "nenhum plano em atraso"
        }
        subIcon={contadores.atrasados > 0 ? TriangleAlertIcon : undefined}
        tone={contadores.atrasados > 0 ? "danger" : "neutral"}
        valueClassName="text-danger"
      />
    </section>
  )
}
