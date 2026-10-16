import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { cn } from "cn"
import {
  BotIcon,
  CalendarClockIcon,
  CalendarIcon,
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
import { OS_ORIGIN_META, OS_TYPE_META } from "@/lib/status-meta"
import { requireRole } from "@/server/auth"
import { listBuildings } from "@/server/buildings"
import { listServiceOrders } from "@/server/service-orders"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import { PriorityPill, StatusPill } from "@/components/chamados/os-pills"
import { PageHeader } from "@/components/page-header"
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
    <div className="flex flex-1 flex-col">
      <PageHeader
        title={tecnico ? "Minhas OS" : "Chamados"}
        description={
          tecnico
            ? "Ordens de serviço atribuídas a você. A rota do dia fica em Campo."
            : "Do pedido do cliente à conclusão em campo."
        }
        actions={
          tecnico ? undefined : (
            <Suspense fallback={null}>
              <NewOrderDialogLoader />
            </Suspense>
          )
        }
      >
        <QuickTabs filters={filters} />
      </PageHeader>
      <div className="flex flex-1 flex-col gap-4">
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
    </div>
  )
}

// ---------------------------------------------------------------------------
// Filtros rápidos (links por URL; o filtro real acontece no server component).
// Visual do Tabs variant="default": segmentado em pílula com ativo branco.
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
    <nav
      aria-label="Filtros rápidos de chamados"
      className="no-scrollbar -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0"
    >
      <ul className="flex h-11 w-max min-w-full items-center gap-1 rounded-full bg-console-2 p-1 sm:min-w-0 md:h-10">
        {tabs.map((tab) => (
          <li key={tab.label} className="h-full flex-1">
            <Link
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "inline-flex h-full w-full items-center justify-center rounded-full px-3 text-sm sm:px-4 font-medium whitespace-nowrap transition-[color,background-color] duration-150 outline-none focus-visible:ring-3 focus-visible:ring-signal/50",
                tab.active ? "bg-ink text-void" : "text-ink-dim hover:text-ink",
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
            className={cn(buttonVariants({ variant: "outline" }), "mt-6")}
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
    <div className="flex flex-col gap-3">
      <ul aria-label="Ordens de serviço" className="flex flex-col gap-2.5 md:hidden">
        {items.map((os) => (
          <li key={os.id}>
            <ChamadoCard os={os} />
          </li>
        ))}
      </ul>
      <div className="overflow-hidden rounded-[1.375rem] bg-console ring-1 ring-line max-md:[&>nav]:border-t-0">
        <Table aria-label="Ordens de serviço" className="max-md:hidden">
          <TableHeader>
            <TableRow>
              <TableHead>OS</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Técnico</TableHead>
              <TableHead>Agendamento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Origem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((os) => {
              const origemMeta = OS_ORIGIN_META[os.origem]
              const OrigemIcon = ORIGIN_ICONS[os.origem]
              const clienteNome =
                os.building.client.nome_fantasia ?? os.building.client.razao_social
              return (
                <TableRow key={os.id} className="relative">
                  <TableCell>
                    <Link
                      href={`/chamados/${os.id}`}
                      aria-label={`Abrir chamado ${formatOsNumero(os.numero)}, ${clienteNome}`}
                      className="font-medium text-ink-dim tabular-nums outline-none after:absolute after:inset-0 hover:text-ink focus-visible:text-ink focus-visible:underline"
                    >
                      {formatOsNumero(os.numero)}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-64">
                    <span className="block truncate font-medium text-ink">
                      {clienteNome}
                    </span>
                    <span className="mt-0.5 block truncate text-[0.8125rem] text-ink-faint">
                      {os.building.nome}
                    </span>
                  </TableCell>
                  <TableCell className="text-ink-dim">
                    {OS_TYPE_META[os.tipo].label}
                  </TableCell>
                  <TableCell>
                    <PriorityPill prioridade={os.prioridade} />
                  </TableCell>
                  <TableCell>
                    {os.technician ? (
                      <span className="flex items-center gap-2">
                        <Avatar size="sm">
                          <AvatarFallback className="bg-console-3 text-[0.6875rem] text-ink-dim">
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
                  <TableCell className="text-ink-dim tabular-nums">
                    {os.scheduled_at ? formatDateTimeBR(os.scheduled_at) : "Sem data"}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={os.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span
                            className="relative z-10 inline-flex size-8 items-center justify-center rounded-full bg-console-2"
                            aria-label={origemMeta.label}
                          />
                        }
                      >
                        <OrigemIcon className="size-3.5 text-ink-dim" aria-hidden="true" />
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
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card da lista no celular (abaixo de md): o card inteiro abre a OS.
// ---------------------------------------------------------------------------

function ChamadoCard({ os }: { os: ServiceOrderListItem }) {
  const clienteNome = os.building.client.nome_fantasia ?? os.building.client.razao_social
  return (
    <Link
      href={`/chamados/${os.id}`}
      aria-label={`Abrir chamado ${formatOsNumero(os.numero)}, ${clienteNome}`}
      className="flex flex-col gap-3 rounded-[1.375rem] bg-console p-4 ring-1 ring-line transition-[background-color,transform] duration-150 ease-(--ease-out-expo) outline-none active:scale-[0.99] active:bg-console-2 focus-visible:ring-3 focus-visible:ring-signal/60 motion-reduce:transition-none"
    >
      <span className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-[0.8125rem]">
          <span className="font-medium text-ink-dim tabular-nums">
            {formatOsNumero(os.numero)}
          </span>
          <span className="truncate text-ink-faint">{OS_TYPE_META[os.tipo].label}</span>
        </span>
        <StatusPill status={os.status} />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-display text-[1.0625rem] leading-snug font-medium tracking-[-0.01em] text-ink">
          {clienteNome}
        </span>
        <span className="mt-0.5 block truncate text-sm text-ink-dim">{os.building.nome}</span>
      </span>
      <span className="flex min-w-0 items-center gap-2 text-[0.8125rem] text-ink-dim">
        <PriorityPill prioridade={os.prioridade} />
        <span className="flex min-w-0 items-center gap-1.5">
          <CalendarIcon className="size-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
          <span className="tabular-nums">{os.scheduled_at ? formatDateTimeBR(os.scheduled_at) : "Sem data"}</span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <UserRoundIcon className="size-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
          <span className="truncate">
            {os.technician ? firstName(os.technician.full_name) : "A designar"}
          </span>
        </span>
      </span>
    </Link>
  )
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full
}
