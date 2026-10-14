import type { Metadata } from "next"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ShieldCheckIcon } from "lucide-react"

import { isDemoMode } from "@/lib/env"
import { requireRole } from "@/server/auth"
import { listTeam, type TeamMember } from "@/server/profiles"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DataError } from "@/components/data-error"
import { EmptyState } from "@/components/empty-state"
import { InviteDialog } from "./invite-dialog"
import { MemberActions } from "./member-actions"

export const metadata: Metadata = {
  title: "Equipe",
}

function StatusBadge({ member }: { member: TeamMember }) {
  if (!member.ativo) {
    return (
      <Badge variant="outline" className="border-line font-mono text-[10px] tracking-wider text-ink-faint uppercase">
        Inativo
      </Badge>
    )
  }
  if (member.pendingInvite) {
    return (
      <Badge variant="outline" className="border-amber/30 bg-amber-dim font-mono text-[10px] tracking-wider text-amber uppercase">
        Convite pendente
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="border-clear/30 bg-clear-dim font-mono text-[10px] tracking-wider text-clear uppercase">
      Ativo
    </Badge>
  )
}

function lastAccess(iso: string | null): string {
  if (!iso) return "—"
  return format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: ptBR })
}

export default async function EquipePage() {
  const me = await requireRole("admin")
  const result = await listTeam()

  const counts = result.data
    ? {
        total: result.data.length,
        ativos: result.data.filter((m) => m.ativo).length,
        tecnicos: result.data.filter((m) => m.ativo && m.role === "tecnico").length,
      }
    : null

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] tracking-[0.18em] text-ink-faint uppercase">
            Acessos ao console
          </p>
          <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-ink">
            Equipe e permissões
          </h2>
          <p className="mt-1 max-w-xl text-sm text-ink-dim">
            Quem se cadastra entra como técnico inativo. Libere o acesso e defina o papel aqui.
            {isDemoMode ? " Em modo demonstração as alterações não são gravadas." : ""}
          </p>
        </div>
        <InviteDialog />
      </div>

      {counts && (
        <dl className="grid grid-cols-3 gap-3 sm:max-w-md">
          {[
            ["Pessoas", counts.total],
            ["Ativas", counts.ativos],
            ["Técnicos ativos", counts.tecnicos],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-line bg-console px-3 py-2.5">
              <dt className="font-mono text-[10px] tracking-wider text-ink-faint uppercase">{label}</dt>
              <dd className="mt-1 font-mono text-lg font-semibold text-ink tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {result.error !== null ? (
        <DataError message={result.error} />
      ) : result.data.length === 0 ? (
        <EmptyState
          icon={ShieldCheckIcon}
          title="Nenhuma pessoa cadastrada"
          description="Convide a equipe por e-mail para liberar o acesso ao console."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-console">
          <Table>
            <TableHeader>
              <TableRow className="border-line hover:bg-transparent">
                <TableHead className="font-mono text-[10px] tracking-wider uppercase">Pessoa</TableHead>
                <TableHead className="font-mono text-[10px] tracking-wider uppercase max-md:hidden">
                  Situação
                </TableHead>
                <TableHead className="font-mono text-[10px] tracking-wider uppercase max-lg:hidden">
                  Último acesso
                </TableHead>
                <TableHead className="text-right font-mono text-[10px] tracking-wider uppercase">
                  Papel e acesso
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((member) => {
                const isSelf = member.id === me.id
                return (
                  <TableRow key={member.id} className="border-line-soft">
                    <TableCell className="max-w-[260px]">
                      <div className="flex flex-col">
                        <span className="truncate font-medium text-ink">
                          {member.full_name}
                          {isSelf ? <span className="ml-2 text-xs text-ink-faint">(você)</span> : null}
                        </span>
                        <span className="truncate font-mono text-xs text-ink-faint">
                          {member.email ?? "sem e-mail"}
                        </span>
                        <span className="mt-1 md:hidden">
                          <StatusBadge member={member} />
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-md:hidden">
                      <StatusBadge member={member} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-ink-dim tabular-nums max-lg:hidden">
                      {lastAccess(member.lastSignInAt)}
                    </TableCell>
                    <TableCell>
                      <MemberActions
                        member={{
                          id: member.id,
                          full_name: member.full_name,
                          role: member.role,
                          ativo: member.ativo,
                        }}
                        isSelf={isSelf}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
