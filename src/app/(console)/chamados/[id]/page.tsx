import { cache, type ReactNode } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { cn } from "cn"
import {
  AirVentIcon,
  BotIcon,
  CalendarClockIcon,
  CheckIcon,
  ChevronLeftIcon,
  CircleIcon,
  MapPinIcon,
  NavigationIcon,
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
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatDateTimeFullBR, formatOsNumero } from "@/lib/format"
import { EQUIPMENT_TYPE_LABELS, OS_ORIGIN_META } from "@/lib/status-meta"
import { formatEndereco, mapsHref } from "@/components/chamados/execution-rules"
import { OsWorkspace } from "@/components/chamados/execucao/os-workspace"
import { PriorityPill, StatusPill, TypePill } from "@/components/chamados/os-pills"
import { DataError } from "@/components/data-error"
import { PageHeader } from "@/components/page-header"

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
      <div className="flex flex-1 flex-col">
        <BackLink />
        <PageHeader title="Chamado" />
        <DataError message={result.error} />
      </div>
    )
  }
  if (!result.data) notFound()

  const os = result.data
  // Técnico só enxerga a OS atribuída a ele (a RLS já filtra; aqui é defesa extra).
  if (me.role === "tecnico" && os.technician_id !== me.id && !isDemoMode) notFound()
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
    <div className="flex flex-1 flex-col">
      <BackLink />
      <PageHeader
        title={`OS ${formatOsNumero(os.numero)}`}
        description={
          <Link
            href={`/clientes/${os.building.client.id}`}
            className="underline-offset-4 hover:text-ink hover:underline"
            aria-label={`${clienteNome}: abrir cliente no CRM`}
          >
            {clienteNome}
          </Link>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={os.status} />
          <PriorityPill prioridade={os.prioridade} />
          <TypePill tipo={os.tipo} />
          <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-console-2 px-2.5 text-xs text-ink-dim">
            <OrigemIcon className="size-3.5 text-ink-faint" aria-hidden="true" />
            {origemMeta.label}
          </span>
        </div>
      </PageHeader>

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
        summary={<SummaryCard os={os} />}
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
// Resumo: o que o técnico precisa para chegar e saber o que fazer
// ---------------------------------------------------------------------------

function SummaryCard({ os }: { os: ServiceOrderWithRelations }) {
  const endereco = formatEndereco(os.building)
  const mapa = mapsHref(os.building)
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        {os.descricao && (
          <div className="flex flex-col gap-1">
            <p className="text-[0.8125rem] text-ink-faint">Problema relatado</p>
            <p className="text-[0.9375rem] leading-relaxed text-ink">{os.descricao}</p>
          </div>
        )}
        <dl className="flex flex-col divide-y divide-line-soft">
          <SummaryRow icon={MapPinIcon} label="Local">
            <span className="block truncate text-ink">{os.building.nome}</span>
            <span className="block text-[0.8125rem] leading-snug text-ink-dim">
              {endereco || "Endereço não cadastrado"}
            </span>
            {mapa && (
              <a
                href={mapa}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-2.5")}
              >
                <NavigationIcon aria-hidden="true" />
                Abrir no mapa
              </a>
            )}
          </SummaryRow>
          <SummaryRow icon={AirVentIcon} label="Equipamento">
            {os.equipment ? (
              <>
                <span className="block truncate text-ink">{os.equipment.codigo_interno}</span>
                <span className="block truncate text-[0.8125rem] text-ink-dim">
                  {[EQUIPMENT_TYPE_LABELS[os.equipment.tipo], os.equipment.ambiente]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </>
            ) : (
              <span className="text-ink-faint">Sem equipamento vinculado</span>
            )}
          </SummaryRow>
          <div className="grid grid-cols-2 gap-3 pt-3">
            <div className="min-w-0">
              <dt className="flex items-center gap-1.5 text-[0.8125rem] text-ink-faint">
                <UserRoundIcon className="size-3.5" aria-hidden="true" />
                Técnico
              </dt>
              <dd className="mt-1 truncate text-sm text-ink">
                {os.technician ? (
                  os.technician.full_name
                ) : (
                  <span className="text-ink-faint">A designar</span>
                )}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="flex items-center gap-1.5 text-[0.8125rem] text-ink-faint">
                <CalendarClockIcon className="size-3.5" aria-hidden="true" />
                Agendamento
              </dt>
              <dd className="mt-1 text-sm text-ink tabular-nums">
                {os.scheduled_at ? formatDateTimeFullBR(os.scheduled_at) : "Sem data"}
              </dd>
            </div>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}

function SummaryRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <span
        className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-console-2"
        aria-hidden="true"
      >
        <Icon className="size-4 text-ink-dim" />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-[0.8125rem] text-ink-faint">{label}</dt>
        <dd className="mt-0.5 text-sm">{children}</dd>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ciclo da OS (linha do tempo vertical)
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
      detail: `${formatDateTimeFullBR(os.created_at)}, ${OS_ORIGIN_META[os.origem].label.toLowerCase()}`,
      done: true,
    },
    {
      label: "Visita agendada",
      detail: os.scheduled_at
        ? `${formatDateTimeFullBR(os.scheduled_at)}${os.technician ? `, ${os.technician.full_name}` : ""}`
        : null,
      done: os.scheduled_at !== null,
    },
    {
      label: "Check-in em campo",
      detail: os.checkin_at
        ? `${formatDateTimeFullBR(os.checkin_at)}${
            os.checkin_lat !== null && os.checkin_lng !== null
              ? `, ${os.checkin_lat.toFixed(4)}, ${os.checkin_lng.toFixed(4)}`
              : ""
          }`
        : null,
      done: os.checkin_at !== null,
    },
    {
      label: "Serviço concluído",
      detail: os.concluded_at ? formatDateTimeFullBR(os.concluded_at) : null,
      done: os.concluded_at !== null,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ciclo do chamado</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col">
          {steps.map((step, i) => (
            <li key={step.label} className="relative flex gap-3 pb-5 last:pb-0">
              {i < steps.length - 1 && (
                <span
                  className={cn(
                    "absolute top-7 left-[13px] h-[calc(100%-1.75rem)] w-px",
                    step.done ? "bg-clear/35" : "bg-line",
                  )}
                  aria-hidden="true"
                />
              )}
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full",
                  step.done ? "bg-clear-dim text-clear" : "bg-console-2 text-ink-faint",
                )}
                aria-hidden="true"
              >
                {step.done ? (
                  <CheckIcon className="size-3.5" />
                ) : (
                  <CircleIcon className="size-2" />
                )}
              </span>
              <div className="min-w-0 pt-1">
                <p
                  className={cn(
                    "text-sm font-medium",
                    step.done ? "text-ink" : "text-ink-faint",
                  )}
                >
                  {step.label}
                  {!step.done && (
                    <span className="ml-2 text-xs font-normal text-ink-faint">pendente</span>
                  )}
                </p>
                {step.detail && (
                  <p className="mt-0.5 text-[0.8125rem] text-ink-dim tabular-nums">
                    {step.detail}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
        {cancelada && (
          <p className="mt-4 rounded-2xl bg-console-2 px-4 py-3 text-sm text-ink-dim">
            Chamado cancelado. O ciclo foi interrompido.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function BackLink() {
  return (
    <Link
      href="/chamados"
      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 mb-3 w-fit md:-ml-3")}
    >
      <ChevronLeftIcon aria-hidden="true" />
      Chamados
    </Link>
  )
}
