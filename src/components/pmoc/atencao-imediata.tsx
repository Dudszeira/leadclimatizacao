import Link from "next/link"
import { cn } from "cn"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowUpRightIcon, CircleCheckIcon } from "lucide-react"

import type { PmocPlanDetail } from "@/server/pmoc"
import { Badge } from "@/components/ui/badge"
import { EVENTO_META, parseDia } from "./evento"
import { GerarOsButton } from "./gerar-os-button"

function prazoDe(dias: number): string {
  if (dias < 0) {
    const n = Math.abs(dias)
    return n === 1 ? "atrasado há 1 dia" : `atrasado há ${n} dias`
  }
  if (dias === 0) return "vence hoje"
  if (dias === 1) return "vence amanhã"
  return `vence em ${dias} dias`
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
  return (
    <section
      aria-label="Atenção imediata"
      className="overflow-hidden rounded-xl border border-line bg-console"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
        <div>
          <h3 className="font-display text-sm font-bold tracking-tight text-ink">
            Atenção imediata
          </h3>
          <p className="mt-0.5 text-xs text-ink-dim">
            Planos atrasados ou vencendo em até 7 dias, em ordem de urgência.
          </p>
        </div>
        {itens.length > 0 && podeGerarOs && <GerarOsButton />}
      </header>

      {itens.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-6 text-sm text-ink-dim">
          <CircleCheckIcon className="size-4 shrink-0 text-clear" aria-hidden="true" />
          Nenhum plano exige ação agora. Manutenções em dia.
        </p>
      ) : (
        <ul role="list" className="divide-y divide-line-soft">
          {itens.map((item) => {
            const atrasado = item.situacao === "atrasado"
            const meta = atrasado ? EVENTO_META.atrasada : EVENTO_META.vencendo
            return (
              <li
                key={item.pmoc_plan_id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3"
              >
                <Badge
                  variant="outline"
                  className={cn("shrink-0 font-medium", meta.badge)}
                >
                  {meta.label}
                </Badge>
                <span className="shrink-0 font-mono text-sm text-ink">
                  {item.codigo_interno}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink-dim max-md:basis-full">
                  {item.predio} · {item.cliente}
                </span>
                <span className={cn("shrink-0 text-xs font-medium", meta.text)}>
                  {prazoDe(item.dias_para_vencer)}
                </span>
                <span className="shrink-0 font-mono text-xs text-ink-faint tabular-nums">
                  {format(parseDia(item.proxima_data), "dd/MM/yyyy", { locale: ptBR })}
                </span>
                {item.os_id !== null && (
                  <Link
                    href={`/chamados/${item.os_id}`}
                    className="inline-flex shrink-0 items-center gap-1 rounded text-xs font-medium text-signal outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/60"
                    aria-label={`Ver OS-${item.os_numero} do equipamento ${item.codigo_interno}`}
                  >
                    Ver OS-{item.os_numero}
                    <ArrowUpRightIcon className="size-3" aria-hidden="true" />
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
