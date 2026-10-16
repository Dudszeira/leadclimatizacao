import Link from "next/link"
import { cn } from "cn"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowUpRightIcon, CircleCheckIcon } from "lucide-react"

import type { PmocPlanDetail } from "@/server/pmoc"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EVENTO_META, parseDia } from "./evento"
import { GerarOsButton } from "./gerar-os-button"

function prazoDe(dias: number): string {
  if (dias < 0) {
    const n = Math.abs(dias)
    return n === 1 ? "Atrasado há 1 dia" : `Atrasado há ${n} dias`
  }
  if (dias === 0) return "Vence hoje"
  if (dias === 1) return "Vence amanhã"
  return `Vence em ${dias} dias`
}

/**
 * Lista "Atenção imediata": planos atrasados e vencendo (≤7 dias), em ordem
 * de urgência, com a ação de gerar as OS preventivas devidas.
 */
export function AtencaoImediata({
  itens,
  podeGerarOs = true,
}: {
  itens: PmocPlanDetail[]
  /** Só admin dispara a geração manual (a RPC recusa outros papéis). */
  podeGerarOs?: boolean
}) {
  const mostrarAcao = itens.length > 0 && podeGerarOs
  return (
    <Card className="gap-0 pb-2 md:pb-2">
      <CardHeader className="gap-1 md:flex md:items-start md:justify-between md:gap-6">
        <div className="min-w-0 space-y-1">
          <CardTitle>
            <h2>Atenção imediata</h2>
          </CardTitle>
          <CardDescription>
            Planos atrasados ou vencendo em até 7 dias, do mais urgente ao menos.
          </CardDescription>
        </div>
        {mostrarAcao && <GerarOsButton className="mt-3 w-full md:mt-0 md:w-auto" />}
      </CardHeader>

      {itens.length === 0 ? (
        <p className="flex items-center gap-2 px-(--card-spacing) pt-4 pb-3 text-sm text-ink-dim">
          <CircleCheckIcon className="size-4 shrink-0 text-clear" aria-hidden="true" />
          Nenhum plano exige ação agora. Manutenções em dia.
        </p>
      ) : (
        <ul role="list" className="mt-3 divide-y divide-line-soft">
          {itens.map((item) => {
            const atrasado = item.situacao === "atrasado"
            const meta = atrasado ? EVENTO_META.atrasada : EVENTO_META.vencendo
            return (
              <li
                key={item.pmoc_plan_id}
                className="flex items-start gap-3 px-(--card-spacing) py-3.5 md:items-center"
              >
                <div className="min-w-0 flex-1 md:flex md:items-center md:gap-4">
                  <div className="flex items-center gap-2 md:w-56 md:shrink-0">
                    <span className="text-[0.9375rem] font-medium text-ink">
                      {item.codigo_interno}
                    </span>
                    <Badge className={cn("shrink-0", meta.badge)}>{meta.label}</Badge>
                  </div>
                  <p className="mt-1 truncate text-[0.8125rem] text-ink-dim md:mt-0 md:min-w-0 md:flex-1 md:text-sm">
                    {item.predio}, {item.cliente}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[0.8125rem] md:mt-0 md:shrink-0">
                    <span className={cn("font-medium", meta.text)}>
                      {prazoDe(item.dias_para_vencer)}
                    </span>
                    <span className="text-ink-faint tabular-nums">
                      {format(parseDia(item.proxima_data), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </p>
                </div>
                {item.os_id !== null && (
                  <Link
                    href={`/chamados/${item.os_id}`}
                    className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-1 text-[0.8125rem] font-medium text-signal outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/60 md:min-h-9"
                    aria-label={`Ver OS #${item.os_numero} do equipamento ${item.codigo_interno}`}
                  >
                    OS #{item.os_numero}
                    <ArrowUpRightIcon className="size-3.5" aria-hidden="true" />
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
