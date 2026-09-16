import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { cn } from "cn"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchXIcon,
  UsersIcon,
} from "lucide-react"

import type { Client } from "@/lib/types"
import { listBuildings } from "@/server/buildings"
import { listClients } from "@/server/clients"
import { listContracts } from "@/server/contracts"
import { listEquipment } from "@/server/equipment"
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
import { DataError } from "@/components/clientes/data-error"
import { ClientsTableSkeleton } from "@/components/clientes/skeletons"
import {
  CLIENT_STATUS_META,
  CONTRACT_TYPE_LABELS,
  formatBRL,
  regiaoLabel,
  segmentoLabel,
} from "@/components/clientes/format"

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
        <ClientFormDialog />
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

interface ClientRowData {
  client: Client
  regioes: string[]
  planoLabel: string | null
  planoValor: number | null
  equipCount: number | null
}

async function loadRowData(client: Client): Promise<ClientRowData> {
  const [buildings, contracts, equipment] = await Promise.all([
    listBuildings({ clientId: client.id }),
    listContracts({ clientId: client.id, pageSize: 100 }),
    listEquipment({ clientId: client.id, pageSize: 1 }),
  ])

  const regioes = buildings.data
    ? [
        ...new Set(
          buildings.data
            .map((b) => b.regiao)
            .filter((r): r is string => Boolean(r)),
        ),
      ]
    : []

  const contract =
    contracts.data?.items.find((c) => c.status === "ativo") ??
    contracts.data?.items[0] ??
    null

  return {
    client,
    regioes,
    planoLabel: contract ? CONTRACT_TYPE_LABELS[contract.tipo] : null,
    planoValor: contract ? contract.valor_mensal : null,
    equipCount: equipment.data ? equipment.data.total : null,
  }
}

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
        <section className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-console/50 px-6 py-16 text-center">
          <div
            className="flex size-14 items-center justify-center rounded-2xl border border-line-soft bg-console-2"
            aria-hidden="true"
          >
            <SearchXIcon className="size-7 text-ink-faint" />
          </div>
          <h3 className="mt-5 font-display text-lg font-bold tracking-tight text-ink">
            Nenhum cliente encontrado
          </h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-dim">
            Nenhum resultado para a busca e os filtros atuais. Ajuste os termos
            ou limpe os filtros.
          </p>
          <Link
            href="/clientes"
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
          <UsersIcon className="size-7 text-ink-faint" />
        </div>
        <h3 className="mt-5 font-display text-lg font-bold tracking-tight text-ink">
          Nenhum cliente cadastrado
        </h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-dim">
          Comece cadastrando a primeira empresa atendida: os prédios,
          equipamentos e contratos ficam vinculados a ela.
        </p>
        <div className="mt-6">
          <ClientFormDialog
            triggerLabel="Cadastrar primeiro cliente"
            triggerClassName="h-11 px-5"
          />
        </div>
      </section>
    )
  }

  const rows = await Promise.all(items.map(loadRowData))
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
          {rows.map(({ client, regioes, planoLabel, planoValor, equipCount }) => {
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
                <TableCell className="px-4 py-3 text-right font-mono text-ink">
                  {equipCount ?? "—"}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <nav
        aria-label="Paginação de clientes"
        className="flex items-center justify-between gap-3 border-t border-line-soft px-4 py-3"
      >
        <p className="text-xs text-ink-dim">
          Mostrando <span className="font-mono text-ink">{from}–{to}</span> de{" "}
          <span className="font-mono text-ink">{total}</span>{" "}
          {total === 1 ? "cliente" : "clientes"}
        </p>
        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-xs text-ink-faint sm:block">
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
