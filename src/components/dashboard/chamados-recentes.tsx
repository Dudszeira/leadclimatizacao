import type { CSSProperties } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowRightIcon, InboxIcon } from "lucide-react"
import { cn } from "cn"

import { Badge } from "@/components/ui/badge"
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

function pillDoChamado(os: ServiceOrderListItem): { label: string; className: string } {
  if (os.prioridade === "urgente") {
    return { label: "Urgente", className: "bg-danger-dim text-danger" }
  }
  if (os.status === "agendado") {
    return { label: "Agendado", className: "bg-signal-dim text-signal" }
  }
  return { label: "Aberto", className: "bg-amber-dim text-amber" }
}

function nomeDoCliente(os: ServiceOrderListItem): string {
  return os.building.client.nome_fantasia ?? os.building.client.razao_social
}

/** Lista "Chamados recentes": próximas OS agendadas, com atalho para /chamados. */
export async function ChamadosRecentes() {
  const result = await getProximosChamados(5)

  return (
    <Card className="console-enter h-full" style={{ "--enter-delay": "0.06s" } as CSSProperties}>
      <CardHeader>
        <CardTitle>Chamados recentes</CardTitle>
        <CardDescription>Próximas visitas técnicas agendadas</CardDescription>
        <CardAction>
          <Link
            href="/chamados"
            aria-label="Ver todos os chamados"
            className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-signal outline-ring/50 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Ver todos
            <ArrowRightIcon className="size-3.5" aria-hidden="true" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {result.error !== null ? (
          <DataError message={result.error} compact />
        ) : result.data.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
            <InboxIcon className="size-6 text-ink-faint" aria-hidden="true" />
            <p className="text-sm text-ink-dim">Nenhum chamado agendado no momento.</p>
          </div>
        ) : (
          <ul aria-label="Próximos chamados agendados" className="flex flex-col">
            {result.data.map((os) => {
              const pill = pillDoChamado(os)
              return (
                <li
                  key={os.id}
                  className="flex items-center justify-between gap-3 border-b border-line-soft py-2.5 first:pt-0 last:border-b-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      <span className="font-mono text-xs text-ink-faint tabular-nums">
                        #{os.numero}
                      </span>{" "}
                      {os.descricao ?? "Chamado sem descrição"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-ink-faint">
                      {nomeDoCliente(os)} · {os.building.nome}
                      {os.scheduled_at
                        ? ` · ${format(new Date(os.scheduled_at), "EEE dd/MM · HH'h'", { locale: ptBR })}`
                        : ""}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn("shrink-0 border-transparent", pill.className)}
                  >
                    {pill.label}
                  </Badge>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
