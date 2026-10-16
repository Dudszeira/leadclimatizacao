"use client"

import * as React from "react"
import { useFormStatus } from "react-dom"
import { cn } from "cn"
import {
  CircleAlertIcon,
  CircleCheckIcon,
  EyeIcon,
  EyeOffIcon,
  LoaderCircleIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export type AuthFormState = {
  status: "idle" | "success" | "error"
  message?: string
}

export const AUTH_INITIAL_STATE: AuthFormState = { status: "idle" }

/** Botão de envio: largura total, desabilitado enquanto a action roda. */
export function SubmitButton({ children, pendingLabel }: { children: React.ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending} aria-busy={pending}>
      {pending ? (
        <>
          <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  )
}

/** Campo de senha com botão de mostrar/ocultar (alvo de 44px). */
export function PasswordInput({
  id,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type"> & { id: string }) {
  const [visible, setVisible] = React.useState(false)
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={cn("pr-12", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={visible}
        aria-controls={id}
        className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center rounded-xl text-ink-faint transition-colors duration-150 outline-none hover:text-ink focus-visible:text-ink focus-visible:ring-3 focus-visible:ring-signal/50"
      >
        {visible ? (
          <EyeOffIcon className="size-[1.125rem]" aria-hidden="true" />
        ) : (
          <EyeIcon className="size-[1.125rem]" aria-hidden="true" />
        )}
      </button>
    </div>
  )
}

/** Mensagem de retorno do formulário (anunciada a leitores de tela). */
export function FormMessage({ state }: { state: AuthFormState }) {
  if (state.status === "idle" || !state.message) {
    return <p role="status" aria-live="polite" className="sr-only" />
  }
  const isError = state.status === "error"
  const Icon = isError ? CircleAlertIcon : CircleCheckIcon
  return (
    <p
      role={isError ? "alert" : "status"}
      aria-live="polite"
      className={
        isError
          ? "flex items-start gap-2.5 rounded-xl bg-danger-dim px-3.5 py-3 text-sm leading-relaxed text-ink"
          : "flex items-start gap-2.5 rounded-xl bg-clear-dim px-3.5 py-3 text-sm leading-relaxed text-ink"
      }
    >
      <Icon
        className={isError ? "mt-0.5 size-4 shrink-0 text-danger" : "mt-0.5 size-4 shrink-0 text-clear"}
        aria-hidden="true"
      />
      <span>{state.message}</span>
    </p>
  )
}
