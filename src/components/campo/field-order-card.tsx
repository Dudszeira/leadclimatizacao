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
import { OS_TYPE_META } from "@/lib/status-meta"
import {
  formatEndereco,
  isOverdue,
  mapsHref,
} from "@/components/chamados/execution-rules"
import { buttonVariants } from "@/components/ui/button"
import { PriorityPill, StatusPill } from "@/components/chamados/os-pills"

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
      ? `Era ${dayFmt.format(new Date(os.scheduled_at))}, ${hora(os.scheduled_at)}`
      : `Hoje, ${hora(os.scheduled_at)}`
  }
  return `${dayFmt.format(new Date(os.scheduled_at))}, ${hora(os.scheduled_at)}`
}

type FieldOrderCardProps = {
  os: FieldOrderItem
  mode: "hoje" | "proximas" | "andamento"
  now: Date
  showTechnician?: boolean
}

/** Card mobile-first da OS: tudo o que o técnico precisa para chegar e começar. */
export function FieldOrderCard({ os, mode, now, showTechnician }: FieldOrderCardProps) {
  const cliente = os.building.client.nome_fantasia ?? os.building.client.razao_social
  const endereco = formatEndereco(os.building)
  const mapa = mapsHref(os.building)
  const atrasada = mode === "hoje" && isOverdue(os.scheduled_at, now)
  const emCampo = os.status === "em_campo"

  return (
    <article
      aria-labelledby={`os-${os.id}-titulo`}
      className="flex flex-col gap-4 rounded-[1.375rem] bg-console p-4 ring-1 ring-line md:p-5"
    >
      <header className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-[0.8125rem]">
          <span className="font-medium text-ink-dim tabular-nums">{formatOsNumero(os.numero)}</span>
          <span className="truncate text-ink-faint">{OS_TYPE_META[os.tipo].label}</span>
        </span>
        <StatusPill status={os.status} atrasada={atrasada} />
      </header>

      <div className="min-w-0">
        <h3
          id={`os-${os.id}-titulo`}
          className="truncate font-display text-[1.1875rem] leading-snug font-medium tracking-[-0.02em] text-ink"
        >
          {cliente}
        </h3>
        <p className="truncate text-sm text-ink-dim">{os.building.nome}</p>
      </div>

      <ul className="flex flex-col gap-2.5 text-sm text-ink-dim">
        <li className="flex items-center gap-2.5">
          <Clock3Icon
            className={cn("size-4 shrink-0", atrasada ? "text-amber" : "text-ink-faint")}
            aria-hidden="true"
          />
          <span className={cn("tabular-nums", atrasada ? "text-amber" : "text-ink")}>
            {quando(os, mode, now)}
          </span>
          {os.prioridade !== "media" && os.prioridade !== "baixa" && (
            <PriorityPill prioridade={os.prioridade} className="ml-auto" />
          )}
        </li>
        <li className="flex items-start gap-2.5">
          <MapPinIcon className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden="true" />
          <span className="min-w-0 leading-snug">{endereco || "Endereço não cadastrado"}</span>
        </li>
        {os.equipment && (
          <li className="flex items-center gap-2.5">
            <AirVentIcon className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
            <span className="min-w-0 truncate">
              <span className="text-ink">{os.equipment.codigo_interno}</span>
              {os.equipment.ambiente ? `, ${os.equipment.ambiente}` : ""}
            </span>
          </li>
        )}
        {showTechnician && (
          <li className="flex items-center gap-2.5">
            <UserRoundIcon className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
            <span className="truncate">{os.technician?.full_name ?? "A designar"}</span>
          </li>
        )}
      </ul>

      {os.descricao && (
        <div className="rounded-2xl bg-console-2 px-3.5 py-2.5">
          <p className="line-clamp-2 text-sm leading-relaxed text-ink-dim">{os.descricao}</p>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2">
        {mapa && (
          <a
            href={mapa}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "w-full")}
            aria-label={`Abrir no mapa: ${cliente}, ${endereco}`}
          >
            <NavigationIcon aria-hidden="true" />
            Abrir no mapa
          </a>
        )}
        <Link
          href={`/chamados/${os.id}`}
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
          aria-label={`${emCampo ? "Continuar" : "Abrir"} execução da OS ${formatOsNumero(os.numero)}`}
        >
          {emCampo ? "Continuar execução" : "Abrir execução"}
          <ArrowRightIcon aria-hidden="true" />
        </Link>
      </div>
    </article>
  )
}
