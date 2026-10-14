import { cache } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { cn } from "cn"
import {
  AirVentIcon,
  BotIcon,
  Building2Icon,
  CalendarClockIcon,
  CheckIcon,
  CircleIcon,
  UserRoundIcon,
  type LucideIcon,
} from "lucide-react"

import { isDemoMode } from "@/lib/env"
import type { OsOrigin, ServiceOrderWithRelations } from "@/lib/types"
import { requireRole } from "@/server/auth"
import { listTechnicians } from "@/server/profiles"
import {
  getServiceOrder,
  getServiceOrderEvidence,
} from "@/server/service-orders"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  formatDateTimeFullBR,
  formatHourBR,
  formatOsNumero,
  initials,
} from "@/lib/format"
import {
  EQUIPMENT_TYPE_LABELS,
  OS_ORIGIN_META,
  OS_PRIORITY_META,
  OS_STATUS_META,
  OS_TYPE_META,
} from "@/lib/status-meta"
import { OsWorkspace } from "@/components/chamados/execucao/os-workspace"
import { DataError } from "@/components/data-error"

type PageParams = { params: Promise<{ id: string }> }

const getServiceOrderCached = cache(getServiceOrder)

const ORIGIN_ICONS: Record<OsOrigin, LucideIcon> = {
  manual: UserRoundIcon,
  pmoc_auto: CalendarClockIcon,
  ia_whatsapp: BotIcon,
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { id } = await params
  const result = await getServiceOrderCached(id)
  return {
    title: result.data ? `OS ${formatOsNumero(result.data.numero)}` : "Chamado",
  }
}

