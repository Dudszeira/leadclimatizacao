import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { ArrowLeftIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { StatusScreen } from "./auth/_components/status-screen"

export const metadata: Metadata = {
  title: "Página não encontrada",
  robots: { index: false, follow: false },
}

export default async function NotFound() {
  // Render por requisição: o nonce da CSP só é aplicado em páginas dinâmicas.
  await connection()

  return (
    <StatusScreen
      mark={
        <span className="font-display text-[5.5rem] leading-none font-medium tracking-[-0.05em] text-console-3 md:text-[7rem]">
          404
        </span>
      }
      title="Página não encontrada"
      description="O endereço pode ter mudado ou o registro foi removido. Volte ao início e procure pelo menu."
    >
      <Link href="/" className={buttonVariants({ size: "lg" })}>
        <ArrowLeftIcon aria-hidden="true" />
        Voltar ao início
      </Link>
    </StatusScreen>
  )
}
