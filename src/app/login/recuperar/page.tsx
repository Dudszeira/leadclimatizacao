import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { ArrowLeftIcon } from "lucide-react"

import { AuthShell } from "../../auth/_components/auth-shell"
import { ForgotForm } from "./forgot-form"

export const metadata: Metadata = {
  title: "Recuperar senha",
  robots: { index: false, follow: false },
}

export default async function RecuperarSenhaPage() {
  // Render por requisição: o nonce da CSP só é aplicado em páginas dinâmicas.
  await connection()

  return (
    <AuthShell
      title="Recuperar senha"
      description="Informe o e-mail cadastrado. Enviaremos um link para você definir uma nova senha."
      footer={
        <Link
          href="/login"
          className="-my-3 -ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-signal underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-signal/50"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          Voltar para o login
        </Link>
      }
    >
      <ForgotForm />
    </AuthShell>
  )
}
