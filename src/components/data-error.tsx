"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"

type DataErrorProps = {
  message: string
  className?: string
  /** Bloco compacto (cards/KPIs do dashboard) em vez da seção cheia. */
  compact?: boolean
}

/** Estado de erro do data layer com ação de tentar de novo. */
export function DataError({ message, className, compact = false }: DataErrorProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const retry = (
    <Button
      variant="outline"
      size={compact ? "sm" : "default"}
      className={compact ? undefined : "mt-6"}
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <RotateCcwIcon aria-hidden="true" />
      {pending ? "Recarregando…" : "Tentar de novo"}
    </Button>
  )

  if (compact) {
    return (
      <div
        role="alert"
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl bg-danger-dim/60 px-6 py-8 text-center",
          className,
        )}
      >
        <TriangleAlertIcon className="size-5 text-danger" aria-hidden="true" />
        <p className="max-w-sm text-sm leading-relaxed text-ink-dim">{message}</p>
        {retry}
      </div>
    )
  }

  return (
    <section
      role="alert"
      className={cn(
        "flex flex-1 flex-col items-center justify-center rounded-[1.375rem] bg-console px-6 py-14 text-center ring-1 ring-line md:py-20",
        className,
      )}
    >
      <div
        className="flex size-12 items-center justify-center rounded-full bg-danger-dim"
        aria-hidden="true"
      >
        <TriangleAlertIcon className="size-5 text-danger" />
      </div>
      <h2 className="mt-5 font-display text-xl font-medium tracking-[-0.02em] text-ink">
        Algo deu errado
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-dim">
        {message}
      </p>
      {retry}
    </section>
  )
}
