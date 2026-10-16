"use client"

import { useActionState } from "react"
import Link from "next/link"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AUTH_INITIAL_STATE, FormMessage, SubmitButton } from "../auth/_components/form-bits"
import { signIn } from "./actions"

export function LoginForm({ next }: { next: string | null }) {
  const [state, formAction] = useActionState(signIn, AUTH_INITIAL_STATE)

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="login-email">E-mail</Label>
        <Input
          id="login-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          className="h-11"
          aria-invalid={state.status === "error" ? true : undefined}
        />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="login-password">Senha</Label>
          <Link
            href="/login/recuperar"
            className="-my-2 inline-flex min-h-11 items-center rounded px-2 -mr-2 text-sm text-signal underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
          >
            Esqueci minha senha
          </Link>
        </div>
        <Input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-11"
          aria-invalid={state.status === "error" ? true : undefined}
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Entrando…">Entrar</SubmitButton>
    </form>
  )
}
