"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { LoaderCircleIcon, MailPlusIcon } from "lucide-react"
import { toast } from "sonner"

import type { UserRole } from "@/lib/types"
import { ROLE_LABELS } from "@/lib/nav"
import { inviteMember, type InviteActionState } from "@/server/actions/equipe"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const INITIAL_STATE: InviteActionState = { status: "idle" }

export function InviteDialog() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [role, setRole] = React.useState<UserRole>("tecnico")
  const [state, formAction, pending] = React.useActionState(
    async (prev: InviteActionState, formData: FormData) => {
      const result = await inviteMember(prev, formData)
      if (result.status === "success") {
        toast.success(result.message)
        setOpen(false)
        setRole("tecnico")
        router.refresh()
      } else if (!result.fieldErrors) {
        toast.error(result.message)
      }
      return result
    },
    INITIAL_STATE,
  )
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {}

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <MailPlusIcon aria-hidden="true" />
        Convidar pessoa
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar para a equipe</DialogTitle>
          <DialogDescription>
            A pessoa recebe um e-mail para criar a senha. O acesso já fica liberado com o papel
            escolhido.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-name">Nome completo</Label>
            <Input
              id="invite-name"
              name="full_name"
              autoComplete="off"
              required
              aria-invalid={errors.full_name ? true : undefined}
              aria-describedby={errors.full_name ? "invite-name-error" : undefined}
            />
            {errors.full_name && (
              <p id="invite-name-error" className="text-xs text-danger">
                {errors.full_name}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-email">E-mail</Label>
            <Input
              id="invite-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              required
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? "invite-email-error" : undefined}
            />
            {errors.email && (
              <p id="invite-email-error" className="text-xs text-danger">
                {errors.email}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-role">Papel</Label>
            <input type="hidden" name="role" value={role} />
            <Select
              items={ROLE_LABELS}
              value={role}
              onValueChange={(value: string | null) => {
                if (value) setRole(value as UserRole)
              }}
            >
              <SelectTrigger id="invite-role" aria-label="Papel" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.role && <p className="text-xs text-danger">{errors.role}</p>}
          </div>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending} aria-busy={pending}>
              {pending ? (
                <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
              ) : (
                <MailPlusIcon aria-hidden="true" />
              )}
              Enviar convite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
