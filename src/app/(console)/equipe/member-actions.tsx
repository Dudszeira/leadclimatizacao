"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { EllipsisVerticalIcon, LoaderCircleIcon, PowerIcon, PowerOffIcon } from "lucide-react"
import { toast } from "sonner"

import type { UserRole } from "@/lib/types"
import { ROLE_LABELS } from "@/lib/nav"
import { updateMemberAccess } from "@/server/actions/equipe"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const ROLE_ITEMS: Record<UserRole, string> = ROLE_LABELS

const ROLE_RANK: Record<UserRole, number> = { tecnico: 1, atendente: 2, admin: 3 }

const ROLE_SCOPE: Record<UserRole, string> = {
  admin: "tudo, inclusive equipe e financeiro",
  atendente: "clientes, chamados, atendimento e agenda",
  tecnico: "apenas as OS atribuídas a ele, pelo celular",
}

const ITEM = "min-h-11 rounded-xl px-2.5 py-2.5 md:min-h-9 md:py-2"

type MemberActionsProps = {
  member: { id: string; full_name: string; role: UserRole; ativo: boolean }
  isSelf: boolean
}

/** Menu do membro: trocar papel e ativar/desativar (com confirmação quando reduz acesso). */
export function MemberActions({ member, isSelf }: MemberActionsProps) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  // Rebaixar papel pede confirmação: a pessoa perde telas na hora.
  const [downgradeTo, setDowngradeTo] = React.useState<UserRole | null>(null)

  function apply(role: UserRole, ativo: boolean) {
    startTransition(async () => {
      const result = await updateMemberAccess({ userId: member.id, role, ativo })
      if (result.status === "success") {
        toast.success(result.message)
        router.refresh()
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              disabled={pending}
              aria-label={`Acesso de ${member.full_name}`}
              className="text-ink-dim hover:text-ink"
            />
          }
        >
          {pending ? (
            <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
          ) : (
            <EllipsisVerticalIcon aria-hidden="true" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {isSelf ? (
            <p className="px-2.5 py-2 text-[0.8125rem] leading-snug text-ink-dim">
              Você não pode alterar o próprio papel nem desativar o próprio acesso.
            </p>
          ) : (
            <>
              <DropdownMenuGroup>
                <DropdownMenuLabel className="px-2.5 pt-1.5 text-[0.8125rem] font-normal">
                  Papel
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={member.role}
                  onValueChange={(value: string) => {
                    if (!value || value === member.role) return
                    const next = value as UserRole
                    if (ROLE_RANK[next] < ROLE_RANK[member.role]) setDowngradeTo(next)
                    else apply(next, member.ativo)
                  }}
                >
                  {(Object.keys(ROLE_ITEMS) as UserRole[]).map((role) => (
                    <DropdownMenuRadioItem key={role} value={role} className={ITEM} disabled={pending}>
                      {ROLE_ITEMS[role]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              {member.ativo ? (
                <DropdownMenuItem
                  variant="destructive"
                  className={ITEM}
                  disabled={pending}
                  onClick={() => setConfirmOpen(true)}
                >
                  <PowerOffIcon aria-hidden="true" />
                  Desativar acesso
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  className={ITEM}
                  disabled={pending}
                  onClick={() => apply(member.role, true)}
                >
                  <PowerIcon aria-hidden="true" />
                  Ativar acesso
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={downgradeTo !== null} onOpenChange={(open) => !open && setDowngradeTo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reduzir o acesso de {member.full_name}?</DialogTitle>
            <DialogDescription>
              {downgradeTo
                ? `De ${ROLE_ITEMS[member.role]} para ${ROLE_ITEMS[downgradeTo]}. A pessoa passa a ver ${ROLE_SCOPE[downgradeTo]}. Telas abertas deixam de funcionar no próximo carregamento.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDowngradeTo(null)} disabled={pending}>
              Manter {ROLE_ITEMS[member.role]}
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                const next = downgradeTo
                setDowngradeTo(null)
                if (next) apply(next, member.ativo)
              }}
            >
              Reduzir acesso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Desativar {member.full_name}?</DialogTitle>
            <DialogDescription>
              A pessoa perde o acesso ao Control Lead na hora e é desconectada no
              próximo carregamento. O histórico de chamados fica guardado e você
              pode reativar depois.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={pending}>
              Manter acesso
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                setConfirmOpen(false)
                apply(member.role, false)
              }}
            >
              <PowerOffIcon aria-hidden="true" />
              Desativar acesso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
