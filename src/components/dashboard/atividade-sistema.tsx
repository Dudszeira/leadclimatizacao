import type { CSSProperties } from "react"
import { ActivityIcon } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { DashboardResumo } from "@/lib/types"
import { getDashboardResumo } from "@/server/dashboard"
import { DataError } from "@/components/data-error"
import { formatBRLInteiro, formatInteiro } from "@/lib/format"

type ItemAtividade = { mod: string; texto: string }

/** Deriva o feed "módulos conversando entre si" a partir do resumo agregado. */
function itensDeAtividade(resumo: DashboardResumo): ItemAtividade[] {
  const itens: ItemAtividade[] = []
  if (resumo.os_em_campo > 0) {
    itens.push({
      mod: "Chamados → Mapa",
      texto: `${formatInteiro(resumo.os_em_campo)} técnico(s) em campo agora — pins do mapa atualizados em tempo real`,
    })
  }
  if (resumo.os_abertas > 0) {
    itens.push({
      mod: "Atendimento → Chamados",
      texto: `${formatInteiro(resumo.os_abertas)} chamado(s) aguardando triagem ou despacho de técnico`,
    })
  }
  if (resumo.pmoc_atrasados > 0) {
    itens.push({
      mod: "PMOC → Chamados",
      texto: `${formatInteiro(resumo.pmoc_atrasados)} plano(s) PMOC atrasado(s) — regularização pendente (Lei 13.589/2018)`,
    })
  }
  if (resumo.pmoc_vencendo_7d > 0) {
    itens.push({
      mod: "PMOC → Agenda",
      texto: `${formatInteiro(resumo.pmoc_vencendo_7d)} plano(s) PMOC vencendo em até 7 dias — geração automática de OS na fila`,
    })
  }
  if (resumo.leads_mes > 0) {
    itens.push({
      mod: "CRM → Funil",
      texto: `${formatInteiro(resumo.leads_mes)} lead(s) novos entraram no funil comercial este mês`,
    })
  }
  if (resumo.os_concluidas_mes > 0) {
    itens.push({
      mod: "Chamados → Financeiro",
      texto: `${formatInteiro(resumo.os_concluidas_mes)} OS concluída(s) no mês liberada(s) para faturamento`,
    })
  }
  itens.push({
    mod: "Financeiro → CRM",
    texto: `${formatBRLInteiro(resumo.faturamento_recebido_mes)} recebidos de ${formatBRLInteiro(resumo.faturamento_previsto_mes)} previstos no mês — conciliação automática`,
  })
  return itens
}

/** Lista "Atividade do sistema": os 5 módulos da Fase 1 conversando entre si. */
export async function AtividadeSistema() {
  const result = await getDashboardResumo()

  return (
    <Card
      className="console-enter"
      style={{ "--enter-delay": "0.12s" } as CSSProperties}
    >
      <CardHeader>
        <CardTitle>Atividade do sistema</CardTitle>
        <CardDescription>Todos os módulos, num painel só</CardDescription>
      </CardHeader>
      <CardContent>
        {result.error !== null ? (
          <DataError message={result.error} compact />
        ) : (
          (() => {
            const itens = itensDeAtividade(result.data)
            if (itens.length === 0) {
              return (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <ActivityIcon className="size-6 text-ink-faint" aria-hidden="true" />
                  <p className="text-sm text-ink-dim">Nenhuma atividade registrada ainda.</p>
                </div>
              )
            }
            return (
              <ul aria-label="Atividade recente do sistema" className="flex flex-col">
                {itens.map((item) => (
                  <li
                    key={item.mod}
                    className="border-b border-line-soft py-2.5 first:pt-0 last:border-b-0 last:pb-0"
                  >
                    <span className="inline-flex rounded-md bg-signal-dim px-1.5 py-0.5 font-mono text-[0.68rem] tracking-[0.04em] text-signal uppercase">
                      {item.mod}
                    </span>
                    <p className="mt-1 text-sm font-medium text-ink">{item.texto}</p>
                  </li>
                ))}
              </ul>
            )
          })()
        )}
      </CardContent>
    </Card>
  )
}
