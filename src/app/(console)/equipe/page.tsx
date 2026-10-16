import type { Metadata } from "next"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ShieldCheckIcon } from "lucide-react"
import { cn } from "cn"

import { isDemoMode } from "@/lib/env"
import { ROLE_LABELS } from "@/lib/nav"
import { requireRole } from "@/server/auth"
import { listTeam, type TeamMember } from "@/server/profiles"
import { DataError } from "@/components/data-error"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { InviteDialog } from "./invite-dialog"
import { MemberActions } from "./member-actions"

export const metadata: Metadata = {
  title: "Equipe",
}

const PILL =
  "inline-flex h-6 w-fit shrink-0 items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap"

function StatusPill({ member }: { member: TeamMember }) {
  if (!member.ativo) {
    return <span className={cn(PILL, "bg-console-2 text-ink-faint")}>Inativo</span>
  }
  if (member.pendingInvite) {
    return <span className={cn(PILL, "bg-amber-dim text-amber")}>Convite pendente</span>
  }
  return <span className={cn(PILL, "bg-clear-dim text-clear")}>Ativo</span>
}

function RolePill({ member }: { member: TeamMember }) {
  return (
    <span className={cn(PILL, "bg-console-2 text-ink-dim")}>{ROLE_LABELS[member.role]}</span>
  )
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  const first = parts[0][0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : ""
  return (first + last).toUpperCase()
}

function lastAccess(iso: string | null): string {
  if (!iso) return "Nunca acessou"
  return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
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
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Equipe"
        description={
          <>
            Quem se cadastra entra como técnico inativo. Libere o acesso e
            defina o papel aqui.
            {isDemoMode ? " Em modo demonstração as alterações não são gravadas." : ""}
          </>
        }
        actions={<InviteDialog />}
      />

      <div className="flex flex-1 flex-col gap-6 md:gap-8">
        {counts && (
          <dl className="grid grid-cols-3 divide-x divide-line-soft rounded-[1.375rem] bg-console py-4 ring-1 ring-line md:max-w-xl md:py-5">
            {(
              [
                ["Pessoas", counts.total],
                ["Com acesso", counts.ativos],
                ["Técnicos", counts.tecnicos],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex min-w-0 flex-col-reverse gap-2 px-4 md:px-5">
                <dt className="truncate text-[0.8125rem] text-ink-dim">{label}</dt>
                <dd className="font-display text-[1.75rem] leading-none font-medium tracking-[-0.03em] text-ink tabular-nums md:text-[2rem]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {result.error !== null ? (
          <DataError message={result.error} />
        ) : result.data.length === 0 ? (
          <EmptyState
            icon={ShieldCheckIcon}
            title="Ninguém na equipe ainda"
            description="Convide as pessoas por e-mail. Elas recebem um link para criar a senha e já entram com o papel escolhido."
          />
        ) : (
          <section aria-labelledby="equipe-lista" className="flex flex-col gap-3">
            <h2
              id="equipe-lista"
              className="font-heading text-[1.0625rem] font-medium tracking-[-0.01em] text-ink"
            >
              Pessoas
            </h2>
            <div className="overflow-hidden rounded-[1.375rem] bg-console ring-1 ring-line">
              <div
                aria-hidden="true"
                className="hidden h-11 items-center gap-4 border-b border-line-soft pr-16 pl-5 text-[0.8125rem] text-ink-faint md:flex"
              >
                <span className="flex-1">Pessoa</span>
                <span className="w-32">Papel</span>
                <span className="w-36">Situação</span>
                <span className="hidden w-44 lg:block">Último acesso</span>
              </div>
              <ul className="divide-y divide-line-soft">
                {result.data.map((member) => {
                  const isSelf = member.id === me.id
                  return (
                    <li
                      key={member.id}
                      className={cn(
                        "flex items-center gap-3 py-3 pr-1.5 pl-4 md:gap-4 md:pr-3 md:pl-5",
                        !member.ativo && "[&_[data-avatar]]:opacity-60",
                      )}
                    >
                      <span
                        data-avatar
                        aria-hidden="true"
                        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-console-2 text-[0.8125rem] font-medium text-ink-dim"
                      >
                        {initials(member.full_name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.9375rem] font-medium text-ink">
                          {member.full_name}
                          {isSelf ? (
                            <span className="ml-1.5 text-[0.8125rem] font-normal text-ink-faint">
                              (você)
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate text-[0.8125rem] text-ink-faint">
                          {member.email ?? "Sem e-mail"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5 md:hidden">
                          <RolePill member={member} />
                          <StatusPill member={member} />
                        </div>
                      </div>
                      <div className="hidden w-32 md:block">
                        <RolePill member={member} />
                      </div>
                      <div className="hidden w-36 md:block">
                        <StatusPill member={member} />
                      </div>
                      <span className="hidden w-44 text-[0.8125rem] text-ink-dim tabular-nums lg:block">
                        {lastAccess(member.lastSignInAt)}
                      </span>
                      <MemberActions
                        member={{
                          id: member.id,
                          full_name: member.full_name,
                          role: member.role,
                          ativo: member.ativo,
                        }}
                        isSelf={isSelf}
                      />
                    </li>
                  )
                })}
              </ul>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
