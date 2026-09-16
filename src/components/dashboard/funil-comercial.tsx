import type { CSSProperties } from "react"
import {
  CalendarCheckIcon,
  ChevronRightIcon,
  CircleDollarSignIcon,
  HandshakeIcon,
  TrendingUpIcon,
  UserPlusIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { getFunilDoMes } from "@/server/dashboard"
import { DataError } from "@/components/data-error"
import { formatBRLInteiro, formatInteiro, formatPct } from "@/lib/format"

type Estagio = {
  label: string
  valor: number
  icon: LucideIcon
  /** Taxa de conversão a partir do estágio anterior (null no primeiro). */
  taxaAnterior: number | null
}

function EstagioCard({ estagio }: { estagio: Estagio }) {
  const Icon = estagio.icon
  return (
    <div
      className="flex min-w-0 flex-1 flex-col rounded-lg border border-line-soft bg-console-2/50 p-3"
      aria-label={`${estagio.label}: ${formatInteiro(estagio.valor)}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[0.68rem] leading-snug tracking-[0.05em] text-ink-faint uppercase">
          {estagio.label}
        </span>
        <Icon className="size-3.5 shrink-0 text-signal" aria-hidden="true" />
      </div>
      <span className="mt-2 font-mono text-2xl leading-none font-semibold text-ink tabular-nums">
        {formatInteiro(estagio.valor)}
      </span>
    </div>
  )
}

function TaxaEntreEtapas({ taxa }: { taxa: number | null }) {
  return (
    <div
      className="flex shrink-0 flex-col items-center justify-center gap-0.5 self-center px-0.5"
      aria-label={`Conversão da etapa anterior: ${formatPct(taxa)}`}
    >
      <ChevronRightIcon
        className="size-4 text-ink-faint max-sm:rotate-90"
        aria-hidden="true"
      />
      <span className="font-mono text-[0.68rem] text-ink-dim tabular-nums">
        {formatPct(taxa)}
      </span>
    </div>
  )
}

/** Seção "Funil comercial · Leads → Venda" do mês corrente. */
export async function FunilComercial() {
  const result = await getFunilDoMes()

  return (
    <Card
      className="console-enter"
      style={{ "--enter-delay": "0.18s" } as CSSProperties}
    >
      <CardHeader>
        <CardTitle>Funil comercial · Leads → Venda</CardTitle>
        <CardDescription>
          Leads criados no mês corrente, do primeiro contato ao contrato assinado
        </CardDescription>
      </CardHeader>
      <CardContent>
        {result.error !== null ? (
          <DataError message={result.error} compact />
        ) : result.data.leads_total === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <UsersIcon className="size-6 text-ink-faint" aria-hidden="true" />
            <p className="text-sm text-ink-dim">Nenhum lead registrado neste mês.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-stretch sm:gap-0.5">
              <EstagioCard
                estagio={{
                  label: "Leads no mês",
                  valor: result.data.leads_total,
                  icon: UserPlusIcon,
                  taxaAnterior: null,
                }}
              />
              <TaxaEntreEtapas taxa={result.data.taxa_lead_para_reuniao} />
              <EstagioCard
                estagio={{
                  label: "Reunião marcada",
                  valor: result.data.reunioes_marcadas,
                  icon: CalendarCheckIcon,
                  taxaAnterior: result.data.taxa_lead_para_reuniao,
                }}
              />
              <TaxaEntreEtapas taxa={result.data.taxa_reuniao_para_realizada} />
              <EstagioCard
                estagio={{
                  label: "Reunião realizada",
                  valor: result.data.reunioes_realizadas,
                  icon: UsersIcon,
                  taxaAnterior: result.data.taxa_reuniao_para_realizada,
                }}
              />
              <TaxaEntreEtapas taxa={result.data.taxa_realizada_para_venda} />
              <EstagioCard
                estagio={{
                  label: "Venda",
                  valor: result.data.vendas,
                  icon: HandshakeIcon,
                  taxaAnterior: result.data.taxa_realizada_para_venda,
                }}
              />
            </div>
            <Separator className="my-4" />
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="flex items-center gap-2">
                <CircleDollarSignIcon className="size-4 text-clear" aria-hidden="true" />
                <span className="text-xs text-ink-faint">Valor convertido no mês</span>
                <span className="font-mono text-sm font-semibold text-clear tabular-nums">
                  {formatBRLInteiro(result.data.valor_convertido)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUpIcon className="size-4 text-signal" aria-hidden="true" />
                <span className="text-xs text-ink-faint">Conversão geral (lead → venda)</span>
                <span className="font-mono text-sm font-semibold text-ink tabular-nums">
                  {formatPct(result.data.taxa_conversao_geral)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-faint">Em negociação no funil</span>
                <span className="font-mono text-sm font-semibold text-ink-dim tabular-nums">
                  {formatBRLInteiro(result.data.valor_em_funil)}
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
