"use client"

import { useActionState } from "react"

import { Label } from "@/components/ui/label"
import { updatePassword } from "../actions"
import {
  AUTH_INITIAL_STATE,
  FormMessage,
  PasswordInput,
  SubmitButton,
} from "../_components/form-bits"

export function NewPasswordForm() {
  const [state, formAction] = useActionState(updatePassword, AUTH_INITIAL_STATE)

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password">Nova senha</Label>
        <PasswordInput
          id="new-password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
          aria-describedby="new-password-hint"
        />
        <p id="new-password-hint" className="text-[0.8125rem] text-ink-faint">
          Mínimo de 8 caracteres. Evite datas e sequências.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm-password">Repita a senha</Label>
        <PasswordInput
          id="confirm-password"
          name="confirm"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Salvando…">Salvar senha e entrar</SubmitButton>
    </form>
  )
}
