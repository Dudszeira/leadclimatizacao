import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { cn } from "cn"
import { FileUpIcon, KanbanSquareIcon, SearchXIcon, UsersIcon } from "lucide-react"

import { formatBRL } from "@/lib/format"
import {
  CLIENT_STATUS_META,
  CONTRACT_TYPE_LABELS,
  regiaoLabel,
  segmentoLabel,
} from "@/lib/status-meta"
import { requireRole } from "@/server/auth"
import { listClients, listClientsSummary } from "@/server/clients"
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
import { ClientFormDialog } from "@/components/clientes/client-form-dialog"
import {
  ClientsToolbar,
  type StatusFilter,
} from "@/components/clientes/clients-toolbar"
import { ClientsTableSkeleton } from "@/components/clientes/skeletons"
import { DataError } from "@/components/data-error"
import { EmptyState } from "@/components/empty-state"
import { TablePagination } from "@/components/table-pagination"

export const metadata: Metadata = {
  title: "Clientes",
}

const PAGE_SIZE = 10

type Filters = {
  q: string
  status: StatusFilter
  tipo: string
  page: number
}

function parseFilters(
  sp: Record<string, string | string[] | undefined>,
): Filters {
  const q = typeof sp.q === "string" ? sp.q : ""
  const status: StatusFilter =
    sp.status === "ativos" || sp.status === "inativos" ? sp.status : "todos"
  const tipo = typeof sp.tipo === "string" && sp.tipo ? sp.tipo : "todos"
  const parsedPage = Number(typeof sp.pagina === "string" ? sp.pagina : "1")
  const page = Number.isFinite(parsedPage) ? Math.max(1, Math.trunc(parsedPage)) : 1
  return { q, status, tipo, page }
}

function buildHref({ q, status, tipo, page }: Filters): string {
  const params = new URLSearchParams()
  if (q) params.set("q", q)
  if (status !== "todos") params.set("status", status)
  if (tipo !== "todos") params.set("tipo", tipo)
  if (page > 1) params.set("pagina", String(page))
  const qs = params.toString()
  return qs ? `/clientes?${qs}` : "/clientes"
}

