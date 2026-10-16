import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { CompassIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Página não encontrada",
  robots: { index: false, follow: false },
}

export default async function NotFound() {
  // Render por requisição: o nonce da CSP só é aplicado em páginas dinâmicas.
  await connection()

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center bg-void px-4 text-center">
      <div
        className="flex size-14 items-center justify-center rounded-2xl border border-line-soft bg-console-2"
        aria-hidden="true"
      >
        <CompassIcon className="size-7 text-ink-faint" />
      </div>
      <p className="mt-5 font-mono text-xs tracking-[0.18em] text-signal uppercase">Erro 404</p>
      <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink">
        Página não encontrada
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-dim">
        O endereço pode ter mudado ou o registro foi removido.
      </p>
      <Link href="/" className={buttonVariants({ className: "mt-6 h-11 px-5" })}>
        Voltar ao console
      </Link>
    </main>
  )
}
