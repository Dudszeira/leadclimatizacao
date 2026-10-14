import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { cn } from "cn"
import {
  BarcodeIcon,
  ExternalLinkIcon,
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
import {
  formatBRL,
  formatBRLInteiro,
  formatCompetencia,
  formatCompetenciaLonga,
  formatDateBR,
  formatPct,
} from "@/lib/format"
import {
  CONTRACT_STATUS_META,
  CONTRACT_TYPE_META,
  INVOICE_STATUS_META,
  PAYMENT_METHOD_META,
} from "@/lib/status-meta"
import { competenciaBRT, todayBRT } from "@/lib/asaas/dates"
import { isLock } from "@/lib/asaas/lock"
import { httpsUrl } from "@/lib/safe-url"
import { requireRole } from "@/server/auth"
import {
  getContratosResumo,
  listContractClientOptions,
  listContracts,
} from "@/server/contracts"
import { getFinanceiroKpis, listInvoices } from "@/server/invoices"
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
import { StatCard } from "@/components/dashboard/stat-card"
import { DataError } from "@/components/data-error"
import { EmptyState } from "@/components/empty-state"
import {
  FaturasToolbar,
  type CompetenciaOption,
  type StatusParam,
} from "@/components/financeiro/faturas-toolbar"
import { InvoiceActions } from "@/components/financeiro/invoice-actions"
import { BillingRunActions } from "@/components/financeiro/billing-run-actions"
import { ContractActions } from "@/components/financeiro/contract-actions"
import { ContractFormDialog } from "@/components/financeiro/contract-form-dialog"
import {
  ContratosSkeleton,
  FaturasTableSkeleton,
  FinanceiroKpisSkeleton,
} from "@/components/financeiro/skeletons"
import { TablePagination } from "@/components/table-pagination"

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

/** Últimos N meses de competência em BRT (mais recente primeiro). */
function competenciaOptions(length = 6): CompetenciaOption[] {
  return Array.from({ length }, (_, i) => {
    const value = competenciaBRT(i)
    return { value, label: formatCompetenciaLonga(value) }
  })
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireRole("admin")
  const filters = parseFilters(await searchParams)
  const faturasKey = `${filters.q}|${filters.status}|${filters.competencia}|${filters.page}`

  return (
    <div className="flex flex-1 flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-ink">
            Financeiro &amp; fiscal
          </h2>
          <p className="mt-1 text-sm text-ink-dim">
            Faturas dos contratos, cobranças via Asaas (Pix/boleto) e NFS-e em
            um só painel.
          </p>
        </div>
        <BillingRunActions competencias={competenciaOptions(3)} />
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
        <Suspense key={`contratos|${filters.page}`} fallback={<ContratosSkeleton />}>
          <ContratosSection filters={filters} />
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
    return <DataError message={result.error} compact className="min-h-28" />
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
        <EmptyState
          icon={SearchXIcon}
          title="Nenhuma fatura encontrada"
          description="Nenhum resultado para a busca e os filtros atuais. Ajuste os termos ou limpe os filtros."
        >
          <Link
            href="/financeiro"
            className={cn(buttonVariants({ variant: "outline" }), "mt-6 h-11 px-5")}
          >
            Limpar filtros
          </Link>
        </EmptyState>
      )
    }
    return (
      <EmptyState
        icon={ReceiptTextIcon}
        title="Nenhuma fatura registrada"
        description="As faturas nascem dos contratos ativos: cadastre um contrato na aba Contratos e as competências mensais aparecem aqui."
      >
        <Link
          href={buildHref({ aba: "contratos", q: "", status: "todos", competencia: "", page: 1 })}
          className={cn(buttonVariants({ variant: "outline" }), "mt-6 h-11 px-5")}
        >
          Ver contratos
        </Link>
      </EmptyState>
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
            const nfUrl = httpsUrl(fatura.nf_url)
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
                  {isLock(fatura.asaas_id) ? (
                    <span className="text-ink-faint">Gerando…</span>
                  ) : fatura.metodo ? (
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
                  {fatura.nf_numero ??
                    (fatura.asaas_invoice_id ? (
                      <span className="font-sans text-ink-faint">Em emissão</span>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    ))}
                  {nfUrl ? (
                    <a
                      href={nfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 flex w-fit items-center gap-1 font-sans text-xs text-primary underline-offset-4 hover:underline"
                    >
                      Ver NFS-e
                      <ExternalLinkIcon className="size-3" aria-hidden="true" />
                      <span className="sr-only">(abre em nova aba)</span>
                    </a>
                  ) : null}
                </TableCell>
                <TableCell className="px-4 py-3 text-right">
                  <InvoiceActions
                    invoiceId={fatura.id}
                    status={fatura.status}
                    clienteNome={clienteNome}
                    asaasId={fatura.asaas_id}
                    asaasUrl={fatura.asaas_url}
                    asaasInvoiceId={fatura.asaas_invoice_id ?? null}
                    nfNumero={fatura.nf_numero}
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <TablePagination
        ariaLabel="Paginação de faturas"
        from={from}
        to={to}
        total={total}
        page={page}
        pageCount={pageCount}
        singular="fatura"
        plural="faturas"
        prevHref={buildHref({ ...filters, page: page - 1 })}
        nextHref={buildHref({ ...filters, page: page + 1 })}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Aba Contratos: resumo (ativos, MRR) + tabela
// ---------------------------------------------------------------------------

const CONTRATOS_PAGE_SIZE = 20

async function ContratosSection({ filters }: { filters: Filters }) {
  const [listResult, resumoResult, clientsResult] = await Promise.all([
    listContracts({ page: filters.page, pageSize: CONTRATOS_PAGE_SIZE }),
    getContratosResumo(),
    listContractClientOptions(),
  ])

  if (listResult.error !== null) {
    return <DataError message={listResult.error} />
  }
  const clients = clientsResult.data ?? []
  const hoje = todayBRT()
  const novoContrato = <ContractFormDialog clients={clients} hoje={hoje} />

  const { items: contratos, total, page, pageCount } = listResult.data
  if (total === 0) {
    return (
      <EmptyState
        icon={RepeatIcon}
        title="Nenhum contrato cadastrado"
        description="Cadastre os contratos PMOC recorrentes, corretivas avulsas e instalações para gerar as faturas mensais automaticamente."
      >
        <div className="mt-6">{novoContrato}</div>
      </EmptyState>
    )
  }

  const from = (page - 1) * CONTRATOS_PAGE_SIZE + 1
  const to = Math.min(page * CONTRATOS_PAGE_SIZE, total)

  return (
    <div className="flex flex-col gap-4">
      {resumoResult.error !== null ? (
        <DataError message={resumoResult.error} compact className="min-h-28" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard
            label="Contratos ativos"
            value={String(resumoResult.data.ativos)}
            icon={RepeatIcon}
            sub={`${resumoResult.data.total} contratos no total`}
            tone="neutral"
          />
          <StatCard
            label="MRR — receita recorrente"
            value={formatBRLInteiro(resumoResult.data.mrr)}
            icon={TrendingUpIcon}
            sub="Soma dos PMOC recorrentes ativos"
            tone="clear"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-dim">
          Contratos ativos geram as faturas mensais (dia 1, 06:00) — encerre
          para parar a cobrança.
        </p>
        {novoContrato}
      </div>
      {clientsResult.error !== null ? (
        <p role="status" className="text-xs text-danger">
          {clientsResult.error}
        </p>
      ) : null}

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
              <TableHead className="text-xs font-medium tracking-wider text-ink-faint uppercase">
                Vigência
              </TableHead>
              <TableHead className="px-4 text-right text-xs font-medium tracking-wider text-ink-faint uppercase">
                <span className="sr-only">Ações</span>
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
                  <TableCell className="py-3 font-mono text-ink-dim tabular-nums">
                    {formatDateBR(contrato.inicio)}
                    {contrato.fim ? ` → ${formatDateBR(contrato.fim)}` : ""}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <ContractActions
                      contract={contrato}
                      clienteNome={clienteNome}
                      clients={clients}
                      hoje={hoje}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <TablePagination
          ariaLabel="Paginação de contratos"
          from={from}
          to={to}
          total={total}
          page={page}
          pageCount={pageCount}
          singular="contrato"
          plural="contratos"
          prevHref={buildHref({ ...filters, page: page - 1 })}
          nextHref={buildHref({ ...filters, page: page + 1 })}
        />
      </div>
    </div>
  )
}
