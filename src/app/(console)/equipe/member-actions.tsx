"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { LoaderCircleIcon, PowerIcon, PowerOffIcon } from "lucide-react"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const ROLE_ITEMS: Record<UserRole, string> = ROLE_LABELS

type MemberActionsProps = {
  member: { id: string; full_name: string; role: UserRole; ativo: boolean }
  isSelf: boolean
}

/** Papel (Select) + ativar/desativar (com confirmação) de um membro. */
export function MemberActions({ member, isSelf }: MemberActionsProps) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [confirmOpen, setConfirmOpen] = React.useState(false)

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
    <div className="flex items-center justify-end gap-2">
      <Select
        items={ROLE_ITEMS}
        value={member.role}
        onValueChange={(value: string | null) => {
          if (value && value !== member.role) apply(value as UserRole, member.ativo)
        }}
        disabled={pending || isSelf}
      >
        <SelectTrigger
          aria-label={`Papel de ${member.full_name}`}
          className="h-9 w-[150px] max-md:h-11"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(ROLE_ITEMS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {member.ativo ? (
        <Button
          variant="outline"
          className="h-9 max-md:h-11"
          disabled={pending || isSelf}
          onClick={() => setConfirmOpen(true)}
          aria-label={`Desativar ${member.full_name}`}
          title={isSelf ? "Você não pode desativar o próprio acesso" : undefined}
        >
          {pending ? (
            <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
          ) : (
            <PowerOffIcon aria-hidden="true" />
          )}
          <span className="max-lg:sr-only">Desativar</span>
        </Button>
      ) : (
        <Button
          variant="outline"
          className="h-9 max-md:h-11"
          disabled={pending}
          onClick={() => apply(member.role, true)}
          aria-label={`Ativar ${member.full_name}`}
        >
          {pending ? (
            <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
          ) : (
            <PowerIcon aria-hidden="true" />
          )}
          <span className="max-lg:sr-only">Ativar</span>
        </Button>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Desativar {member.full_name}?</DialogTitle>
            <DialogDescription>
              A pessoa perde o acesso ao console imediatamente e é desconectada no próximo
              carregamento. O histórico de chamados é mantido e você pode reativar depois.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="max-md:h-11"
              onClick={() => setConfirmOpen(false)}
              disabled={pending}
            >
              Manter acesso
            </Button>
            <Button
              variant="destructive"
              className="max-md:h-11"
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
    </div>
  )
}
