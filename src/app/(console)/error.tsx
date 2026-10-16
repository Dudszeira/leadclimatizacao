"use client"

import { useEffect } from "react"
import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

/** Erro inesperado dentro do console: mantém sidebar/header e não vaza detalhes. */
export default function ConsoleError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <section
      role="alert"
      className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-console/50 px-6 py-16 text-center"
    >
      <div
        className="flex size-14 items-center justify-center rounded-2xl border border-line-soft bg-console-2"
        aria-hidden="true"
      >
        <TriangleAlertIcon className="size-7 text-amber" />
      </div>
      <h2 className="mt-5 font-display text-lg font-bold tracking-tight text-ink">
        Não foi possível abrir esta tela
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-dim">
        Aconteceu um erro inesperado. Tente de novo; se persistir, envie o código abaixo ao
        suporte.
      </p>
      {error.digest ? (
        <p className="mt-4 font-mono text-xs tracking-wider text-ink-faint">
          Código: {error.digest}
        </p>
      ) : null}
      <Button variant="outline" className="mt-6 h-11 px-5" onClick={() => retry()}>
        <RotateCcwIcon aria-hidden="true" />
        Tentar de novo
      </Button>
    </section>
  )
}
