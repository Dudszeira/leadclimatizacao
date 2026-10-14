import Link from "next/link"
import { cn } from "cn"
import {
  AirVentIcon,
  ArrowRightIcon,
  Clock3Icon,
  MapPinIcon,
  NavigationIcon,
  UserRoundIcon,
} from "lucide-react"

import type { FieldOrderItem } from "@/lib/types"
import { formatOsNumero } from "@/lib/format"
import { OS_PRIORITY_META, OS_STATUS_META, OS_TYPE_META } from "@/lib/status-meta"
import {
  formatEndereco,
  isOverdue,
  mapsHref,
} from "@/components/chamados/execution-rules"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"

const TZ = "America/Sao_Paulo"
const hourFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })
const dayFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
})

function hora(iso: string): string {
  return hourFmt.format(new Date(iso)).replace(":", "h")
}

function quando(os: FieldOrderItem, mode: "hoje" | "proximas" | "andamento", now: Date): string {
  if (mode === "andamento") {
    return os.checkin_at ? `Check-in às ${hora(os.checkin_at)}` : "Em atendimento"
  }
  if (!os.scheduled_at) return "Sem data marcada"
  if (mode === "hoje") {
    return isOverdue(os.scheduled_at, now)
      ? `Era ${dayFmt.format(new Date(os.scheduled_at))} · ${hora(os.scheduled_at)}`
      : `Hoje · ${hora(os.scheduled_at)}`
  }
  return `${dayFmt.format(new Date(os.scheduled_at))} · ${hora(os.scheduled_at)}`
}

type FieldOrderCardProps = {
  os: FieldOrderItem
  mode: "hoje" | "proximas" | "andamento"
  now: Date
  showTechnician?: boolean
}

/** Card mobile-first da OS: tudo o que o técnico precisa para chegar e começar. */
export function FieldOrderCard({ os, mode, now, showTechnician }: FieldOrderCardProps) {
  const tipoMeta = OS_TYPE_META[os.tipo]
  const prioridadeMeta = OS_PRIORITY_META[os.prioridade]
  const statusMeta = OS_STATUS_META[os.status]
  const cliente = os.building.client.nome_fantasia ?? os.building.client.razao_social
  const endereco = formatEndereco(os.building)
  const mapa = mapsHref(os.building)
  const atrasada = mode === "hoje" && isOverdue(os.scheduled_at, now)
  const emCampo = os.status === "em_campo"

  return (
    <article
      aria-labelledby={`os-${os.id}-titulo`}
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-console p-4",
        emCampo ? "border-signal/40" : atrasada ? "border-amber/40" : "border-line",
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-medium text-signal tabular-nums">
            {formatOsNumero(os.numero)}
          </span>
          <Badge variant="outline" className={cn("font-medium", tipoMeta.badgeClassName)}>
            {tipoMeta.label}
          </Badge>
          <span className="flex items-center gap-1.5 text-xs text-ink-dim">
            <span
              className={cn("size-2 rounded-full", prioridadeMeta.dotClassName)}
              aria-hidden="true"
            />
            {prioridadeMeta.label}
          </span>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 font-medium",
            atrasada ? "border-amber/40 bg-amber-dim text-amber" : statusMeta.badgeClassName,
          )}
        >
          {atrasada ? "Atrasada" : statusMeta.label}
        </Badge>
      </header>

      <div className="min-w-0">
        <h3 id={`os-${os.id}-titulo`} className="truncate text-base font-semibold text-ink">
          {cliente}
        </h3>
        <p className="truncate text-sm text-ink-dim">{os.building.nome}</p>
      </div>

      <ul className="flex flex-col gap-1.5 text-sm text-ink-dim">
        <li className="flex items-center gap-2">
          <Clock3Icon className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
          <span className={cn("font-mono tabular-nums", atrasada && "text-amber")}>
            {quando(os, mode, now)}
          </span>
        </li>
        <li className="flex items-start gap-2">
          <MapPinIcon className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden="true" />
          <span className="min-w-0">{endereco || "Endereço não cadastrado"}</span>
        </li>
        {os.equipment && (
          <li className="flex items-center gap-2">
            <AirVentIcon className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
            <span className="min-w-0 truncate">
              <span className="font-mono text-ink">{os.equipment.codigo_interno}</span>
              {os.equipment.ambiente ? ` — ${os.equipment.ambiente}` : ""}
            </span>
          </li>
        )}
        {showTechnician && (
          <li className="flex items-center gap-2">
            <UserRoundIcon className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
            <span className="truncate">{os.technician?.full_name ?? "A designar"}</span>
          </li>
        )}
      </ul>

      {os.descricao && (
        <p className="line-clamp-2 text-sm leading-relaxed text-ink-faint">{os.descricao}</p>
      )}

      <div className="flex flex-col gap-2">
        {mapa && (
          <a
            href={mapa}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline" }), "h-12 w-full text-sm")}
            aria-label={`Abrir no mapa: ${cliente}, ${endereco}`}
          >
            <NavigationIcon aria-hidden="true" />
            Abrir no mapa
          </a>
        )}
        <Link
          href={`/chamados/${os.id}`}
          className={cn(buttonVariants(), "h-14 w-full text-base")}
          aria-label={`${emCampo ? "Continuar" : "Abrir"} execução da OS ${formatOsNumero(os.numero)}`}
        >
          {emCampo ? "Continuar execução" : "Abrir execução"}
          <ArrowRightIcon aria-hidden="true" />
        </Link>
      </div>
    </article>
  )
}
