"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"

import { env, isDemoMode } from "@/lib/env"
import { createClient as createSupabase } from "@/lib/supabase/server"
import type { AuthFormState } from "./_components/form-bits"

/** Origem pública do app para links enviados por e-mail. */
async function appOrigin(): Promise<string> {
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "")
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
  return `${proto}://${host}`
}

/** Encerra a sessão e volta ao login ("Sair" do menu do usuário). */
export async function signOut(): Promise<void> {
  if (!isDemoMode) {
    try {
      const supabase = await createSupabase()
      await supabase.auth.signOut()
    } catch (error) {
      console.error("[auth] signOut:", error)
    }
  }
  redirect("/login")
}

const emailSchema = z.object({
  email: z.email().max(254),
})

/** "Esqueci minha senha": resposta sempre genérica (não revela se o e-mail existe). */
export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = emailSchema.safeParse({ email: String(formData.get("email") ?? "").trim() })
  if (!parsed.success) return { status: "error", message: "Informe um e-mail válido." }

  const generic: AuthFormState = {
    status: "success",
    message:
      "Se este e-mail estiver cadastrado, você vai receber um link para definir uma nova senha em instantes.",
  }
  if (isDemoMode) return generic

  try {
    const supabase = await createSupabase()
    const origin = await appOrigin()
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${origin}/auth/callback?next=/auth/nova-senha`,
    })
    if (error) console.error("[auth] resetPasswordForEmail:", error.message)
  } catch (error) {
    console.error("[auth] requestPasswordReset:", error)
  }
  return generic
}

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, "A senha precisa ter pelo menos 8 caracteres.")
      .max(72, "A senha pode ter no máximo 72 caracteres."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "As senhas não conferem.",
    path: ["confirm"],
  })

/** Define a nova senha (recuperação e primeiro acesso por convite). */
export async function updatePassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = passwordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Senha inválida." }
  }
  if (isDemoMode) {
    return { status: "error", message: "Modo demonstração — não há senha para alterar." }
  }

  try {
    const supabase = await createSupabase()
    const { data: claims } = await supabase.auth.getClaims()
    if (!claims?.claims?.sub) {
      return {
        status: "error",
        message: "Seu link expirou. Peça um novo em \"Esqueci minha senha\".",
      }
    }
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
    if (error) {
      console.error("[auth] updateUser:", error.message)
      const weak = error.code === "weak_password" || error.code === "same_password"
      return {
        status: "error",
        message: weak
          ? "Escolha uma senha diferente e mais forte."
          : "Não foi possível salvar a senha. Tente novamente.",
      }
    }
  } catch (error) {
    console.error("[auth] updatePassword:", error)
    return { status: "error", message: "Não foi possível salvar a senha. Tente novamente." }
  }

  // O layout do console valida papel/ativo e manda cada um para sua tela inicial.
  redirect("/")
}
