"use client"

import { useEffect } from "react"
import Link from "next/link"
import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"

/** Erro inesperado dentro do console: mantém barra lateral e abas, sem vazar detalhes. */
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
      className="flex flex-1 flex-col justify-center rounded-[1.375rem] bg-console px-5 py-12 ring-1 ring-line md:items-center md:px-6 md:py-20 md:text-center"
    >
      <span
        className="flex size-12 items-center justify-center rounded-full bg-amber-dim"
        aria-hidden="true"
      >
        <TriangleAlertIcon className="size-5 text-amber" />
      </span>
      <h1
        data-page-title
        className="mt-5 font-display text-[1.5rem] leading-[1.15] font-medium tracking-[-0.025em] text-ink md:text-[1.75rem]"
      >
        Não foi possível abrir esta tela
      </h1>
      <p className="mt-2.5 max-w-md text-[0.9375rem] leading-relaxed text-ink-dim">
        Aconteceu um erro inesperado. Tente de novo; se continuar, envie o código abaixo ao
        suporte.
      </p>
      <div className="mt-7 flex flex-col gap-2 sm:flex-row md:justify-center">
        <Button onClick={() => retry()}>
          <RotateCcwIcon aria-hidden="true" />
          Tentar de novo
        </Button>
        <Link href="/" className={buttonVariants({ variant: "secondary" })}>
          Ir para o início
        </Link>
      </div>
      {error.digest ? (
        <p className="mt-6 text-[0.8125rem] text-ink-faint">
          Código para o suporte:{" "}
          <span className="text-ink-dim tabular-nums select-all">{error.digest}</span>
        </p>
      ) : null}
    </section>
  )
}
