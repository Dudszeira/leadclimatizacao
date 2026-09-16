import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { cn } from "cn"
import {
  BarcodeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileTextIcon,
  FileWarningIcon,
  QrCodeIcon,
  ReceiptTextIcon,
  RepeatIcon,
  SearchXIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react"

import type { InvoiceStatus } from "@/lib/types"
import { listContracts } from "@/server/contracts"
import { getFinanceiroKpis, listInvoices } from "@/server/invoices"
import { monthStartDate } from "@/server/_shared"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { BlockError } from "@/components/dashboard/block-error"
import { StatCard } from "@/components/dashboard/stat-card"
import { DataError } from "@/components/clientes/data-error"
import {
  FaturasToolbar,
  type CompetenciaOption,
  type StatusParam,
} from "@/components/financeiro/faturas-toolbar"
import {
  CONTRACT_STATUS_META,
  CONTRACT_TYPE_META,
  formatBRL,
  formatBRLInteiro,
  formatCompetencia,
  formatCompetenciaLonga,
  formatDateBR,
  formatPct,
  INVOICE_STATUS_META,
  PAYMENT_METHOD_META,
} from "@/components/financeiro/format"
import { InvoiceActions } from "@/components/financeiro/invoice-actions"
import {
  ContratosSkeleton,
  FaturasTableSkeleton,
  FinanceiroKpisSkeleton,
} from "@/components/financeiro/skeletons"

export const metadata: Metadata = {
  title: "Financeiro",
}

const PAGE_SIZE = 10

const INVOICE_STATUSES: InvoiceStatus[] = [
  "pendente",
  "pago",
  "atrasado",
  "cancelado",
]

type Aba = "faturas" | "contratos"

type Filters = {
  aba: Aba
  q: string
  status: StatusParam
  /** "" = todas; senão "YYYY-MM-01". */
  competencia: string
  page: number
}

function parseFilters(
  sp: Record<string, string | string[] | undefined>,
): Filters {
  const aba: Aba = sp.aba === "contratos" ? "contratos" : "faturas"
  const q = typeof sp.q === "string" ? sp.q : ""
  const status = INVOICE_STATUSES.includes(sp.status as InvoiceStatus)
    ? (sp.status as InvoiceStatus)
    : "todos"
  const competencia =
    typeof sp.competencia === "string" && /^\d{4}-\d{2}-01$/.test(sp.competencia)
      ? sp.competencia
      : ""
  const parsedPage = Number(typeof sp.pagina === "string" ? sp.pagina : "1")
  const page = Number.isFinite(parsedPage)
    ? Math.max(1, Math.trunc(parsedPage))
    : 1
  return { aba, q, status, competencia, page }
}

function buildHref({ aba, q, status, competencia, page }: Filters): string {
  const params = new URLSearchParams()
  if (aba !== "faturas") params.set("aba", aba)
  if (q) params.set("q", q)
  if (status !== "todos") params.set("status", status)
  if (competencia) params.set("competencia", competencia)
  if (page > 1) params.set("pagina", String(page))
  const qs = params.toString()
  return qs ? `/financeiro?${qs}` : "/financeiro"
}

/** Últimos 6 meses de competência para o filtro (mais recente primeiro). */
function competenciaOptions(): CompetenciaOption[] {
  return Array.from({ length: 6 }, (_, i) => {
    const value = monthStartDate(i)
    return { value, label: formatCompetenciaLonga(value) }
  })
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const filters = parseFilters(await searchParams)
  const faturasKey = `${filters.q}|${filters.status}|${filters.competencia}|${filters.page}`

  return (
    <div className="flex flex-1 flex-col gap-4">
      <header>
        <h2 className="font-display text-lg font-bold tracking-tight text-ink">
          Financeiro &amp; fiscal
        </h2>
        <p className="mt-1 text-sm text-ink-dim">
          Faturas dos contratos, cobranças via Asaas (Pix/boleto) e NFS-e em um
          só painel.
        </p>
      </header>

      <Suspense fallback={<FinanceiroKpisSkeleton />}>
        <KpisSection />
      </Suspense>

      <AbaTabs filters={filters} />

      {filters.aba === "faturas" ? (
        <>
          <FaturasToolbar
            q={filters.q}
            status={filters.status}
            competencia={filters.competencia}
            competencias={competenciaOptions()}
          />
          <Suspense key={faturasKey} fallback={<FaturasTableSkeleton />}>
            <FaturasSection filters={filters} />
          </Suspense>
        </>
      ) : (
        <Suspense fallback={<ContratosSkeleton />}>
          <ContratosSection />
        </Suspense>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// KPIs do topo
// ---------------------------------------------------------------------------

async function KpisSection() {
  const result = await getFinanceiroKpis()
  if (result.error !== null) {
    return <BlockError message={result.error} className="min-h-28" />
  }
  const kpis = result.data
  const recebidoConciliado = kpis.recebido_pix_mes + kpis.recebido_boleto_mes

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Faturamento previsto no mês"
        value={formatBRLInteiro(kpis.faturamento_previsto_mes)}
        icon={WalletIcon}
        sub={`${formatBRLInteiro(recebidoConciliado)} já recebidos`}
        tone={recebidoConciliado > 0 ? "clear" : "neutral"}
        style={{ "--enter-delay": "0ms" } as React.CSSProperties}
      />
      <StatCard
        label="Inadimplência"
        value={formatPct(kpis.inadimplencia_pct)}
        icon={FileWarningIcon}
        sub={
          kpis.valor_em_atraso > 0
            ? `${formatBRLInteiro(kpis.valor_em_atraso)} em atraso`
            : "Nenhuma fatura em atraso"
        }
        tone={kpis.valor_em_atraso > 0 ? "danger" : "clear"}
        style={{ "--enter-delay": "60ms" } as React.CSSProperties}
      />
      <StatCard
        label="Notas fiscais no mês"
        value={String(kpis.notas_emitidas_mes)}
        icon={FileTextIcon}
        sub="NFS-e emitidas na competência"
        tone="signal"
        style={{ "--enter-delay": "120ms" } as React.CSSProperties}
      />
      <StatCard
        label="Recebido via Pix/boleto"
        value={formatPct(kpis.recebido_conciliado_pct)}
        icon={QrCodeIcon}
        sub={`Pix ${formatBRLInteiro(kpis.recebido_pix_mes)} · boleto ${formatBRLInteiro(kpis.recebido_boleto_mes)}`}
        tone="signal"
        style={{ "--enter-delay": "180ms" } as React.CSSProperties}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tabs Faturas · Contratos (links por URL, padrão QuickTabs de /chamados)
// ---------------------------------------------------------------------------

function AbaTabs({ filters }: { filters: Filters }) {
  const tabs: Array<{ label: string; aba: Aba }> = [
    { label: "Faturas", aba: "faturas" },
    { label: "Contratos", aba: "contratos" },
  ]
  return (
    <nav aria-label="Seções do financeiro">
      <ul className="flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-line bg-console p-1">
        {tabs.map((tab) => {
          const active = filters.aba === tab.aba
          return (
            <li key={tab.aba}>
              <Link
                href={buildHref({
                  aba: tab.aba,
                  q: "",
                  status: "todos",
                  competencia: "",
                  page: 1,
                })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-8 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors max-md:min-h-10",
                  active
                    ? "bg-signal-dim text-signal"
                    : "text-ink-dim hover:bg-console-2 hover:text-ink",
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
// Aba Faturas: tabela paginada com filtros por URL (4 estados)
// ---------------------------------------------------------------------------

async function FaturasSection({ filters }: { filters: Filters }) {
  const result = await listInvoices({
    search: filters.q || undefined,
    status: filters.status !== "todos" ? filters.status : undefined,
    competencia: filters.competencia || undefined,
    page: filters.page,
    pageSize: PAGE_SIZE,
  })

  if (result.error !== null) {
    return <DataError message={result.error} />
  }

  const { items, total, page, pageCount } = result.data
  const hasFilters =
    filters.q !== "" || filters.status !== "todos" || filters.competencia !== ""

  if (total === 0) {
    if (hasFilters) {
      return (
        <section className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-console/50 px-6 py-16 text-center">
          <div
            className="flex size-14 items-center justify-center rounded-2xl border border-line-soft bg-console-2"
            aria-hidden="true"
          >
            <SearchXIcon className="size-7 text-ink-faint" />
          </div>
          <h3 className="mt-5 font-display text-lg font-bold tracking-tight text-ink">
            Nenhuma fatura encontrada
          </h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-dim">
            Nenhum resultado para a busca e os filtros atuais. Ajuste os termos
            ou limpe os filtros.
          </p>
          <Link
            href="/financeiro"
            className={cn(buttonVariants({ variant: "outline" }), "mt-6 h-11 px-5")}
          >
            Limpar filtros
          </Link>
        </section>
      )
    }
    return (
      <section className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-console/50 px-6 py-16 text-center">
        <div
          className="flex size-14 items-center justify-center rounded-2xl border border-line-soft bg-console-2"
          aria-hidden="true"
        >
          <ReceiptTextIcon className="size-7 text-ink-faint" />
        </div>
        <h3 className="mt-5 font-display text-lg font-bold tracking-tight text-ink">
          Nenhuma fatura registrada
        </h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-dim">
          As faturas nascem dos contratos ativos: cadastre um contrato na aba
          Contratos e as competências mensais aparecem aqui.
        </p>
        <Link
          href={buildHref({ aba: "contratos", q: "", status: "todos", competencia: "", page: 1 })}
          className={cn(buttonVariants({ variant: "outline" }), "mt-6 h-11 px-5")}
        >
          Ver contratos
        </Link>
      </section>
    )
  }

  const from = (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-console">
      <Table aria-label="Faturas dos contratos">
        <TableHeader>
          <TableRow className="border-line-soft hover:bg-transparent">
            <TableHead className="px-4 text-xs font-medium tracking-wider text-ink-faint uppercase">
              Cliente / plano
            </TableHead>
            <TableHead className="text-xs font-medium tracking-wider text-ink-faint uppercase">
              Competência
            </TableHead>
            <TableHead className="text-right text-xs font-medium tracking-wider text-ink-faint uppercase">
              Valor
            </TableHead>
            <TableHead className="text-xs font-medium tracking-wider text-ink-faint uppercase">
              Vencimento
            </TableHead>
            <TableHead className="text-xs font-medium tracking-wider text-ink-faint uppercase">
              Status
            </TableHead>
            <TableHead className="text-xs font-medium tracking-wider text-ink-faint uppercase">
              Cobrança
            </TableHead>
            <TableHead className="text-xs font-medium tracking-wider text-ink-faint uppercase">
              Nota fiscal
            </TableHead>
            <TableHead className="px-4 text-right text-xs font-medium tracking-wider text-ink-faint uppercase">
              <span className="sr-only">Ações</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((fatura) => {
            const statusMeta = INVOICE_STATUS_META[fatura.status]
            const tipoMeta = CONTRACT_TYPE_META[fatura.contract.tipo]
            const clienteNome =
              fatura.contract.client.nome_fantasia ??
              fatura.contract.client.razao_social
            const MetodoIcon = fatura.metodo === "pix" ? QrCodeIcon : BarcodeIcon
            const atrasada = fatura.status === "atrasado"
            return (
              <TableRow
                key={fatura.id}
                className={cn(
                  "border-line-soft",
                  atrasada
                    ? "bg-danger-dim/60 hover:bg-danger-dim"
                    : "hover:bg-console-2/60",
                )}
              >
                <TableCell className="max-w-56 px-4 py-3">
                  <span className="block truncate font-medium text-ink">
                    {clienteNome}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-faint">
                    {tipoMeta.label}
                  </span>
                </TableCell>
                <TableCell className="py-3 font-mono text-ink-dim tabular-nums">
                  {formatCompetencia(fatura.competencia)}
                </TableCell>
                <TableCell className="py-3 text-right font-mono font-medium text-ink tabular-nums">
                  {formatBRL(fatura.valor)}
                </TableCell>
                <TableCell className="py-3 font-mono text-ink-dim tabular-nums">
                  {formatDateBR(fatura.vencimento)}
                </TableCell>
                <TableCell className="py-3">
                  <Badge
                    variant="outline"
                    className={cn("font-medium", statusMeta.badgeClassName)}
                  >
                    {statusMeta.label}
                  </Badge>
                </TableCell>
                <TableCell className="py-3">
                  {fatura.metodo ? (
                    <span className="flex items-center gap-1.5 text-ink-dim">
                      <MetodoIcon
                        className="size-3.5 shrink-0 text-ink-faint"
                        aria-hidden="true"
                      />
                      {PAYMENT_METHOD_META[fatura.metodo].label}
                    </span>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                </TableCell>
                <TableCell className="py-3 font-mono text-ink-dim tabular-nums">
                  {fatura.nf_numero ?? <span className="text-ink-faint">—</span>}
                </TableCell>
                <TableCell className="px-4 py-3 text-right">
                  <InvoiceActions
                    invoiceId={fatura.id}
                    status={fatura.status}
                    clienteNome={clienteNome}
                    asaasId={fatura.asaas_id}
                    asaasUrl={fatura.asaas_url}
                    nfNumero={fatura.nf_numero}
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <nav
        aria-label="Paginação de faturas"
        className="flex items-center justify-between gap-3 border-t border-line-soft px-4 py-3"
      >
        <p className="text-xs text-ink-dim">
          Mostrando{" "}
          <span className="font-mono text-ink tabular-nums">
            {from}–{to}
          </span>{" "}
          de <span className="font-mono text-ink tabular-nums">{total}</span>{" "}
          {total === 1 ? "fatura" : "faturas"}
        </p>
        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-xs text-ink-faint tabular-nums sm:block">
            Página {page} de {pageCount}
          </span>
          <PaginationLink
            href={buildHref({ ...filters, page: page - 1 })}
            disabled={page <= 1}
            label="Página anterior"
          >
            <ChevronLeftIcon aria-hidden="true" />
          </PaginationLink>
          <PaginationLink
            href={buildHref({ ...filters, page: page + 1 })}
            disabled={page >= pageCount}
            label="Próxima página"
          >
            <ChevronRightIcon aria-hidden="true" />
          </PaginationLink>
        </div>
      </nav>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Aba Contratos: resumo (ativos, MRR) + tabela
// ---------------------------------------------------------------------------

async function ContratosSection() {
  const result = await listContracts({ pageSize: 100 })

  if (result.error !== null) {
    return <DataError message={result.error} />
  }

  const contratos = result.data.items
  if (contratos.length === 0) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-console/50 px-6 py-16 text-center">
        <div
          className="flex size-14 items-center justify-center rounded-2xl border border-line-soft bg-console-2"
          aria-hidden="true"
        >
          <RepeatIcon className="size-7 text-ink-faint" />
        </div>
        <h3 className="mt-5 font-display text-lg font-bold tracking-tight text-ink">
          Nenhum contrato cadastrado
        </h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-dim">
          Cadastre os contratos PMOC recorrentes, corretivas avulsas e
          instalações para gerar as faturas mensais automaticamente.
        </p>
      </section>
    )
  }

  const ativos = contratos.filter((c) => c.status === "ativo")
  const mrr = ativos
    .filter((c) => c.tipo === "pmoc_recorrente")
    .reduce((sum, c) => sum + c.valor_mensal, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard
          label="Contratos ativos"
          value={String(ativos.length)}
          icon={RepeatIcon}
          sub={`${contratos.length} contratos no total`}
          tone="neutral"
        />
        <StatCard
          label="MRR — receita recorrente"
          value={formatBRLInteiro(mrr)}
          icon={TrendingUpIcon}
          sub="Soma dos PMOC recorrentes ativos"
          tone="clear"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-console">
        <Table aria-label="Contratos por cliente">
          <TableHeader>
            <TableRow className="border-line-soft hover:bg-transparent">
              <TableHead className="px-4 text-xs font-medium tracking-wider text-ink-faint uppercase">
                Cliente
              </TableHead>
              <TableHead className="text-xs font-medium tracking-wider text-ink-faint uppercase">
                Tipo
              </TableHead>
              <TableHead className="text-right text-xs font-medium tracking-wider text-ink-faint uppercase">
                Valor mensal
              </TableHead>
              <TableHead className="text-xs font-medium tracking-wider text-ink-faint uppercase">
                Vencimento
              </TableHead>
              <TableHead className="text-xs font-medium tracking-wider text-ink-faint uppercase">
                Status
              </TableHead>
              <TableHead className="px-4 text-xs font-medium tracking-wider text-ink-faint uppercase">
                Desde
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contratos.map((contrato) => {
              const tipoMeta = CONTRACT_TYPE_META[contrato.tipo]
              const statusMeta = CONTRACT_STATUS_META[contrato.status]
              const clienteNome =
                contrato.client.nome_fantasia ?? contrato.client.razao_social
              return (
                <TableRow
                  key={contrato.id}
                  className="border-line-soft hover:bg-console-2/60"
                >
                  <TableCell className="max-w-56 px-4 py-3">
                    <span className="block truncate font-medium text-ink">
                      {clienteNome}
                    </span>
                    {contrato.client.cnpj ? (
                      <span className="mt-0.5 block truncate font-mono text-xs text-ink-faint tabular-nums">
                        {contrato.client.cnpj}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge
                      variant="outline"
                      className={cn("font-medium", tipoMeta.badgeClassName)}
                    >
                      {tipoMeta.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 text-right font-mono font-medium text-ink tabular-nums">
                    {formatBRL(contrato.valor_mensal)}
                  </TableCell>
                  <TableCell className="py-3 font-mono text-ink-dim tabular-nums">
                    dia {contrato.dia_vencimento}
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge
                      variant="outline"
                      className={cn("font-medium", statusMeta.badgeClassName)}
                    >
                      {statusMeta.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 font-mono text-ink-dim tabular-nums">
                    {formatDateBR(contrato.inicio)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function PaginationLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string
  disabled: boolean
  label: string
  children: React.ReactNode
}) {
  const className = cn(
    buttonVariants({ variant: "outline", size: "icon" }),
    "size-9 max-md:size-11",
    disabled && "pointer-events-none opacity-50",
  )
  if (disabled) {
    return (
      <span className={className} aria-disabled="true" aria-label={label}>
        {children}
      </span>
    )
  }
  return (
    <Link href={href} className={className} aria-label={label}>
      {children}
    </Link>
  )
}
