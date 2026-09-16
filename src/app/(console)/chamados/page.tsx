import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { cn } from "cn"
import {
  BotIcon,
  CalendarClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchXIcon,
  UserRoundIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react"

import type { OsOrigin, OsPriority, OsStatus, OsType } from "@/lib/types"
import { listBuildings } from "@/server/buildings"
import { listEquipment } from "@/server/equipment"
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
import { DataError } from "@/components/clientes/data-error"
import {
  NewOrderDialog,
  type ClienteOption,
  type EquipamentoOption,
  type PredioOption,
} from "@/components/chamados/new-order-dialog"
import { ChamadosTableSkeleton } from "@/components/chamados/skeletons"
import {
  formatDateTimeBR,
  formatOsNumero,
  initials,
  OS_ORIGIN_META,
  OS_PRIORITY_META,
  OS_STATUS_META,
  OS_TYPE_META,
} from "@/components/chamados/format"

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
  const filters = parseFilters(await searchParams)
  const suspenseKey = `${filters.q}|${filters.status}|${filters.tipo}|${filters.prioridade}|${filters.page}`

  return (
    <div className="flex flex-1 flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-ink">
            Central de chamados
          </h2>
          <p className="mt-1 text-sm text-ink-dim">
            Ordens de serviço do pedido do cliente à conclusão em campo.
          </p>
        </div>
        <Suspense fallback={null}>
          <NewOrderDialogLoader />
        </Suspense>
      </header>
      <QuickTabs filters={filters} />
      <ChamadosToolbar
        q={filters.q}
        status={filters.status}
        tipo={filters.tipo}
        prioridade={filters.prioridade}
      />
      <Suspense key={suspenseKey} fallback={<ChamadosTableSkeleton />}>
        <ChamadosSection filters={filters} />
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
  const [buildings, equipment] = await Promise.all([
    listBuildings(),
    listEquipment({ pageSize: 100 }),
  ])

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
  const equipamentos: EquipamentoOption[] = (equipment.data?.items ?? []).map(
    (e) => ({
      id: e.id,
      buildingId: e.building_id,
      label: `${e.codigo_interno}${e.ambiente ? ` — ${e.ambiente}` : ""}`,
    }),
  )

  return (
    <NewOrderDialog
      clientes={clientes}
      predios={predios}
      equipamentos={equipamentos}
    />
  )
}

// ---------------------------------------------------------------------------
// Seção assíncrona: consulta o data layer e renderiza tabela ou estados
// ---------------------------------------------------------------------------

async function ChamadosSection({ filters }: { filters: Filters }) {
  const result = await listServiceOrders({
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
        <section className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-console/50 px-6 py-16 text-center">
          <div
            className="flex size-14 items-center justify-center rounded-2xl border border-line-soft bg-console-2"
            aria-hidden="true"
          >
            <SearchXIcon className="size-7 text-ink-faint" />
          </div>
          <h3 className="mt-5 font-display text-lg font-bold tracking-tight text-ink">
            Nenhum chamado encontrado
          </h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-dim">
            Nenhum resultado para a busca e os filtros atuais. Ajuste os termos
            ou limpe os filtros.
          </p>
          <Link
            href="/chamados"
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
          <WrenchIcon className="size-7 text-ink-faint" />
        </div>
        <h3 className="mt-5 font-display text-lg font-bold tracking-tight text-ink">
          Nenhum chamado registrado
        </h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-dim">
          Abra a primeira ordem de serviço: preventiva PMOC, corretiva,
          instalação ou visita de orçamento.
        </p>
        <div className="mt-6">
          <Suspense fallback={null}>
            <NewOrderDialogLoader />
          </Suspense>
        </div>
      </section>
    )
  }

  const from = (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-console">
      <Table aria-label="Ordens de serviço">
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
      <nav
        aria-label="Paginação de chamados"
        className="flex items-center justify-between gap-3 border-t border-line-soft px-4 py-3"
      >
        <p className="text-xs text-ink-dim">
          Mostrando{" "}
          <span className="font-mono text-ink tabular-nums">
            {from}–{to}
          </span>{" "}
          de <span className="font-mono text-ink tabular-nums">{total}</span>{" "}
          {total === 1 ? "chamado" : "chamados"}
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
