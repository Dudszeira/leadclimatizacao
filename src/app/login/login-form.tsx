"use client"

import { useActionState } from "react"
import Link from "next/link"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AUTH_INITIAL_STATE,
  FormMessage,
  PasswordInput,
  SubmitButton,
} from "../auth/_components/form-bits"
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
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          aria-invalid={state.status === "error" ? true : undefined}
        />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="login-password">Senha</Label>
          <Link
            href="/login/recuperar"
            className="-my-3 -mr-2 inline-flex min-h-11 items-center rounded-full px-2 text-sm text-signal underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-signal/50"
          >
            Esqueci minha senha
          </Link>
        </div>
        <PasswordInput
          id="login-password"
          name="password"
          autoComplete="current-password"
          required
          aria-invalid={state.status === "error" ? true : undefined}
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Entrando…">Entrar</SubmitButton>
    </form>
  )
}
