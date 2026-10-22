import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { cn } from "cn"
import { BookOpenIcon, FileTextIcon, PlusIcon, SearchXIcon } from "lucide-react"

import type { QuoteStatus } from "@/lib/types"
import { formatBRL, formatBRLInteiro, formatInteiro, formatPct, todayBRT } from "@/lib/format"
import { QUOTE_STATUS_META } from "@/lib/status-meta"
import { requireRole } from "@/server/auth"
import { getQuotesSummary, listQuotes } from "@/server/quotes"
import { buttonVariants } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { DataError } from "@/components/data-error"
import { EmptyState } from "@/components/empty-state"
import { TablePagination } from "@/components/table-pagination"
import { FinKpi } from "@/components/financeiro/fin-kpi"
import { QuotesPeriodoPicker } from "@/components/orcamentos/periodo-picker"
import { parsePeriodo, rotuloPeriodo } from "@/components/orcamentos/periodo"
import { QuoteCards, QuotesTable } from "@/components/orcamentos/quote-list"
import { QuotesSearch } from "@/components/orcamentos/quotes-search"
import { QuoteKpisSkeleton, QuotesListSkeleton } from "@/components/orcamentos/skeletons"

export const metadata: Metadata = {
  title: "Orçamentos",
}

const PAGE_SIZE = 10
const STATUSES: QuoteStatus[] = ["aguardando", "aprovado", "declinado"]

type Filters = {
  q: string
  status: QuoteStatus | "todos"
  inicio: string
  fim: string
  /** true = período padrão (mês atual), não vai para a URL. */
  padrao: boolean
  page: number
}

function parseFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : ""
  const status = STATUSES.includes(sp.status as QuoteStatus) ? (sp.status as QuoteStatus) : "todos"
  const { inicio, fim, padrao } = parsePeriodo(sp)
  const parsedPage = Number(typeof sp.pagina === "string" ? sp.pagina : "1")
  const page = Number.isFinite(parsedPage) ? Math.max(1, Math.trunc(parsedPage)) : 1
  return { q, status, inicio, fim, padrao, page }
}

function buildHref(f: Filters): string {
  const params = new URLSearchParams()
  if (f.q) params.set("q", f.q)
  if (f.status !== "todos") params.set("status", f.status)
  if (!f.padrao) {
    params.set("inicio", f.inicio)
    params.set("fim", f.fim)
  }
  if (f.page > 1) params.set("pagina", String(f.page))
  const qs = params.toString()
  return qs ? `/orcamentos?${qs}` : "/orcamentos"
}

export default async function OrcamentosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const me = await requireRole("admin", "atendente", "tecnico")
  const filters = parseFilters(await searchParams)
  const listKey = `${filters.q}|${filters.status}|${filters.inicio}|${filters.fim}|${filters.page}`

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Orçamentos"
        description="Propostas enviadas aos clientes, do envio à aprovação."
        actions={
          <>
            {me.role === "admin" && (
              <Link href="/orcamentos/catalogo" className={buttonVariants({ variant: "secondary" })}>
                <BookOpenIcon aria-hidden="true" />
                Catálogo
              </Link>
            )}
            <Link href="/orcamentos/novo" className={buttonVariants()}>
              <PlusIcon aria-hidden="true" />
              Novo orçamento
            </Link>
          </>
        }
      />

      <div className="flex flex-1 flex-col gap-6 md:gap-8">
        <section aria-labelledby="orc-indicadores" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="orc-indicadores" className="text-sm text-ink-dim">
              Indicadores do período
            </h2>
            <QuotesPeriodoPicker periodo={{ inicio: filters.inicio, fim: filters.fim }} />
          </div>
          <Suspense key={`${filters.inicio}|${filters.fim}`} fallback={<QuoteKpisSkeleton />}>
            <KpisSection inicio={filters.inicio} fim={filters.fim} />
          </Suspense>
        </section>

        <section aria-label="Lista de orçamentos" className="flex flex-1 flex-col gap-4">
          <StatusTabs filters={filters} />
          <QuotesSearch q={filters.q} />
          <Suspense key={listKey} fallback={<QuotesListSkeleton />}>
            <ListSection filters={filters} />
          </Suspense>
        </section>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Indicadores do período
// ---------------------------------------------------------------------------

