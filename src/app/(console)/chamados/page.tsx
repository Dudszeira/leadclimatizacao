import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { cn } from "cn"
import {
  BotIcon,
  CalendarClockIcon,
  SearchXIcon,
  UserRoundIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react"

import type {
  OsOrigin,
  OsPriority,
  OsStatus,
  OsType,
  ServiceOrderListItem,
} from "@/lib/types"
import { formatDateTimeBR, formatOsNumero, initials } from "@/lib/format"
import {
  OS_ORIGIN_META,
  OS_PRIORITY_META,
  OS_STATUS_META,
  OS_TYPE_META,
} from "@/lib/status-meta"
import { requireRole } from "@/server/auth"
import { listBuildings } from "@/server/buildings"
import { listServiceOrders } from "@/server/service-orders"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  ChamadosToolbar,
  type PrioridadeParam,
  type StatusParam,
  type TipoParam,
} from "@/components/chamados/chamados-toolbar"
import {
  NewOrderDialog,
  type ClienteOption,
  type PredioOption,
} from "@/components/chamados/new-order-dialog"
import { ChamadosTableSkeleton } from "@/components/chamados/skeletons"
import { DataError } from "@/components/data-error"
import { EmptyState } from "@/components/empty-state"
import { TablePagination } from "@/components/table-pagination"

export const metadata: Metadata = {
  title: "Chamados",
}

const PAGE_SIZE = 10

const OS_STATUSES: OsStatus[] = [
  "aberto",
  "agendado",
  "em_campo",
  "concluido",
  "cancelado",
]
const OS_TYPES: OsType[] = [
  "preventiva_pmoc",
  "corretiva",
  "instalacao",
  "orcamento",
]
const OS_PRIORITIES: OsPriority[] = ["baixa", "media", "alta", "urgente"]

const ORIGIN_ICONS: Record<OsOrigin, LucideIcon> = {
  manual: UserRoundIcon,
  pmoc_auto: CalendarClockIcon,
  ia_whatsapp: BotIcon,
}

type Filters = {
  q: string
  status: StatusParam
  tipo: TipoParam
  prioridade: PrioridadeParam
  page: number
}

function parseFilters(
  sp: Record<string, string | string[] | undefined>,
): Filters {
  const q = typeof sp.q === "string" ? sp.q : ""
  const status = OS_STATUSES.includes(sp.status as OsStatus)
    ? (sp.status as OsStatus)
    : "todos"
  const tipo = OS_TYPES.includes(sp.tipo as OsType)
    ? (sp.tipo as OsType)
    : "todos"
  const prioridade = OS_PRIORITIES.includes(sp.prioridade as OsPriority)
    ? (sp.prioridade as OsPriority)
    : "todos"
  const parsedPage = Number(typeof sp.pagina === "string" ? sp.pagina : "1")
  const page = Number.isFinite(parsedPage)
    ? Math.max(1, Math.trunc(parsedPage))
    : 1
  return { q, status, tipo, prioridade, page }
}

function buildHref({ q, status, tipo, prioridade, page }: Filters): string {
  const params = new URLSearchParams()
  if (q) params.set("q", q)
  if (status !== "todos") params.set("status", status)
  if (tipo !== "todos") params.set("tipo", tipo)
  if (prioridade !== "todos") params.set("prioridade", prioridade)
  if (page > 1) params.set("pagina", String(page))
  const qs = params.toString()
  return qs ? `/chamados?${qs}` : "/chamados"
}

