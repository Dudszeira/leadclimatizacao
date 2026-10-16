import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import {
  AirVentIcon,
  ChevronRightIcon,
  FileUpIcon,
  KanbanSquareIcon,
  SearchXIcon,
  UsersIcon,
} from "lucide-react"

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
import { ClientAvatar } from "@/components/clientes/client-avatar"
import { ClientFormDialog } from "@/components/clientes/client-form-dialog"
import {
  ClientsToolbar,
  type StatusFilter,
} from "@/components/clientes/clients-toolbar"
import { ClientsTableSkeleton } from "@/components/clientes/skeletons"
import { DataError } from "@/components/data-error"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
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
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Clientes"
        description="Empresas atendidas, com prédios, equipamentos e contratos."
        actions={
          <>
            <Link
              href="/clientes/funil"
              className={buttonVariants({ variant: "secondary" })}
            >
              <KanbanSquareIcon aria-hidden="true" />
              Funil
            </Link>
            {profile.role === "admin" && (
              <Link
                href="/importar"
                className={buttonVariants({ variant: "secondary", className: "max-md:hidden" })}
              >
                <FileUpIcon aria-hidden="true" />
                Importar
              </Link>
            )}
            <ClientFormDialog />
          </>
        }
      >
        <ClientsToolbar q={filters.q} status={filters.status} tipo={filters.tipo} />
      </PageHeader>
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
            className={buttonVariants({ variant: "secondary", className: "mt-6" })}
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
          <ClientFormDialog triggerLabel="Cadastrar primeiro cliente" />
        </div>
      </EmptyState>
    )
  }

  const summariesResult = await listClientsSummary(items.map((c) => c.id))
  const summaries = summariesResult.data
  const from = (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  const rows = items.map((client) => {
    const summary = summaries?.[client.id]
    return {
      client,
      nome: client.nome_fantasia ?? client.razao_social,
      tipo: client.segmento ? segmentoLabel(client.segmento) : null,
      regioes: (summary?.regioes ?? []).map(regiaoLabel),
      plano: summary?.contrato ? CONTRACT_TYPE_LABELS[summary.contrato.tipo] : null,
      planoValor: summary?.contrato?.valor_mensal ?? null,
      equipCount: summary ? summary.equip_count : null,
      status: client.ativo ? CLIENT_STATUS_META.ativo : CLIENT_STATUS_META.inativo,
    }
  })

  return (
    <div className="overflow-hidden rounded-[1.375rem] bg-console ring-1 ring-line">
      {/* Celular: linhas tocáveis (avatar, nome, tipo/região, equipamentos). */}
      <ul aria-label="Clientes cadastrados" className="divide-y divide-line-soft md:hidden">
        {rows.map(({ client, nome, tipo, regioes, equipCount, status }) => {
          const secundario = [tipo, regioes.join(", ")].filter(Boolean).join(" · ")
          return (
            <li key={client.id}>
              <Link
                href={`/clientes/${client.id}`}
                className="flex min-h-[4.5rem] items-center gap-3 px-4 py-3 transition-colors duration-150 outline-none active:bg-console-2 focus-visible:bg-console-2"
              >
                <ClientAvatar name={nome} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] font-medium text-ink">
                    {nome}
                  </span>
                  <span className="mt-0.5 block truncate text-[0.8125rem] text-ink-dim">
                    {secundario || client.razao_social}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  {client.ativo ? (
                    <span className="inline-flex items-center gap-1.5 text-[0.9375rem] font-medium text-ink tabular-nums">
                      <AirVentIcon className="size-4 text-ink-faint" aria-hidden="true" />
                      {equipCount ?? 0}
                      <span className="sr-only">
                        {equipCount === 1 ? "equipamento" : "equipamentos"}
                      </span>
                    </span>
                  ) : (
                    <Badge variant="outline" className={status.badgeClassName}>
                      {status.label}
                    </Badge>
                  )}
                </span>
                <ChevronRightIcon className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
              </Link>
            </li>
          )
        })}
      </ul>

      {/* Desktop: tabela limpa. */}
      <Table aria-label="Clientes cadastrados" className="max-md:hidden">
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Região</TableHead>
            <TableHead>Plano</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Equipamentos</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ client, nome, tipo, regioes, plano, planoValor, equipCount, status }) => (
            <TableRow key={client.id} className="relative">
              <TableCell className="max-w-80">
                <span className="flex items-center gap-3">
                  <ClientAvatar name={nome} className="size-9" />
                  <span className="min-w-0">
                    <Link
                      href={`/clientes/${client.id}`}
                      aria-label={`Abrir cliente ${nome}`}
                      className="block truncate font-medium text-ink outline-none after:absolute after:inset-0 hover:text-signal focus-visible:text-signal"
                    >
                      {nome}
                    </Link>
                    {client.nome_fantasia && (
                      <span className="mt-0.5 block truncate text-[0.8125rem] text-ink-faint">
                        {client.razao_social}
                      </span>
                    )}
                  </span>
                </span>
              </TableCell>
              <TableCell className="text-ink-dim">
                {tipo ?? <span className="text-ink-faint">Sem tipo</span>}
              </TableCell>
              <TableCell className="max-w-48 truncate text-ink-dim">
                {regioes.length > 0 ? (
                  regioes.join(", ")
                ) : (
                  <span className="text-ink-faint">Sem região</span>
                )}
              </TableCell>
              <TableCell>
                {plano ? (
                  <>
                    <span className="block text-ink">{plano}</span>
                    {planoValor !== null && (
                      <span className="mt-0.5 block text-[0.8125rem] text-ink-faint tabular-nums">
                        {formatBRL(planoValor)}/mês
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-ink-faint">Sem contrato</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={status.badgeClassName}>
                  {status.label}
                </Badge>
              </TableCell>
              <TableCell className="text-right text-[0.9375rem] font-medium text-ink tabular-nums">
                {equipCount ?? 0}
              </TableCell>
            </TableRow>
          ))}
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
