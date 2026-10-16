import type { CSSProperties } from "react"
import Link from "next/link"
import {
  ActivityIcon,
  BotIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  TimerIcon,
  UserPlusIcon,
  type LucideIcon,
} from "lucide-react"
import { cn } from "cn"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { DashboardKpis, DashboardResumo } from "@/lib/types"
import { DataError } from "@/components/data-error"
import { formatInteiro, formatMinutos, formatPct } from "@/lib/format"
import { kpisDoRequest, plural, resumoDoRequest } from "./data"

type ItemAtividade = {
  key: string
  icon: LucideIcon
  /** Cor do ícone: só quando o item pede atenção. */
  tone?: "signal" | "amber" | "danger"
  texto: string
  detalhe: string
  href?: string
}

const toneClass = {
  signal: "text-signal",
  amber: "text-amber",
  danger: "text-danger",
} as const

/**
 * Só o que não aparece em outro bloco: abertos, em campo, PMOC e recebidos
 * já estão nos KPIs, em "Próximas visitas" e em "Situação PMOC".
 */
function itensDeAtividade(
  resumo: DashboardResumo,
  kpis: DashboardKpis | null
): ItemAtividade[] {
  const n = formatInteiro
  const itens: ItemAtividade[] = []
  if (resumo.os_concluidas_mes > 0) {
    itens.push({
      key: "concluidas",
      icon: ClipboardCheckIcon,
      texto: `${n(resumo.os_concluidas_mes)} ${plural(resumo.os_concluidas_mes, "OS concluída", "OS concluídas")} no mês`,
      detalhe: "Liberadas para faturamento",
      href: "/chamados?status=concluido",
    })
  }
  if (resumo.leads_mes > 0) {
    itens.push({
      key: "leads",
      icon: UserPlusIcon,
      texto: `${n(resumo.leads_mes)} ${plural(resumo.leads_mes, "lead novo", "leads novos")} no mês`,
      detalhe: "Entraram no funil comercial",
      href: "/clientes/funil",
    })
  }
  if (kpis && kpis.triagem_ia_pct !== null) {
    itens.push({
      key: "ia",
      icon: BotIcon,
      texto: `IA resolveu ${formatPct(kpis.triagem_ia_pct)} das triagens`,
      detalhe: "Sem precisar passar para um atendente",
      href: "/atendimento",
    })
  }
  if (kpis && kpis.tempo_primeira_resposta_min !== null) {
    itens.push({
      key: "resposta",
      icon: TimerIcon,
      texto: `Primeira resposta em ${formatMinutos(kpis.tempo_primeira_resposta_min)}`,
      detalhe: "Tempo médio no atendimento dos últimos 30 dias",
      href: "/atendimento",
    })
  }
  return itens
}

function Linha({ item }: { item: ItemAtividade }) {
  const Icon = item.icon
  const conteudo = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-console-2">
        <Icon
          className={cn("size-4", item.tone ? toneClass[item.tone] : "text-ink-dim")}
          aria-hidden="true"
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{item.texto}</span>
        <span className="mt-0.5 block truncate text-[0.8125rem] text-ink-faint">
          {item.detalhe}
        </span>
      </span>
      {item.href ? (
        <ChevronRightIcon className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
      ) : null}
    </>
  )
  const base = "flex min-h-14 items-center gap-3 rounded-2xl px-2 py-2.5"
  return item.href ? (
    <Link
      href={item.href}
      className={cn(
        base,
        "outline-none transition-colors duration-200 hover:bg-console-2 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      )}
    >
      {conteudo}
    </Link>
  ) : (
    <div className={base}>{conteudo}</div>
  )
}

/** "Também neste mês": sinais que não aparecem nos outros blocos. */
export async function AtividadeSistema({ className }: { className?: string }) {
  const [result, kpisR] = await Promise.all([resumoDoRequest(), kpisDoRequest()])

  return (
    <Card
      className={cn("console-enter", className)}
      style={{ "--enter-delay": "0.2s" } as CSSProperties}
    >
      <CardHeader>
        <CardTitle>Também neste mês</CardTitle>
        <CardDescription>Execução, comercial e atendimento</CardDescription>
      </CardHeader>
      <CardContent>
        {result.error !== null ? (
          <DataError message={result.error} compact />
        ) : (
          (() => {
            const itens = itensDeAtividade(result.data, kpisR.data)
            if (itens.length === 0) {
              return (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <ActivityIcon className="size-6 text-ink-faint" aria-hidden="true" />
                  <p className="text-sm text-ink-dim">
                    Nada no mês ainda. OS concluídas e leads novos aparecem aqui.
                  </p>
                </div>
              )
            }
            return (
              <ul
                aria-label="Outros números do mês"
                className="-mx-2 divide-y divide-line-soft md:grid md:grid-cols-2 md:gap-x-6 md:divide-y-0"
              >
                {itens.map((item) => (
                  <li key={item.key}>
                    <Linha item={item} />
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
