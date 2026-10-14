"use client"

import { useActionState } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { requestPasswordReset } from "../../auth/actions"
import { AUTH_INITIAL_STATE, FormMessage, SubmitButton } from "../../auth/_components/form-bits"

export function ForgotForm() {
  const [state, formAction] = useActionState(requestPasswordReset, AUTH_INITIAL_STATE)

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="reset-email">E-mail</Label>
        <Input
          id="reset-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          className="h-11"
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Enviando…">Enviar link</SubmitButton>
    </form>
  )
}
