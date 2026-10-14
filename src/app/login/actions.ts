"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { isDemoMode } from "@/lib/env"
import { homeFor } from "@/lib/nav"
import { createClient as createSupabase } from "@/lib/supabase/server"
import type { UserRole } from "@/lib/types"
import type { AuthFormState } from "../auth/_components/form-bits"
import { safeNext } from "../auth/safe-next"

const INVALID = "E-mail ou senha inválidos."

const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(72),
})

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const next = safeNext(formData.get("next"))
  if (isDemoMode) redirect(next ?? "/")

  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  })
  if (!parsed.success) return { status: "error", message: INVALID }

  let role: UserRole
  try {
    const supabase = await createSupabase()
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data)
    if (error || !data.user) {
      if (error && error.status !== 400) console.error("[login] signInWithPassword:", error.message)
      return { status: "error", message: INVALID }
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, ativo")
      .eq("id", data.user.id)
      .maybeSingle()
    if (profileError) console.error("[login] profile:", profileError)
    if (!profile || !profile.ativo || !profile.role) {
      await supabase.auth.signOut()
      return {
        status: "error",
        message: "Seu acesso ainda não foi liberado. Fale com o administrador da Lead Climatização.",
      }
    }
    role = profile.role as UserRole
  } catch (error) {
    console.error("[login] signIn:", error)
    return { status: "error", message: "Não foi possível entrar agora. Tente novamente em instantes." }
  }

  redirect(next && next !== "/" ? next : homeFor(role))
}
