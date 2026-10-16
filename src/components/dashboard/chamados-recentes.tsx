import type { CSSProperties } from "react"
import Link from "next/link"
import { ChevronRightIcon, InboxIcon } from "lucide-react"
import { cn } from "cn"

import { formatAgendaCurtaBR } from "@/lib/format"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { ServiceOrderListItem } from "@/lib/types"
import { getProximosChamados } from "@/server/dashboard"
import { DataError } from "@/components/data-error"

/** Agendado é o normal desta lista: só destaca o que foge dele. */
function pillDoChamado(os: ServiceOrderListItem): { label: string; className: string } | null {
  if (os.prioridade === "urgente") {
    return { label: "Urgente", className: "bg-danger-dim text-danger" }
  }
  if (os.status === "agendado") return null
  return { label: "Aguardando", className: "bg-amber-dim text-amber" }
}

function nomeDoCliente(os: ServiceOrderListItem): string {
  return os.building.client.nome_fantasia ?? os.building.client.razao_social
}

/** "sáb 17/10 · 07h" → ["sáb 17/10", "07h"]. */
function agenda(iso: string | null): { dia: string; hora: string } | null {
  if (!iso) return null
  const [dia, hora] = formatAgendaCurtaBR(iso).split(" · ")
  return dia && hora ? { dia, hora } : null
}

/** Lista lateral "Próximas visitas": as próximas OS agendadas. */
export async function ChamadosRecentes({ className }: { className?: string }) {
  const result = await getProximosChamados(6)

  return (
    <Card
      className={cn("console-enter", className)}
      style={{ "--enter-delay": "0.06s" } as CSSProperties}
    >
      <CardHeader>
        <CardTitle>Próximas visitas</CardTitle>
        <CardDescription>Agendadas a partir de agora</CardDescription>
        <CardAction>
          <Link
            href="/chamados"
            className="-mr-2 inline-flex h-11 items-center gap-1 rounded-full px-2 text-sm font-medium text-ink-dim outline-none transition-colors hover:text-ink focus-visible:ring-[3px] focus-visible:ring-ring/50 md:h-8"
          >
            Ver todos
            <ChevronRightIcon className="size-4" aria-hidden="true" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {result.error !== null ? (
          <DataError message={result.error} compact />
        ) : result.data.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
            <InboxIcon className="size-6 text-ink-faint" aria-hidden="true" />
            <p className="text-sm text-ink-dim">
              Nenhuma visita agendada. Agende pelos chamados abertos.
            </p>
          </div>
        ) : (
          <ul aria-label="Próximas visitas agendadas" className="-mx-2 divide-y divide-line-soft">
            {result.data.map((os) => {
              const pill = pillDoChamado(os)
              const quando = agenda(os.scheduled_at)
              return (
                <li key={os.id}>
                  <Link
                    href={`/chamados/${os.id}`}
                    className="flex min-h-14 items-start gap-3 rounded-2xl px-2 py-3 outline-none transition-colors duration-200 hover:bg-console-2 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <div className="flex w-[4.5rem] shrink-0 flex-col pt-px tabular-nums">
                      {quando ? (
                        <>
                          <span className="text-[0.8125rem] font-medium text-ink">
                            {quando.dia}
                          </span>
                          <span className="text-xs text-ink-faint">{quando.hora}</span>
                        </>
                      ) : (
                        <span className="text-xs text-ink-faint">Sem data</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm leading-snug font-medium text-ink">
                        {os.descricao ?? "Chamado sem descrição"}
                      </p>
                      <p className="mt-0.5 truncate text-[0.8125rem] text-ink-faint">
                        <span className="font-medium text-ink-dim tabular-nums">
                          #{os.numero}
                        </span>{" "}
                        {nomeDoCliente(os)}, {os.building.nome}
                      </p>
                    </div>
                    {pill ? (
                      <span
                        className={cn(
                          "inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-medium",
                          pill.className
                        )}
                      >
                        {pill.label}
                      </span>
                    ) : (
                      <ChevronRightIcon
                        className="mt-0.5 size-4 shrink-0 text-ink-faint"
                        aria-hidden="true"
                      />
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
