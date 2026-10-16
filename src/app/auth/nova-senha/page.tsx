import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"

import { isDemoMode } from "@/lib/env"
import { createClient as createSupabase } from "@/lib/supabase/server"
import { buttonVariants } from "@/components/ui/button"
import { AuthShell } from "../_components/auth-shell"
import { NewPasswordForm } from "./new-password-form"

export const metadata: Metadata = {
  title: "Definir senha",
  robots: { index: false, follow: false },
}

async function currentEmail(): Promise<string | null | false> {
  try {
    const supabase = await createSupabase()
    const { data } = await supabase.auth.getClaims()
    if (!data?.claims?.sub) return false
    return typeof data.claims.email === "string" ? data.claims.email : null
  } catch (error) {
    console.error("[auth/nova-senha]:", error)
    return false
  }
}

/** Definição de senha: recuperação ("esqueci") e primeiro acesso por convite. */
export default async function NovaSenhaPage() {
  await connection()

  const email = isDemoMode ? false : await currentEmail()

  if (email === false) {
    return (
      <AuthShell
        title="Este link expirou"
        description="Links de convite e de recuperação valem por pouco tempo e só podem ser usados uma vez."
      >
        <div className="flex flex-col gap-3">
          <Link href="/login/recuperar" className={buttonVariants({ size: "lg", className: "w-full" })}>
            Pedir um novo link
          </Link>
          <Link
            href="/login"
            className={buttonVariants({ variant: "secondary", size: "lg", className: "w-full" })}
          >
            Voltar para o login
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Crie sua senha"
      description={
        email ? (
          <>
            Conta <span className="break-all text-ink">{email}</span>. Use pelo menos 8 caracteres.
          </>
        ) : (
          "Use pelo menos 8 caracteres."
        )
      }
    >
      <NewPasswordForm />
    </AuthShell>
  )
}
