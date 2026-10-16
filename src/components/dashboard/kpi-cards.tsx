import type { CSSProperties } from "react"

import { DataError } from "@/components/data-error"
import { formatBRLInteiro, formatInteiro, formatPct } from "@/lib/format"
import type { UserRole } from "@/lib/types"
import { kpisDoRequest, plural, pmocDoRequest, resumoDoRequest } from "./data"
import { StatCard } from "./stat-card"

function delay(s: number): CSSProperties {
  return { "--enter-delay": `${s}s` } as CSSProperties
}

/**
 * Os 4 números que o dono olha de relance, na ordem de urgência:
 * chamados em andamento, PMOC vencendo, a receber no mês (só admin) e a base
 * de equipamentos. Grade 2x2 no celular, 4 colunas no desktop.
 */
export async function KpiCards({ role }: { role: UserRole }) {
  const [kpisR, resumoR, pmocR] = await Promise.all([
    kpisDoRequest(),
    resumoDoRequest(),
    pmocDoRequest(),
  ])

  // Se tudo falhou, um aviso só; se falhou uma fonte, o card dela avisa sozinho.
  if (kpisR.error !== null && resumoR.error !== null && pmocR.error !== null) {
    return <DataError message={kpisR.error} compact />
  }

  const kpis = kpisR.data
  const resumo = resumoR.data
  const pmoc = pmocR.data
  const isAdmin = role === "admin"

  const aReceber = resumo
    ? Math.max(0, resumo.faturamento_previsto_mes - resumo.faturamento_recebido_mes)
    : null

  return (
    <section
      aria-label="Indicadores da operação"
      className="grid grid-cols-2 gap-2.5 md:gap-4 xl:grid-cols-4"
    >
      <StatCard
        style={delay(0.02)}
        href="/chamados"
        label="Chamados abertos"
        value={kpis ? formatInteiro(kpis.chamados_abertos) : null}
        pill={
          resumo && resumo.os_em_campo > 0
            ? { text: `${formatInteiro(resumo.os_em_campo)} em campo`, tone: "signal" }
            : null
        }
        sub={
          resumo
            ? resumo.os_abertas > 0
              ? `${formatInteiro(resumo.os_abertas)} ${plural(resumo.os_abertas, "aguarda", "aguardam")} despacho`
              : "Nenhum aguardando despacho"
            : undefined
        }
        tone={resumo && resumo.os_abertas > 0 ? "amber" : "neutral"}
      />
      <StatCard
        style={delay(0.07)}
        href="/pmoc"
        label="PMOC vencendo"
        value={pmoc ? formatInteiro(pmoc.vencendo_7d) : null}
        pill={
          pmoc && pmoc.atrasados > 0
            ? {
                text: `${formatInteiro(pmoc.atrasados)} ${plural(pmoc.atrasados, "atrasado", "atrasados")}`,
                tone: "danger",
              }
            : null
        }
        sub={pmoc ? `Nos próximos 7 dias, de ${formatInteiro(pmoc.total)} planos` : undefined}
      />
      {isAdmin ? (
        <StatCard
          style={delay(0.12)}
          href="/financeiro"
          label="A receber no mês"
          value={aReceber === null ? null : formatBRLInteiro(aReceber)}
          sub={
            resumo
              ? `${formatBRLInteiro(resumo.faturamento_recebido_mes)} recebidos de ${formatBRLInteiro(resumo.faturamento_previsto_mes)}`
              : undefined
          }
        />
      ) : (
        <StatCard
          style={delay(0.12)}
          href="/atendimento"
          label="Resolvidos pela IA"
          value={
            kpis && kpis.triagem_ia_pct !== null ? formatPct(kpis.triagem_ia_pct) : null
          }
          valueFallback={kpis ? "Sem conversas ainda" : undefined}
          sub="Triagens sem passar para humano"
        />
      )}
      <StatCard
        style={delay(0.17)}
        href="/mapa"
        label="Equipamentos"
        value={kpis ? formatInteiro(kpis.equipamentos_sob_contrato) : null}
        pill={
          resumo && resumo.equip_com_chamado > 0
            ? {
                text: `${formatInteiro(resumo.equip_com_chamado)} com chamado`,
                tone: "amber",
              }
            : null
        }
        sub="Sob contrato vigente"
      />
    </section>
  )
}
