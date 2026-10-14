"use client"

import { useEffect } from "react"

import "./globals.css"

/**
 * Último recurso: substitui o layout raiz quando ele próprio falha.
 * Precisa de <html>/<body> próprios. Não exibe detalhes do erro.
 */
export default function GlobalError({
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
    <html lang="pt-BR">
      <body className="flex min-h-dvh flex-col items-center justify-center bg-void px-4 text-center text-ink antialiased">
        <title>Erro · Control Lead</title>
        <h1 className="text-2xl font-bold tracking-tight">O console ficou indisponível</h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-dim">
          Ocorreu uma falha ao carregar o sistema. Tente novamente em instantes.
        </p>
        {error.digest ? (
          <p className="mt-4 font-mono text-xs tracking-wider text-ink-faint">
            Código: {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => retry()}
          className="mt-6 h-11 rounded-lg bg-signal-solid px-5 text-sm font-medium text-ink outline-none focus-visible:ring-3 focus-visible:ring-signal/50"
        >
          Tentar de novo
        </button>
      </body>
    </html>
  )
}
