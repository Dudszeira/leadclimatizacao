"use client"

import { useFormStatus } from "react-dom"
import { CircleAlertIcon, CircleCheckIcon, LoaderCircleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export type AuthFormState = {
  status: "idle" | "success" | "error"
  message?: string
}

export const AUTH_INITIAL_STATE: AuthFormState = { status: "idle" }

/** Botão de envio: desabilitado enquanto a action roda. */
export function SubmitButton({ children, pendingLabel }: { children: React.ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="h-11 w-full" disabled={pending} aria-busy={pending}>
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
          ? "flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-dim px-3 py-2.5 text-sm text-ink"
          : "flex items-start gap-2 rounded-lg border border-clear/30 bg-clear-dim px-3 py-2.5 text-sm text-ink"
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