export default async function ChamadoDetalhePage({ params }: PageParams) {
  const me = await requireRole("admin", "atendente", "tecnico")
  const { id } = await params
  const result = await getServiceOrderCached(id)

  if (result.error !== null) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <ChamadoBreadcrumb label="Chamado" />
        <DataError message={result.error} />
      </div>
    )
  }
  if (!result.data) notFound()

  const os = result.data
  // Técnico só enxerga a OS atribuída a ele (a RLS já filtra; aqui é defesa extra).
  if (me.role === "tecnico" && os.technician_id !== me.id && !isDemoMode) notFound()
  const tipoMeta = OS_TYPE_META[os.tipo]
  const prioridadeMeta = OS_PRIORITY_META[os.prioridade]
  const statusMeta = OS_STATUS_META[os.status]
  const origemMeta = OS_ORIGIN_META[os.origem]
  const OrigemIcon = ORIGIN_ICONS[os.origem]
  const clienteNome =
    os.building.client.nome_fantasia ?? os.building.client.razao_social
  const encerrada = os.status === "concluido" || os.status === "cancelado"

  const office = me.role === "admin" || me.role === "atendente"
  const canExecute = office || os.technician_id === me.id
  const [technicians, evidence] = await Promise.all([
    encerrada || !office ? null : listTechnicians(),
    getServiceOrderEvidence(os),
  ])

  return (
    <div className="flex flex-1 flex-col gap-4">
      <ChamadoBreadcrumb label={`OS ${formatOsNumero(os.numero)}`} />

      <Card className="border border-line bg-console ring-0">
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-mono text-2xl font-bold text-ink tabular-nums">
                  {formatOsNumero(os.numero)}
                </h2>
                <Badge
                  variant="outline"
                  className={cn("font-medium", tipoMeta.badgeClassName)}
                >
                  {tipoMeta.label}
                </Badge>
                <Badge
                  variant="outline"
                  className="gap-1.5 border-line bg-console-2 font-medium text-ink-dim"
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      prioridadeMeta.dotClassName,
                    )}
                    aria-hidden="true"
                  />
                  {prioridadeMeta.label}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn("font-medium", statusMeta.badgeClassName)}
                >
                  {statusMeta.label}
                </Badge>
              </div>
              {os.descricao && (
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-dim">
                  {os.descricao}
                </p>
              )}
            </div>
            <span
              className="flex items-center gap-1.5 rounded-md border border-line-soft bg-console-2 px-2.5 py-1.5 text-xs text-ink-dim"
              aria-label={`Origem: ${origemMeta.label}`}
            >
              <OrigemIcon className="size-3.5 text-ink-faint" aria-hidden="true" />
              {origemMeta.label}
            </span>
          </div>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0">
              <dt className="text-xs font-medium tracking-wider text-ink-faint uppercase">
                Cliente / prédio
              </dt>
              <dd className="mt-1 text-sm">
                <Link
                  href={`/clientes/${os.building.client.id}`}
                  className="flex items-center gap-1.5 text-ink underline-offset-4 hover:text-signal hover:underline"
                  aria-label={`Abrir cliente ${clienteNome} no CRM`}
                >
                  <Building2Icon
                    className="size-3.5 shrink-0 text-ink-faint"
                    aria-hidden="true"
                  />
                  <span className="truncate">{clienteNome}</span>
                </Link>
                <span className="mt-0.5 block truncate text-xs text-ink-faint">
                  {os.building.nome} · {os.building.cidade}/{os.building.uf}
                </span>
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-medium tracking-wider text-ink-faint uppercase">
                Equipamento
              </dt>
              <dd className="mt-1 flex items-center gap-1.5 text-sm text-ink">
                <AirVentIcon
                  className="size-3.5 shrink-0 text-ink-faint"
                  aria-hidden="true"
                />
                {os.equipment ? (
                  <span className="truncate">
                    <span className="font-mono text-signal">
                      {os.equipment.codigo_interno}
                    </span>{" "}
                    <span className="text-ink-dim">
                      · {EQUIPMENT_TYPE_LABELS[os.equipment.tipo]}
                      {os.equipment.ambiente ? ` · ${os.equipment.ambiente}` : ""}
                    </span>
                  </span>
                ) : (
                  <span className="text-ink-faint">Sem equipamento vinculado</span>
                )}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-medium tracking-wider text-ink-faint uppercase">
                Técnico
              </dt>
              <dd className="mt-1 flex items-center gap-2 text-sm">
                {os.technician ? (
                  <>
                    <Avatar size="sm">
                      <AvatarFallback className="bg-console-3 font-mono text-[10px] text-ink-dim">
                        {initials(os.technician.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-ink">
                      {os.technician.full_name}
                    </span>
                  </>
                ) : (
                  <span className="text-ink-faint">A designar</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wider text-ink-faint uppercase">
                Datas
              </dt>
              <dd className="mt-1 space-y-0.5 font-mono text-xs text-ink-dim tabular-nums">
                <p>
                  <span className="text-ink-faint">Aberta</span>{" "}
                  {formatDateTimeFullBR(os.created_at)}
                </p>
                <p>
                  <span className="text-ink-faint">Agendada</span>{" "}
                  {formatDateTimeFullBR(os.scheduled_at)}
                </p>
                <p>
                  <span className="text-ink-faint">Concluída</span>{" "}
                  {formatDateTimeFullBR(os.concluded_at)}
                </p>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <OsWorkspace
        demo={isDemoMode}
        role={me.role}
        canExecute={canExecute}
        technicians={(technicians?.data ?? []).map((t) => ({
          id: t.id,
          label: t.full_name,
        }))}
        technicianError={technicians?.error ?? null}
        evidenceError={evidence.error}
        timeline={<TimelineCard os={os} />}
        os={{
          id: os.id,
          numero: os.numero,
          status: os.status,
          technicianId: os.technician_id,
          scheduledAt: os.scheduled_at,
          checkinAt: os.checkin_at,
          checkinLat: os.checkin_lat,
          checkinLng: os.checkin_lng,
          template: os.checklist_template
            ? { nome: os.checklist_template.nome, itens: os.checklist_template.itens }
            : null,
          respostas: os.checklist_respostas ?? {},
          laudo: os.laudo ?? "",
          observacoes: os.observacoes_tecnicas ?? "",
          assinatura: {
            path: os.assinatura_path,
            url: evidence.data?.assinaturaUrl ?? null,
            nome: os.assinado_por_nome ?? null,
            em: os.assinado_em ?? null,
          },
          photos: evidence.data?.photos ?? [],
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Timeline vertical do ciclo da OS
// ---------------------------------------------------------------------------

type TimelineStep = {
  label: string
  detail: string | null
  done: boolean
}

function TimelineCard({ os }: { os: ServiceOrderWithRelations }) {
  const cancelada = os.status === "cancelado"
  const steps: TimelineStep[] = [
    {
      label: "Chamado aberto",
      detail: `${formatDateTimeFullBR(os.created_at)} · ${OS_ORIGIN_META[os.origem].label.toLowerCase()}`,
      done: true,
    },
    {
      label: "Visita agendada",
      detail: os.scheduled_at
        ? `${formatDateTimeFullBR(os.scheduled_at)}${os.technician ? ` · ${os.technician.full_name}` : ""}`
        : null,
      done: os.scheduled_at !== null,
    },
    {
      label: "Check-in em campo",
      detail: os.checkin_at
        ? `${formatDateTimeFullBR(os.checkin_at)}${
            os.checkin_lat !== null && os.checkin_lng !== null
              ? ` · ${os.checkin_lat.toFixed(4)}, ${os.checkin_lng.toFixed(4)}`
              : ""
          }`
        : null,
      done: os.checkin_at !== null,
    },
    {
      label: "Serviço concluído",
      detail: os.concluded_at
        ? `${formatDateTimeFullBR(os.concluded_at)} · ${formatHourBR(os.concluded_at)}`
        : null,
      done: os.concluded_at !== null,
    },
  ]

  return (
    <Card size="sm" className="border border-line bg-console ring-0">
      <CardHeader>
        <CardTitle className="text-ink">Ciclo do chamado</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col">
          {steps.map((step, i) => (
            <li key={step.label} className="relative flex gap-3 pb-6 last:pb-0">
              {i < steps.length - 1 && (
                <span
                  className={cn(
                    "absolute top-6 left-[11px] h-[calc(100%-1.5rem)] w-px",
                    step.done ? "bg-signal/40" : "bg-line",
                  )}
                  aria-hidden="true"
                />
              )}
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border",
                  step.done
                    ? "border-transparent bg-signal-dim text-signal"
                    : "border-line bg-console-2 text-ink-faint",
                )}
                aria-hidden="true"
              >
                {step.done ? (
                  <CheckIcon className="size-3.5" />
                ) : (
                  <CircleIcon className="size-2" />
                )}
              </span>
              <div className="min-w-0 pt-0.5">
                <p
                  className={cn(
                    "text-sm font-medium",
                    step.done ? "text-ink" : "text-ink-faint",
                  )}
                >
                  {step.label}
                  {!step.done && (
                    <span className="ml-2 text-xs font-normal text-ink-faint">
                      pendente
                    </span>
                  )}
                </p>
                {step.detail && (
                  <p className="mt-0.5 font-mono text-xs text-ink-dim tabular-nums">
                    {step.detail}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
        {cancelada && (
          <p className="mt-4 rounded-lg border border-danger/30 bg-danger-dim px-3 py-2 text-sm text-danger">
            Chamado cancelado. O ciclo foi interrompido.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function ChamadoBreadcrumb({ label }: { label: string }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink
            render={<Link href="/chamados" />}
            className="inline-flex min-h-11 items-center md:min-h-0"
          >
            Chamados
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="max-w-64 truncate font-mono sm:max-w-none">
            {label}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
