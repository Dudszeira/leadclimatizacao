import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { cn } from "cn"
import {
  BarcodeIcon,
  ExternalLinkIcon,
  PlugZapIcon,
  QrCodeIcon,
  ReceiptTextIcon,
  RepeatIcon,
  SearchXIcon,
} from "lucide-react"

import type { ContractStatus, InvoiceStatus } from "@/lib/types"
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
import { isAsaasConfigured } from "@/lib/asaas/client"
import { httpsUrl } from "@/lib/safe-url"
import { requireRole } from "@/server/auth"
import {
  getContratosResumo,
  listContractClientOptions,
  listContracts,
} from "@/server/contracts"
import { getFinanceiroKpis, listInvoices } from "@/server/invoices"
import { buttonVariants } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/page-header"
import { FinKpi } from "@/components/financeiro/fin-kpi"
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
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Financeiro"
        description="Faturas dos contratos, cobranças por Pix e boleto e notas fiscais."
        actions={<BillingRunActions competencias={competenciaOptions(3)} />}
      />

      <div className="flex flex-1 flex-col gap-6 md:gap-8">
        <Suspense fallback={<FinanceiroKpisSkeleton />}>
          <KpisSection />
        </Suspense>

        {isAsaasConfigured() ? null : <AsaasPendente />}

        <div className="flex flex-col gap-5">
          <AbaTabs filters={filters} />

          {filters.aba === "faturas" ? (
            <div className="flex flex-col gap-4">
              <FaturasToolbar
                q={filters.q}
                status={filters.status}
                competencia={filters.competencia}
                competencias={competenciaOptions()}
              />
              <Suspense key={faturasKey} fallback={<FaturasTableSkeleton />}>
                <FaturasSection filters={filters} />
              </Suspense>
            </div>
          ) : (
            <Suspense key={`contratos|${filters.page}`} fallback={<ContratosSkeleton />}>
              <ContratosSection filters={filters} />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Aviso calmo quando a conta Asaas ainda não foi conectada (não é erro)
// ---------------------------------------------------------------------------

function AsaasPendente() {
  return (
    <section
      aria-labelledby="asaas-pendente-titulo"
      className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 rounded-[1.375rem] bg-console p-4 ring-1 ring-line md:gap-x-4 md:gap-y-1 md:p-5"
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-console-2 md:row-span-2 md:size-10 md:self-start"
        aria-hidden="true"
      >
        <PlugZapIcon className="size-4 text-ink-dim md:size-[1.125rem]" />
      </span>
      <h2
        id="asaas-pendente-titulo"
        className="font-heading text-[0.9375rem] leading-snug font-medium tracking-[-0.01em] text-ink md:text-[1.0625rem]"
      >
        Cobrança automática ainda não conectada
      </h2>
      <p className="col-span-2 max-w-[72ch] text-[0.8125rem] leading-relaxed text-ink-dim md:col-span-1 md:col-start-2 md:text-sm">
        As faturas continuam sendo geradas todo mês e você pode marcar
        pagamentos à mão. Para enviar Pix, boleto e nota fiscal
        automaticamente, crie a conta da Lead no Asaas e peça a quem cuida do
        sistema para conectá-la.
      </p>
    </section>
  )
}

// ---------------------------------------------------------------------------
// KPIs do topo: 2x2 no celular, 4 colunas no desktop
// ---------------------------------------------------------------------------

async function KpisSection() {
  const result = await getFinanceiroKpis()
  if (result.error !== null) {
    return <DataError message={result.error} compact className="min-h-28" />
  }
  const kpis = result.data
  const recebido = kpis.recebido_pix_mes + kpis.recebido_boleto_mes
  const recebidoPct =
    kpis.recebido_conciliado_pct === null ? null : formatPct(kpis.recebido_conciliado_pct)
  const emAtraso = kpis.valor_em_atraso > 0
  const enter = (ms: number) => ({ "--enter-delay": `${ms}ms` }) as React.CSSProperties

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <FinKpi
        label="Previsto no mês"
        value={formatBRLInteiro(kpis.faturamento_previsto_mes)}
        sub="Faturas do mês, sem as canceladas"
        style={enter(0)}
      />
      <FinKpi
        label="Recebido no mês"
        value={formatBRLInteiro(recebido)}
        pill={recebidoPct}
        tone={recebido > 0 ? "clear" : "neutral"}
        sub={`Pix ${formatBRLInteiro(kpis.recebido_pix_mes)}, boleto ${formatBRLInteiro(kpis.recebido_boleto_mes)}`}
        style={enter(60)}
      />
      <FinKpi
        label="Em atraso"
        value={formatBRLInteiro(kpis.valor_em_atraso)}
        pill={
          emAtraso
            ? kpis.inadimplencia_pct === null
              ? "Atrasado"
              : formatPct(kpis.inadimplencia_pct)
            : "Em dia"
        }
        tone={emAtraso ? "danger" : "clear"}
        sub={emAtraso ? "Inadimplência dos últimos 7 meses" : "Nenhuma fatura atrasada"}
        style={enter(120)}
      />
      <FinKpi
        label="Notas fiscais emitidas"
        value={String(kpis.notas_emitidas_mes)}
        sub="NFS-e da competência atual"
        style={enter(180)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Seções Faturas · Contratos: abas sublinhadas (links por URL)
// ---------------------------------------------------------------------------

function AbaTabs({ filters }: { filters: Filters }) {
  const tabs: Array<{ label: string; aba: Aba }> = [
    { label: "Faturas", aba: "faturas" },
    { label: "Contratos", aba: "contratos" },
  ]
  return (
    <nav aria-label="Seções do financeiro">
      <ul className="flex h-11 items-stretch gap-6 border-b border-line-soft">
        {tabs.map((tab) => {
          const active = filters.aba === tab.aba
          return (
            <li key={tab.aba} className="flex">
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
                  "relative inline-flex items-center px-0.5 text-[0.9375rem] font-medium whitespace-nowrap transition-colors duration-150 outline-none focus-visible:text-ink focus-visible:ring-3 focus-visible:ring-signal/50",
                  "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-ink after:transition-opacity",
                  active ? "text-ink after:opacity-100" : "text-ink-dim after:opacity-0 hover:text-ink",
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
// Pílulas de status
// ---------------------------------------------------------------------------

function StatusPill({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center rounded-full border px-2.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      {label}
    </span>
  )
}

const CONTRACT_PILL: Record<ContractStatus, string> = {
  ativo: CONTRACT_STATUS_META.ativo.badgeClassName,
  suspenso: CONTRACT_STATUS_META.suspenso.badgeClassName,
  encerrado: "border-transparent bg-console-2 text-ink-faint",
}

// ---------------------------------------------------------------------------
// Aba Faturas: tabela no desktop, linhas no celular (4 estados)
// ---------------------------------------------------------------------------

const LIST_FRAME = "overflow-hidden rounded-[1.375rem] bg-console ring-1 ring-line"

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
          description="Nada bate com a busca e os filtros atuais. Ajuste os termos ou limpe os filtros."
        >
          <Link href="/financeiro" className={cn(buttonVariants({ variant: "outline" }), "mt-6")}>
            Limpar filtros
          </Link>
        </EmptyState>
      )
    }
    return (
      <EmptyState
        icon={ReceiptTextIcon}
        title="Nenhuma fatura ainda"
        description="As faturas nascem dos contratos ativos. Cadastre um contrato e as cobranças mensais aparecem aqui."
      >
        <Link
          href={buildHref({ aba: "contratos", q: "", status: "todos", competencia: "", page: 1 })}
          className={cn(buttonVariants({ variant: "outline" }), "mt-6")}
        >
          Ver contratos
        </Link>
      </EmptyState>
    )
  }

  const from = (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  const linhas = items.map((fatura) => {
    const clienteNome =
      fatura.contract.client.nome_fantasia ?? fatura.contract.client.razao_social
    return {
      fatura,
      clienteNome,
      statusMeta: INVOICE_STATUS_META[fatura.status],
      tipoLabel: CONTRACT_TYPE_META[fatura.contract.tipo].label,
      nfUrl: httpsUrl(fatura.nf_url),
      actions: (
        <InvoiceActions
          invoiceId={fatura.id}
          status={fatura.status}
          clienteNome={clienteNome}
          asaasId={fatura.asaas_id}
          asaasUrl={fatura.asaas_url}
          asaasInvoiceId={fatura.asaas_invoice_id ?? null}
          nfNumero={fatura.nf_numero}
        />
      ),
    }
  })

  return (
    <div className={LIST_FRAME}>
      {/* Celular: linhas com cliente à esquerda e valor + status à direita. */}
      <ul aria-label="Faturas" className="divide-y divide-line-soft md:hidden">
        {linhas.map(({ fatura, clienteNome, statusMeta, actions }) => (
          <li key={fatura.id} className="flex items-center gap-2 py-3 pr-1.5 pl-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.9375rem] font-medium text-ink">{clienteNome}</p>
              <p className="mt-0.5 truncate text-[0.8125rem] text-ink-faint tabular-nums">
                Vence {formatDateBR(fatura.vencimento)}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="font-display text-base leading-none font-medium tracking-[-0.01em] text-ink tabular-nums">
                {formatBRL(fatura.valor)}
              </span>
              <StatusPill label={statusMeta.label} className={statusMeta.badgeClassName} />
            </div>
            {actions}
          </li>
        ))}
      </ul>

      <Table aria-label="Faturas dos contratos" className="max-md:hidden">
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Competência</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead className="max-lg:hidden">Cobrança</TableHead>
            <TableHead className="max-lg:hidden">Nota fiscal</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="w-14">
              <span className="sr-only">Ações</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhas.map(({ fatura, clienteNome, statusMeta, tipoLabel, nfUrl, actions }) => {
            const MetodoIcon = fatura.metodo === "pix" ? QrCodeIcon : BarcodeIcon
            return (
              <TableRow key={fatura.id}>
                <TableCell className="max-w-64">
                  <span className="block truncate font-medium text-ink">{clienteNome}</span>
                  <span className="mt-0.5 block truncate text-[0.8125rem] text-ink-faint">
                    {tipoLabel}
                  </span>
                </TableCell>
                <TableCell className="text-ink-dim tabular-nums">
                  {formatCompetencia(fatura.competencia)}
                </TableCell>
                <TableCell className="text-ink-dim tabular-nums">
                  {formatDateBR(fatura.vencimento)}
                </TableCell>
                <TableCell className="max-lg:hidden">
                  {isLock(fatura.asaas_id) ? (
                    <span className="text-ink-faint">Gerando…</span>
                  ) : fatura.metodo ? (
                    <span className="flex items-center gap-1.5 text-ink-dim">
                      <MetodoIcon className="size-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
                      {PAYMENT_METHOD_META[fatura.metodo].label}
                    </span>
                  ) : (
                    <span className="text-ink-faint">Não gerada</span>
                  )}
                </TableCell>
                <TableCell className="text-ink-dim tabular-nums max-lg:hidden">
                  {fatura.nf_numero ??
                    (fatura.asaas_invoice_id ? (
                      <span className="text-ink-faint">Em emissão</span>
                    ) : (
                      <span className="text-ink-faint">Não emitida</span>
                    ))}
                  {nfUrl ? (
                    <a
                      href={nfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 flex w-fit items-center gap-1 text-[0.8125rem] text-signal underline-offset-4 hover:underline"
                    >
                      Ver NFS-e
                      <ExternalLinkIcon className="size-3" aria-hidden="true" />
                      <span className="sr-only">(abre em nova aba)</span>
                    </a>
                  ) : null}
                </TableCell>
                <TableCell>
                  <StatusPill label={statusMeta.label} className={statusMeta.badgeClassName} />
                </TableCell>
                <TableCell className="text-right font-display text-[0.9375rem] font-medium text-ink tabular-nums">
                  {formatBRL(fatura.valor)}
                </TableCell>
                <TableCell className="pr-3 text-right">{actions}</TableCell>
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
// Aba Contratos: resumo (ativos, receita recorrente) + lista
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

  const { items: contratos, total, page, pageCount } = listResult.data
  if (total === 0) {
    return (
      <EmptyState
        icon={RepeatIcon}
        title="Nenhum contrato cadastrado"
        description="Cadastre os contratos PMOC recorrentes, as corretivas avulsas e as instalações para gerar as faturas mensais sozinhas."
      >
        <div className="mt-6">
          <ContractFormDialog clients={clients} hoje={hoje} />
        </div>
      </EmptyState>
    )
  }

  const from = (page - 1) * CONTRATOS_PAGE_SIZE + 1
  const to = Math.min(page * CONTRATOS_PAGE_SIZE, total)

  const linhas = contratos.map((contrato) => {
    const clienteNome = contrato.client.nome_fantasia ?? contrato.client.razao_social
    return {
      contrato,
      clienteNome,
      tipoLabel: CONTRACT_TYPE_META[contrato.tipo].label,
      statusLabel: CONTRACT_STATUS_META[contrato.status].label,
      statusClass: CONTRACT_PILL[contrato.status],
      actions: (
        <ContractActions
          contract={contrato}
          clienteNome={clienteNome}
          clients={clients}
          hoje={hoje}
        />
      ),
    }
  })

  return (
    <div className="flex flex-col gap-5">
      {resumoResult.error !== null ? (
        <DataError message={resumoResult.error} compact className="min-h-28" />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:max-w-2xl">
          <FinKpi
            label="Contratos ativos"
            value={String(resumoResult.data.ativos)}
            sub={`De ${resumoResult.data.total} no total`}
          />
          <FinKpi
            label="Receita recorrente"
            value={formatBRLInteiro(resumoResult.data.mrr)}
            sub="PMOC recorrentes ativos, por mês"
          />
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
        <p className="max-w-[62ch] text-sm leading-relaxed text-ink-dim">
          Contratos ativos geram as faturas no dia 1, às 6h. Para parar a
          cobrança, encerre o contrato.
        </p>
        <ContractFormDialog clients={clients} hoje={hoje} />
      </div>
      {clientsResult.error !== null ? (
        <p role="status" className="text-[0.8125rem] text-danger">
          {clientsResult.error}
        </p>
      ) : null}

      <div className={LIST_FRAME}>
        <ul aria-label="Contratos" className="divide-y divide-line-soft md:hidden">
          {linhas.map(({ contrato, clienteNome, tipoLabel, statusLabel, statusClass, actions }) => (
            <li key={contrato.id} className="flex items-center gap-2 py-3 pr-1.5 pl-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.9375rem] font-medium text-ink">{clienteNome}</p>
                <p className="mt-0.5 truncate text-[0.8125rem] text-ink-faint">
                  {tipoLabel}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span className="font-display text-base leading-none font-medium tracking-[-0.01em] text-ink tabular-nums">
                  {formatBRL(contrato.valor_mensal)}
                </span>
                <StatusPill label={statusLabel} className={statusClass} />
              </div>
              {actions}
            </li>
          ))}
        </ul>

        <Table aria-label="Contratos por cliente" className="max-md:hidden">
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead className="max-lg:hidden">Vigência</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor mensal</TableHead>
              <TableHead className="w-14">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map(({ contrato, clienteNome, tipoLabel, statusLabel, statusClass, actions }) => (
              <TableRow key={contrato.id}>
                <TableCell className="max-w-64">
                  <span className="block truncate font-medium text-ink">{clienteNome}</span>
                  {contrato.client.cnpj ? (
                    <span className="mt-0.5 block truncate text-[0.8125rem] text-ink-faint tabular-nums">
                      {contrato.client.cnpj}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-ink-dim">{tipoLabel}</TableCell>
                <TableCell className="text-ink-dim tabular-nums">
                  Dia {contrato.dia_vencimento}
                </TableCell>
                <TableCell className="text-ink-dim tabular-nums max-lg:hidden">
                  {contrato.fim
                    ? `${formatDateBR(contrato.inicio)} até ${formatDateBR(contrato.fim)}`
                    : `Desde ${formatDateBR(contrato.inicio)}`}
                </TableCell>
                <TableCell>
                  <StatusPill label={statusLabel} className={statusClass} />
                </TableCell>
                <TableCell className="text-right font-display text-[0.9375rem] font-medium text-ink tabular-nums">
                  {formatBRL(contrato.valor_mensal)}
                </TableCell>
                <TableCell className="pr-3 text-right">{actions}</TableCell>
              </TableRow>
            ))}
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