async function KpisSection({ inicio, fim }: { inicio: string; fim: string }) {
  const result = await getQuotesSummary(inicio, fim)
  if (result.error !== null) {
    return <DataError message={result.error} compact className="min-h-28" />
  }
  const s = result.data
  const convValor = s.valor_emitido > 0 ? (s.valor_aprovado / s.valor_emitido) * 100 : null
  const convQtd = s.qtd_emitidos > 0 ? (s.qtd_aprovados / s.qtd_emitidos) * 100 : null
  const enter = (ms: number) => ({ "--enter-delay": `${ms}ms` }) as React.CSSProperties

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <FinKpi
          label="Orçamentos emitidos"
          value={formatInteiro(s.qtd_emitidos)}
          sub={rotuloPeriodo({ inicio, fim })}
          style={enter(0)}
        />
        <FinKpi
          label="Valor emitido"
          value={formatBRLInteiro(s.valor_emitido)}
          sub="Soma dos totais emitidos"
          style={enter(60)}
        />
        <FinKpi
          className="col-span-2 md:col-span-1"
          label="Valor aprovado"
          value={formatBRLInteiro(s.valor_aprovado)}
          pill={convValor === null ? null : `${formatPct(convValor)} do valor`}
          tone={s.valor_aprovado > 0 ? "clear" : "neutral"}
          sub={
            s.qtd_emitidos > 0
              ? `${s.qtd_aprovados} de ${s.qtd_emitidos} aprovados (${formatPct(convQtd)} em quantidade)`
              : "Nenhum orçamento no período"
          }
          style={enter(120)}
        />
      </div>
      <dl className="grid grid-cols-2 divide-x divide-line-soft rounded-2xl bg-console ring-1 ring-line">
        <div className="flex min-w-0 flex-col gap-0.5 px-4 py-3 md:flex-row md:items-baseline md:justify-between md:gap-3 md:px-5">
          <dt className="flex items-center gap-2 text-[0.8125rem] text-ink-dim">
            <span className="size-1.5 shrink-0 rounded-full bg-amber" aria-hidden="true" />
            Aguardando resposta
          </dt>
          <dd className="text-sm text-ink tabular-nums">
            {s.qtd_aguardando} <span className="text-ink-faint">· {formatBRL(s.valor_aguardando)}</span>
          </dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 px-4 py-3 md:flex-row md:items-baseline md:justify-between md:gap-3 md:px-5">
          <dt className="flex items-center gap-2 text-[0.8125rem] text-ink-dim">
            <span className="size-1.5 shrink-0 rounded-full bg-ink-faint" aria-hidden="true" />
            Declinados
          </dt>
          <dd className="text-sm text-ink tabular-nums">
            {s.qtd_declinados} <span className="text-ink-faint">· {formatBRL(s.valor_declinado)}</span>
          </dd>
        </div>
      </dl>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chips de status (links; o filtro acontece no server component)
// ---------------------------------------------------------------------------

function StatusTabs({ filters }: { filters: Filters }) {
  const tabs: Array<{ label: string; status: Filters["status"] }> = [
    { label: "Todos", status: "todos" },
    { label: QUOTE_STATUS_META.aguardando.label, status: "aguardando" },
    { label: "Aprovados", status: "aprovado" },
    { label: "Declinados", status: "declinado" },
  ]
  return (
    <nav aria-label="Filtrar por status" className="no-scrollbar -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex h-11 w-max min-w-full items-center gap-1 rounded-full bg-console-2 p-1 sm:min-w-0 md:h-10">
        {tabs.map((tab) => {
          const active = filters.status === tab.status
          return (
            <li key={tab.status} className="h-full flex-1">
              <Link
                href={buildHref({ ...filters, status: tab.status, page: 1 })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-full w-full items-center justify-center rounded-full px-3 text-sm font-medium whitespace-nowrap transition-[color,background-color] duration-150 outline-none focus-visible:ring-3 focus-visible:ring-signal/50 sm:px-4",
                  active ? "bg-ink text-void" : "text-ink-dim hover:text-ink",
                )}
              >
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Lista paginada
// ---------------------------------------------------------------------------

async function ListSection({ filters }: { filters: Filters }) {
  const result = await listQuotes({
    q: filters.q || undefined,
    status: filters.status !== "todos" ? filters.status : undefined,
    inicio: filters.inicio,
    fim: filters.fim,
    page: filters.page,
    pageSize: PAGE_SIZE,
  })
  if (result.error !== null) return <DataError message={result.error} />

  const { items, total, page, pageCount } = result.data
  if (total === 0) {
    const hasFilters = filters.q !== "" || filters.status !== "todos"
    if (hasFilters || !filters.padrao) {
      return (
        <EmptyState
          icon={SearchXIcon}
          title="Nenhum orçamento encontrado"
          description="Nada para a busca, o status e o período escolhidos. Ajuste os filtros ou amplie o período."
        >
          <Link href="/orcamentos" className={cn(buttonVariants({ variant: "outline" }), "mt-6")}>
            Limpar filtros
          </Link>
        </EmptyState>
      )
    }
    return (
      <EmptyState
        icon={FileTextIcon}
        title="Nenhum orçamento neste mês"
        description="Monte o primeiro orçamento com itens do catálogo ou itens livres e envie o PDF ao cliente."
      >
        <Link href="/orcamentos/novo" className={cn(buttonVariants(), "mt-6")}>
          <PlusIcon aria-hidden="true" />
          Novo orçamento
        </Link>
      </EmptyState>
    )
  }

  const hoje = todayBRT()
  const from = (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="flex flex-col gap-3">
      <QuoteCards items={items} hoje={hoje} />
      <div className="overflow-hidden rounded-[1.375rem] bg-console ring-1 ring-line max-md:[&>nav]:border-t-0">
        <QuotesTable items={items} hoje={hoje} />
        <TablePagination
          ariaLabel="Paginação de orçamentos"
          from={from}
          to={to}
          total={total}
          page={page}
          pageCount={pageCount}
          singular="orçamento"
          plural="orçamentos"
          prevHref={buildHref({ ...filters, page: page - 1 })}
          nextHref={buildHref({ ...filters, page: page + 1 })}
        />
      </div>
    </div>
  )
}
