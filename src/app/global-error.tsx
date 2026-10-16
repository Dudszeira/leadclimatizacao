"use client"

import { useEffect } from "react"

import "./globals.css"

/**
 * Último recurso: substitui o layout raiz quando ele próprio falha.
 * Precisa de <html>/<body> próprios e não depende de componentes do app.
 * Não exibe detalhes do erro.
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
      <body className="flex min-h-dvh flex-col bg-void font-sans text-ink antialiased md:bg-shell md:p-2">
        <title>Erro · Control Lead</title>
        <main className="flex flex-1 flex-col justify-center px-[max(1rem,env(safe-area-inset-left))] py-12 md:items-center md:rounded-[1.75rem] md:bg-void md:px-8 md:text-center md:ring-1 md:ring-line-soft">
          <p className="text-[0.9375rem] font-medium text-ink-dim">Control Lead</p>
          <h1 className="mt-4 text-[1.75rem] leading-[1.1] font-medium tracking-[-0.03em] md:text-[2rem]">
            O sistema ficou indisponível
          </h1>
          <p className="mt-3 max-w-md text-[0.9375rem] leading-relaxed text-ink-dim">
            Ocorreu uma falha ao carregar o Control Lead. Tente novamente em instantes.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            className="mt-8 h-12 cursor-pointer rounded-full bg-ink px-6 text-[0.9375rem] font-medium text-void outline-none focus-visible:ring-3 focus-visible:ring-signal/60 max-sm:w-full md:h-11"
          >
            Tentar de novo
          </button>
          {error.digest ? (
            <p className="mt-6 text-[0.8125rem] text-ink-faint">
              Código para o suporte:{" "}
              <span className="text-ink-dim tabular-nums select-all">{error.digest}</span>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  )
}