export default async function ClientesPage({
  searchParams,
}: PageProps<"/clientes">) {
  const profile = await requireRole("admin", "atendente")
  const filters = parseFilters(await searchParams)
  const suspenseKey = `${filters.q}|${filters.status}|${filters.tipo}|${filters.page}`

  return (
    <div className="flex flex-1 flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-ink">
            Base de clientes
          </h2>
          <p className="mt-1 text-sm text-ink-dim">
            Clientes com contratos, prédios e equipamentos sob gestão.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/clientes/funil"
            className={cn(buttonVariants({ variant: "outline" }), "h-9 px-3 max-md:h-11")}
          >
            <KanbanSquareIcon aria-hidden="true" />
            Funil de leads
          </Link>
          {profile.role === "admin" && (
            <Link
              href="/importar"
              className={cn(buttonVariants({ variant: "outline" }), "h-9 px-3 max-md:h-11")}
            >
              <FileUpIcon aria-hidden="true" />
              Importar planilha
            </Link>
          )}
          <ClientFormDialog />
        </div>
      </header>
      <ClientsToolbar q={filters.q} status={filters.status} tipo={filters.tipo} />
      <Suspense key={suspenseKey} fallback={<ClientsTableSkeleton />}>
        <ClientsSection filters={filters} />
      </Suspense>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Seção assíncrona: consulta o data layer e renderiza tabela ou estados
// ---------------------------------------------------------------------------

async function ClientsSection({ filters }: { filters: Filters }) {
  const result = await listClients({
    search: filters.q || undefined,
    ativo:
      filters.status === "ativos"
        ? true
        : filters.status === "inativos"
          ? false
          : undefined,
    segmento: filters.tipo !== "todos" ? filters.tipo : undefined,
    page: filters.page,
    pageSize: PAGE_SIZE,
  })

  if (result.error !== null) {
    return <DataError message={result.error} />
  }

  const { items, total, page, pageCount } = result.data
  const hasFilters =
    filters.q !== "" || filters.status !== "todos" || filters.tipo !== "todos"

  if (total === 0) {
    if (hasFilters) {
      return (
        <EmptyState
          icon={SearchXIcon}
          title="Nenhum cliente encontrado"
          description="Nenhum resultado para a busca e os filtros atuais. Ajuste os termos ou limpe os filtros."
        >
          <Link
            href="/clientes"
            className={cn(buttonVariants({ variant: "outline" }), "mt-6 h-11 px-5")}
          >
            Limpar filtros
          </Link>
        </EmptyState>
      )
    }
    return (
      <EmptyState
        icon={UsersIcon}
        title="Nenhum cliente cadastrado"
        description="Comece cadastrando a primeira empresa atendida: os prédios, equipamentos e contratos ficam vinculados a ela."
      >
        <div className="mt-6">
          <ClientFormDialog
            triggerLabel="Cadastrar primeiro cliente"
            triggerClassName="h-11 px-5"
          />
        </div>
      </EmptyState>
    )
  }

  const summariesResult = await listClientsSummary(items.map((c) => c.id))
  const summaries = summariesResult.data
  const from = (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-console">
      <Table aria-label="Clientes cadastrados">
        <TableHeader>
          <TableRow className="border-line-soft hover:bg-transparent">
            <TableHead className="px-4 text-xs font-medium tracking-wider text-ink-faint uppercase">
              Cliente
            </TableHead>
            <TableHead className="text-xs font-medium tracking-wider text-ink-faint uppercase">
              Tipo
            </TableHead>
            <TableHead className="text-xs font-medium tracking-wider text-ink-faint uppercase">
              Região
            </TableHead>
            <TableHead className="text-xs font-medium tracking-wider text-ink-faint uppercase">
              Plano
            </TableHead>
            <TableHead className="text-xs font-medium tracking-wider text-ink-faint uppercase">
              Status
            </TableHead>
            <TableHead className="px-4 text-right text-xs font-medium tracking-wider text-ink-faint uppercase">
              Equip.
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((client) => {
            const summary = summaries?.[client.id]
            const regioes = summary?.regioes ?? []
            const planoLabel = summary?.contrato
              ? CONTRACT_TYPE_LABELS[summary.contrato.tipo]
              : null
            const planoValor = summary?.contrato?.valor_mensal ?? null
            const equipCount = summary ? summary.equip_count : null
            const statusMeta = client.ativo
              ? CLIENT_STATUS_META.ativo
              : CLIENT_STATUS_META.inativo
            return (
              <TableRow
                key={client.id}
                className="relative border-line-soft hover:bg-console-2/60"
              >
                <TableCell className="max-w-72 px-4 py-3">
                  <Link
                    href={`/clientes/${client.id}`}
                    aria-label={`Abrir cliente ${client.razao_social}`}
                    className="font-medium text-ink outline-none after:absolute after:inset-0 hover:text-signal focus-visible:text-signal"
                  >
                    <span className="block truncate">{client.razao_social}</span>
                  </Link>
                  {client.nome_fantasia && (
                    <span className="mt-0.5 block truncate text-xs text-ink-faint">
                      {client.nome_fantasia}
                    </span>
                  )}
                </TableCell>
                <TableCell className="py-3 text-ink-dim">
                  {segmentoLabel(client.segmento)}
                </TableCell>
                <TableCell className="py-3">
                  <span className="font-mono text-xs tracking-wider text-ink-dim uppercase">
                    {regioes.length > 0
                      ? regioes.map(regiaoLabel).join(" · ")
                      : "—"}
                  </span>
                </TableCell>
                <TableCell className="py-3">
                  {planoLabel ? (
                    <>
                      <span className="block text-ink">{planoLabel}</span>
                      {planoValor !== null && (
                        <span className="mt-0.5 block font-mono text-xs text-ink-faint">
                          {formatBRL(planoValor)}/mês
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-ink-faint">Sem contrato</span>
                  )}
                </TableCell>
                <TableCell className="py-3">
                  <Badge
                    variant="outline"
                    className={cn("font-medium", statusMeta.badgeClassName)}
                  >
                    {statusMeta.label}
                  </Badge>
                </TableCell>
                <TableCell className="px-4 py-3 text-right font-mono text-ink tabular-nums">
                  {equipCount ?? "—"}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <TablePagination
        ariaLabel="Paginação de clientes"
        from={from}
        to={to}
        total={total}
        page={page}
        pageCount={pageCount}
        singular="cliente"
        plural="clientes"
        prevHref={buildHref({ ...filters, page: page - 1 })}
        nextHref={buildHref({ ...filters, page: page + 1 })}
      />
    </div>
  )
}
