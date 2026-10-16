import type { CSSProperties } from "react"
import Link from "next/link"
import { ChevronRightIcon, UsersIcon } from "lucide-react"
import { cn } from "cn"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getFunilDoMes } from "@/server/dashboard"
import { DataError } from "@/components/data-error"
import { formatBRLInteiro, formatInteiro, formatPct } from "@/lib/format"

type Estagio = {
  label: string
  valor: number
  /** Conversão a partir da etapa anterior (null no primeiro). */
  taxa: number | null
}

function pct(taxa: number | null): string {
  return taxa === null ? "sem base" : formatPct(taxa)
}

/** Etapa do funil: rótulo, barra proporcional ao total de leads e número. */
function LinhaEstagio({ estagio, max, primeiro }: { estagio: Estagio; max: number; primeiro: boolean }) {
  const largura = max > 0 ? Math.max(2, (estagio.valor / max) * 100) : 2
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm text-ink-dim">{estagio.label}</span>
        <span className="flex shrink-0 items-baseline gap-2">
          {!primeiro ? (
            <span className="text-xs text-ink-faint tabular-nums">
              {pct(estagio.taxa)}
              <span className="max-sm:sr-only"> da etapa anterior</span>
            </span>
          ) : null}
          <span className="w-8 text-right font-display text-lg leading-none font-medium tracking-[-0.02em] text-ink tabular-nums">
            {formatInteiro(estagio.valor)}
          </span>
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-console-2" aria-hidden="true">
        <div
          className="h-full rounded-full bg-linear-to-r from-ink-faint/50 to-ink"
          style={{ width: `${largura}%` }}
        />
      </div>
    </li>
  )
}

/** Funil comercial do mês: leads até a venda, com conversão entre etapas. */
export async function FunilComercial({ className }: { className?: string }) {
  const result = await getFunilDoMes()

  return (
    <Card
      className={cn("console-enter", className)}
      style={{ "--enter-delay": "0.16s" } as CSSProperties}
    >
      <CardHeader>
        <CardTitle>Funil comercial do mês</CardTitle>
        <CardDescription>Do primeiro contato ao contrato assinado</CardDescription>
        <CardAction>
          <Link
            href="/clientes/funil"
            className="-mr-2 inline-flex h-11 items-center gap-1 rounded-full px-2 text-sm font-medium text-ink-dim outline-none transition-colors hover:text-ink focus-visible:ring-[3px] focus-visible:ring-ring/50 md:h-8"
          >
            Abrir funil
            <ChevronRightIcon className="size-4" aria-hidden="true" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {result.error !== null ? (
          <DataError message={result.error} compact />
        ) : result.data.leads_total === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <UsersIcon className="size-6 text-ink-faint" aria-hidden="true" />
            <p className="text-sm text-ink-dim">
              Nenhum lead neste mês. Cadastre um contato novo no funil.
            </p>
          </div>
        ) : (
          (() => {
            const f = result.data
            const estagios: Estagio[] = [
              { label: "Leads no mês", valor: f.leads_total, taxa: null },
              { label: "Reunião marcada", valor: f.reunioes_marcadas, taxa: f.taxa_lead_para_reuniao },
              { label: "Reunião realizada", valor: f.reunioes_realizadas, taxa: f.taxa_reuniao_para_realizada },
              { label: "Venda", valor: f.vendas, taxa: f.taxa_realizada_para_venda },
            ]
            return (
              <>
                <ul aria-label="Etapas do funil comercial" className="divide-y divide-line-soft">
                  {estagios.map((e, i) => (
                    <LinhaEstagio key={e.label} estagio={e} max={f.leads_total} primeiro={i === 0} />
                  ))}
                </ul>
                <dl className="mt-5 grid grid-cols-3 divide-x divide-line-soft border-t border-line-soft pt-4">
                  <div className="min-w-0 pr-3">
                    <dt className="truncate text-xs text-ink-faint">Convertido</dt>
                    <dd className="mt-1 truncate font-display text-base font-medium text-ink tabular-nums md:text-lg">
                      {formatBRLInteiro(f.valor_convertido)}
                    </dd>
                  </div>
                  <div className="min-w-0 px-3">
                    <dt className="truncate text-xs text-ink-faint">Conversão</dt>
                    <dd className="mt-1 truncate font-display text-base font-medium text-ink tabular-nums md:text-lg">
                      {pct(f.taxa_conversao_geral)}
                    </dd>
                  </div>
                  <div className="min-w-0 pl-3">
                    <dt className="truncate text-xs text-ink-faint">Em negociação</dt>
                    <dd className="mt-1 truncate font-display text-base font-medium text-ink tabular-nums md:text-lg">
                      {formatBRLInteiro(f.valor_em_funil)}
                    </dd>
                  </div>
                </dl>
              </>
            )
          })()
        )}
      </CardContent>
    </Card>
  )
}