export default async function ChamadosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const me = await requireRole("admin", "atendente", "tecnico")
  const tecnico = me.role === "tecnico"
  const filters = parseFilters(await searchParams)
  const suspenseKey = `${filters.q}|${filters.status}|${filters.tipo}|${filters.prioridade}|${filters.page}`

  return (
    <div className="flex flex-1 flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-ink">
            {tecnico ? "Minhas ordens de serviço" : "Central de chamados"}
          </h2>
          <p className="mt-1 text-sm text-ink-dim">
            {tecnico
              ? "OS atribuídas a você. Para a rota do dia, use a tela Campo."
              : "Ordens de serviço do pedido do cliente à conclusão em campo."}
          </p>
        </div>
        {!tecnico && (
          <Suspense fallback={null}>
            <NewOrderDialogLoader />
          </Suspense>
        )}
      </header>
      <QuickTabs filters={filters} />
      <ChamadosToolbar
        q={filters.q}
        status={filters.status}
        tipo={filters.tipo}
        prioridade={filters.prioridade}
      />
      <Suspense key={suspenseKey} fallback={<ChamadosTableSkeleton />}>
        <ChamadosSection
          filters={filters}
          technicianId={tecnico ? me.id : undefined}
          canCreate={!tecnico}
        />
      </Suspense>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tabs rápidas (links por URL — o filtro real acontece no server component)
// ---------------------------------------------------------------------------

function QuickTabs({ filters }: { filters: Filters }) {
  const tabs = [
    {
      label: "Todos",
      href: buildHref({ ...filters, status: "todos", prioridade: "todos", page: 1 }),
      active: filters.status === "todos" && filters.prioridade !== "urgente",
    },
    {
      label: "Abertos",
      href: buildHref({ ...filters, status: "aberto", prioridade: "todos", page: 1 }),
      active: filters.status === "aberto",
    },
    {
      label: "Em campo",
      href: buildHref({ ...filters, status: "em_campo", prioridade: "todos", page: 1 }),
      active: filters.status === "em_campo",
    },
    {
      label: "Urgentes",
      href: buildHref({ ...filters, status: "todos", prioridade: "urgente", page: 1 }),
      active: filters.prioridade === "urgente" && filters.status === "todos",
    },
  ]
  return (
    <nav aria-label="Filtros rápidos de chamados">
      <ul className="flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-line bg-console p-1">
        {tabs.map((tab) => (
          <li key={tab.label}>
            <Link
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-8 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors max-md:min-h-10",
                tab.active
                  ? "bg-signal-dim text-signal"
                  : "text-ink-dim hover:bg-console-2 hover:text-ink",
              )}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Dialog "Novo chamado" com dados dos selects encadeados
// ---------------------------------------------------------------------------

async function NewOrderDialogLoader() {
  // Equipamentos são buscados sob demanda no combobox (busca no servidor).
  const buildings = await listBuildings()

  const predios: PredioOption[] = (buildings.data ?? []).map((b) => ({
    id: b.id,
    clientId: b.client_id,
    label: b.nome,
  }))
  const clientes: ClienteOption[] = []
  const vistos = new Set<string>()
  for (const b of buildings.data ?? []) {
    if (vistos.has(b.client.id)) continue
    vistos.add(b.client.id)
    clientes.push({
      id: b.client.id,
      label: b.client.nome_fantasia ?? b.client.razao_social,
    })
  }
  clientes.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))
  return (
    <NewOrderDialog
      clientes={clientes}
      predios={predios}
    />
  )
}

// ---------------------------------------------------------------------------
// Seção assíncrona: consulta o data layer e renderiza tabela ou estados
// ---------------------------------------------------------------------------

async function ChamadosSection({
  filters,
  technicianId,
  canCreate,
}: {
  filters: Filters
  technicianId?: string
  canCreate: boolean
}) {
  const result = await listServiceOrders({
    technicianId,
    search: filters.q || undefined,
    status: filters.status !== "todos" ? filters.status : undefined,
    tipo: filters.tipo !== "todos" ? filters.tipo : undefined,
    prioridade: filters.prioridade !== "todos" ? filters.prioridade : undefined,
    page: filters.page,
    pageSize: PAGE_SIZE,
  })

  if (result.error !== null) {
    return <DataError message={result.error} />
  }

  const { items, total, page, pageCount } = result.data
  const hasFilters =
    filters.q !== "" ||
    filters.status !== "todos" ||
    filters.tipo !== "todos" ||
    filters.prioridade !== "todos"

  if (total === 0) {
    if (hasFilters) {
      return (
        <EmptyState
          icon={SearchXIcon}
          title="Nenhum chamado encontrado"
          description="Nenhum resultado para a busca e os filtros atuais. Ajuste os termos ou limpe os filtros."
        >
          <Link
            href="/chamados"
            className={cn(buttonVariants({ variant: "outline" }), "mt-6 h-11 px-5")}
          >
            Limpar filtros
          </Link>
        </EmptyState>
      )
    }
    return (
      <EmptyState
        icon={WrenchIcon}
        title="Nenhum chamado registrado"
        description={
          canCreate
            ? "Abra a primeira ordem de serviço: preventiva PMOC, corretiva, instalação ou visita de orçamento."
            : "Nenhuma OS atribuída a você no momento."
        }
      >
        {canCreate && (
          <div className="mt-6">
            <Suspense fallback={null}>
              <NewOrderDialogLoader />
            </Suspense>
          </div>
        )}
      </EmptyState>
    )
  }

  const from = (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-console">
      <ul aria-label="Ordens de serviço" className="divide-y divide-line-soft md:hidden">
        {items.map((os) => (
          <li key={os.id}>
            <ChamadoCard os={os} />
          </li>
        ))}
      </ul>
      <Table aria-label="Ordens de serviço" className="max-md:hidden">
        <TableHeader>
          <TableRow className="border-line-soft hover:bg-transparent">
            <TableHead className="px-4 text-xs font-medium tracking-wider text-ink-faint uppercase">
              OS
            </TableHead>
            <TableHead className="text-xs font-medium tracking-wider text-ink-faint uppercase">
              Tipo
            </TableHead>
            <TableHead className="text-xs font-medium tracking-wider text-ink-faint uppercase">
              Prioridade
            </TableHead>
            <TableHead className="text-xs font-medium tracking-wider text-ink-faint uppercase">
              Cliente / prédio
            </TableHead>
            <TableHead className="text-xs font-medium tracking-wider text-ink-faint uppercase">
              Técnico
            </TableHead>
            <TableHead className="text-xs font-medium tracking-wider text-ink-faint uppercase">
              Agendamento
            </TableHead>
            <TableHead className="text-xs font-medium tracking-wider text-ink-faint uppercase">
              Status
            </TableHead>
            <TableHead className="px-4 text-right text-xs font-medium tracking-wider text-ink-faint uppercase">
              Origem
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((os) => {
            const tipoMeta = OS_TYPE_META[os.tipo]
            const prioridadeMeta = OS_PRIORITY_META[os.prioridade]
            const statusMeta = OS_STATUS_META[os.status]
            const origemMeta = OS_ORIGIN_META[os.origem]
            const OrigemIcon = ORIGIN_ICONS[os.origem]
            const clienteNome =
              os.building.client.nome_fantasia ?? os.building.client.razao_social
            return (
              <TableRow
                key={os.id}
                className="relative border-line-soft hover:bg-console-2/60"
              >
                <TableCell className="px-4 py-3">
                  <Link
                    href={`/chamados/${os.id}`}
                    aria-label={`Abrir chamado ${formatOsNumero(os.numero)} — ${clienteNome}`}
                    className="font-mono font-medium text-signal tabular-nums outline-none after:absolute after:inset-0 hover:underline focus-visible:underline"
                  >
                    {formatOsNumero(os.numero)}
                  </Link>
                </TableCell>
                <TableCell className="py-3">
                  <Badge
                    variant="outline"
                    className={cn("font-medium", tipoMeta.badgeClassName)}
                  >
                    {tipoMeta.label}
                  </Badge>
                </TableCell>
                <TableCell className="py-3">
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        prioridadeMeta.dotClassName,
                      )}
                      aria-hidden="true"
                    />
                    <span className="text-ink-dim">{prioridadeMeta.label}</span>
                  </span>
                </TableCell>
                <TableCell className="max-w-56 py-3">
                  <span className="block truncate font-medium text-ink">
                    {clienteNome}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-faint">
                    {os.building.nome}
                  </span>
                </TableCell>
                <TableCell className="py-3">
                  {os.technician ? (
                    <span className="flex items-center gap-2">
                      <Avatar size="sm">
                        <AvatarFallback className="bg-console-3 font-mono text-[10px] text-ink-dim">
                          {initials(os.technician.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden truncate text-ink-dim xl:inline">
                        {os.technician.full_name}
                      </span>
                    </span>
                  ) : (
                    <span className="text-ink-faint">A designar</span>
                  )}
                </TableCell>
                <TableCell className="py-3 font-mono text-ink-dim tabular-nums">
                  {formatDateTimeBR(os.scheduled_at)}
                </TableCell>
                <TableCell className="py-3">
                  <Badge
                    variant="outline"
                    className={cn("font-medium", statusMeta.badgeClassName)}
                  >
                    {statusMeta.label}
                  </Badge>
                </TableCell>
                <TableCell className="px-4 py-3 text-right">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span
                          className="relative z-10 inline-flex size-7 items-center justify-center rounded-md border border-line-soft bg-console-2"
                          aria-label={origemMeta.label}
                        />
                      }
                    >
                      <OrigemIcon
                        className="size-3.5 text-ink-dim"
                        aria-hidden="true"
                      />
                    </TooltipTrigger>
                    <TooltipContent side="left">{origemMeta.label}</TooltipContent>
                  </Tooltip>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <TablePagination
        ariaLabel="Paginação de chamados"
        from={from}
        to={to}
        total={total}
        page={page}
        pageCount={pageCount}
        singular="chamado"
        plural="chamados"
        prevHref={buildHref({ ...filters, page: page - 1 })}
        nextHref={buildHref({ ...filters, page: page + 1 })}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card da lista no celular (abaixo de md)
// ---------------------------------------------------------------------------

function ChamadoCard({ os }: { os: ServiceOrderListItem }) {
  const tipoMeta = OS_TYPE_META[os.tipo]
  const prioridadeMeta = OS_PRIORITY_META[os.prioridade]
  const statusMeta = OS_STATUS_META[os.status]
  const clienteNome = os.building.client.nome_fantasia ?? os.building.client.razao_social
  return (
    <Link
      href={`/chamados/${os.id}`}
      aria-label={`Abrir chamado ${formatOsNumero(os.numero)} — ${clienteNome}`}
      className="flex min-h-11 flex-col gap-2 px-4 py-3.5 outline-none hover:bg-console-2/60 focus-visible:bg-console-2"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="font-mono font-medium text-signal tabular-nums">
            {formatOsNumero(os.numero)}
          </span>
          <span
            className={cn("size-2 shrink-0 rounded-full", prioridadeMeta.dotClassName)}
            aria-hidden="true"
          />
          <span className="text-xs text-ink-dim">{prioridadeMeta.label}</span>
        </span>
        <Badge variant="outline" className={cn("font-medium", statusMeta.badgeClassName)}>
          {statusMeta.label}
        </Badge>
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink">{clienteNome}</span>
        <span className="mt-0.5 block truncate text-xs text-ink-faint">{os.building.nome}</span>
      </span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-dim">
        <Badge variant="outline" className={cn("font-medium", tipoMeta.badgeClassName)}>
          {tipoMeta.label}
        </Badge>
        <span className="font-mono tabular-nums">{formatDateTimeBR(os.scheduled_at)}</span>
        <span className="truncate">{os.technician?.full_name ?? "A designar"}</span>
      </span>
    </Link>
  )
}
