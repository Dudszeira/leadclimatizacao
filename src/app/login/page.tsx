import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRightIcon, CircleAlertIcon, FlaskConicalIcon } from "lucide-react"

import { isDemoMode } from "@/lib/env"
import { buttonVariants } from "@/components/ui/button"
import { AuthShell } from "../auth/_components/auth-shell"
import { safeNext } from "../auth/safe-next"
import { LoginForm } from "./login-form"

export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false, follow: false },
}

const ERROR_MESSAGES: Record<string, string> = {
  inativo:
    "Seu acesso está desativado ou ainda não foi liberado. Fale com o administrador da Lead Climatização.",
  link: "O link expirou ou já foi usado. Entre com sua senha ou peça um novo link.",
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams
  const next = safeNext(typeof sp.next === "string" ? sp.next : null)
  const erro = typeof sp.erro === "string" ? ERROR_MESSAGES[sp.erro] : undefined

  if (isDemoMode) {
    return (
      <AuthShell
        eyebrow="Modo demonstração"
        title="Console aberto para avaliação"
        description="Este ambiente roda com dados fictícios e não exige login. O acesso com e-mail e senha é ativado quando o banco da Lead Climatização for conectado."
      >
        <div className="flex flex-col gap-4">
          <p className="flex items-start gap-2 text-sm text-ink-dim">
            <FlaskConicalIcon className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden="true" />
            Nenhuma alteração feita aqui é gravada.
          </p>
          <Link href={next ?? "/"} className={buttonVariants({ className: "h-11 w-full" })}>
            Entrar no painel
            <ArrowRightIcon aria-hidden="true" />
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      eyebrow="Acesso restrito"
      title="Entrar no console"
      description="Use o e-mail e a senha cadastrados pela administração."
      footer={
        <p>
          Primeiro acesso? Use o link do convite que chegou no seu e-mail para criar a senha.
        </p>
      }
    >
      {erro ? (
        <p
          role="alert"
          className="mb-5 flex items-start gap-2 rounded-lg border border-amber/30 bg-amber-dim px-3 py-2.5 text-sm text-ink"
        >
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden="true" />
          {erro}
        </p>
      ) : null}
      <LoginForm next={next} />
    </AuthShell>
  )
}
