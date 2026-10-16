import type { Metadata } from "next"
import Link from "next/link"
import { cn } from "cn"
import { CalendarCheck2Icon } from "lucide-react"

import type { FieldOrderItem } from "@/lib/types"
import { requireRole } from "@/server/auth"
import { listTechnicians } from "@/server/profiles"
import { listFieldOrders } from "@/server/service-orders"
import { groupFieldOrders } from "@/components/chamados/execution-rules"
import { FieldOrderCard } from "@/components/campo/field-order-card"
import { DataError } from "@/components/data-error"
import { EmptyState } from "@/components/empty-state"

export const metadata: Metadata = {
  title: "Minhas OS",
}

const TZ = "America/Sao_Paulo"
const todayFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
})

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/**
 * App de campo (técnico e admin): OS ativas em cards, agrupadas por
 * Em andamento / Hoje / Próximas. Técnico vê só as dele; admin escolhe o
 * técnico (padrão: todos).
 */
export default async function CampoPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireRole("tecnico", "admin")
  const sp = await searchParams
  const isAdmin = me.role === "admin"
  const filtroTecnico =
    isAdmin && typeof sp.tecnico === "string" && /^[0-9a-f-]{36}$/i.test(sp.tecnico)
      ? sp.tecnico
      : undefined
  const technicianId = isAdmin ? filtroTecnico : me.id

  const [result, technicians] = await Promise.all([
    listFieldOrders({ technicianId }),
    isAdmin ? listTechnicians() : Promise.resolve(null),
  ])

  const now = new Date()
  const hojeLabel = todayFmt.format(now)

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5">
      <header>
        <h2 className="font-display text-xl font-bold tracking-tight text-ink">
          {isAdmin && !filtroTecnico ? "OS em campo" : "Minhas OS"}
        </h2>
        <p className="mt-1 text-sm text-ink-dim first-letter:uppercase">{hojeLabel}</p>
      </header>

      {isAdmin && technicians?.data && technicians.data.length > 0 && (
        <nav aria-label="Filtrar por técnico" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <ul className="flex w-max gap-2">
            {[{ id: "", full_name: "Todos" }, ...technicians.data].map((t) => {
              const active = (t.id || undefined) === filtroTecnico
              return (
                <li key={t.id || "todos"}>
                  <Link
                    href={t.id ? `/campo?tecnico=${t.id}` : "/campo"}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors",
                      active
                        ? "border-signal/40 bg-signal-dim text-signal"
                        : "border-line bg-console text-ink-dim hover:text-ink",
                    )}
                  >
                    {t.full_name}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      )}

      {result.error !== null ? (
        <DataError message={result.error} />
      ) : (
        <FieldGroups items={result.data} now={now} showTechnician={isAdmin && !filtroTecnico} />
      )}
    </div>
  )
}

function FieldGroups({
  items,
  now,
  showTechnician,
}: {
  items: FieldOrderItem[]
  now: Date
  showTechnician: boolean
}) {
  const groups = groupFieldOrders(items, now)
  const total = groups.emAndamento.length + groups.hoje.length + groups.proximas.length

  if (total === 0) {
    return (
      <EmptyState
        icon={CalendarCheck2Icon}
        title="Nenhuma OS pendente"
        description="Quando o escritório atribuir uma ordem de serviço a você, ela aparece aqui com endereço e acesso à execução."
      />
    )
  }

  const sections = [
    { key: "andamento" as const, titulo: "Em andamento", items: groups.emAndamento },
    { key: "hoje" as const, titulo: "Hoje", items: groups.hoje },
    { key: "proximas" as const, titulo: "Próximas", items: groups.proximas },
  ]

  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) =>
        section.items.length === 0 ? null : (
          <section key={section.key} aria-labelledby={`campo-${section.key}`} className="flex flex-col gap-3">
            <h3
              id={`campo-${section.key}`}
              className="flex items-center justify-between text-xs font-medium tracking-wider text-ink-faint uppercase"
            >
              {section.titulo}
              <span className="font-mono tabular-nums">{section.items.length}</span>
            </h3>
            {section.items.map((os) => (
              <FieldOrderCard
                key={os.id}
                os={os}
                mode={section.key}
                now={now}
                showTechnician={showTechnician}
              />
            ))}
          </section>
        ),
      )}
    </div>
  )
}
