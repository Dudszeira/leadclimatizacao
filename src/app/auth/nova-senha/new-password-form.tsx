"use client"

import { useActionState } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updatePassword } from "../actions"
import { AUTH_INITIAL_STATE, FormMessage, SubmitButton } from "../_components/form-bits"

export function NewPasswordForm() {
  const [state, formAction] = useActionState(updatePassword, AUTH_INITIAL_STATE)

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password">Nova senha</Label>
        <Input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
          className="h-11"
          aria-describedby="new-password-hint"
        />
        <p id="new-password-hint" className="text-xs text-ink-faint">
          Mínimo de 8 caracteres. Evite datas e sequências.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm-password">Repita a senha</Label>
        <Input
          id="confirm-password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
          className="h-11"
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Salvando…">Salvar senha e entrar</SubmitButton>
    </form>
  )
}
