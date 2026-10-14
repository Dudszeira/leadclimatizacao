"use client"

import { useEffect } from "react"
import Link from "next/link"
import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"

/** Erro inesperado fora do console (login, autenticação). Não exibe detalhes. */
export default function RootError({
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
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center bg-void px-4 text-center">
      <div
        className="flex size-14 items-center justify-center rounded-2xl border border-line-soft bg-console-2"
        aria-hidden="true"
      >
        <TriangleAlertIcon className="size-7 text-amber" />
      </div>
      <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-ink">
        Algo saiu do esperado
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-dim">
        Não conseguimos carregar esta página. Tente de novo; se continuar, informe o código abaixo
        ao suporte.
      </p>
      {error.digest ? (
        <p className="mt-4 font-mono text-xs tracking-wider text-ink-faint">
          Código: {error.digest}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button className="h-11 px-5" onClick={() => retry()}>
          <RotateCcwIcon aria-hidden="true" />
          Tentar de novo
        </Button>
        <Link href="/" className={buttonVariants({ variant: "outline", className: "h-11 px-5" })}>
          Ir para o início
        </Link>
      </div>
    </main>
  )
}
