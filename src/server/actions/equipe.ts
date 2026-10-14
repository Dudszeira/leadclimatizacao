"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { env, isDemoMode } from "@/lib/env"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient as createSupabase } from "@/lib/supabase/server"
import { authorizeAction } from "@/server/auth"

/**
 * Gestão da equipe (somente admin). Papel/ativo mudam SEMPRE pela RPC
 * admin_set_user_access com a sessão do admin (o banco revalida o papel e
 * impede remover o último admin). A service role só é usada para o que a
 * Auth Admin API exige: enviar convite.
 */

export interface EquipeActionResult {
  status: "success" | "error"
  message: string
}

export interface InviteFieldErrors {
  full_name?: string
  email?: string
  role?: string
}

export interface InviteActionState {
  status: "idle" | "success" | "error"
  message?: string
  fieldErrors?: InviteFieldErrors
}

const DEMO_MESSAGE =
  "Modo demonstração — a gestão da equipe será habilitada quando o banco do cliente for conectado."

const roleSchema = z.enum(["admin", "atendente", "tecnico"], {
  error: "Selecione um papel válido.",
})

const inviteSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(3, "Informe o nome completo (mínimo 3 caracteres).")
    .max(120, "Nome muito longo."),
  email: z.email("E-mail inválido.").max(254, "E-mail muito longo."),
  role: roleSchema,
})

async function appOrigin(): Promise<string> {
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "")
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
  return `${proto}://${host}`
}

/** Traduz erros da RPC admin_set_user_access sem vazar detalhes. */
function accessErrorMessage(error: { code?: string; message?: string }): string {
  if (error.message?.includes("último admin")) {
    return "Não é possível remover o último administrador ativo."
  }
  if (error.code === "P0002") return "Usuário não encontrado — recarregue a página."
  if (error.code === "42501") return "Sem permissão"
  return "Não foi possível atualizar o acesso. Tente novamente."
}

async function setAccess(
  userId: string,
  role: z.infer<typeof roleSchema>,
  ativo: boolean,
): Promise<string | null> {
  const supabase = await createSupabase()
  const { error } = await supabase.rpc("admin_set_user_access", {
    p_user: userId,
    p_role: role,
    p_ativo: ativo,
  })
  if (error) {
    console.error("[actions/equipe] admin_set_user_access:", error)
    return accessErrorMessage(error)
  }
  return null
}

/** Convida por e-mail, define o papel e já ativa o acesso. */
export async function inviteMember(
  _prev: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const auth = await authorizeAction("admin")
  if (auth.error !== null) return { status: "error", message: auth.error }

  const parsed = inviteSchema.safeParse({
    full_name: String(formData.get("full_name") ?? ""),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    role: String(formData.get("role") ?? ""),
  })
  if (!parsed.success) {
    const fieldErrors: InviteFieldErrors = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof InviteFieldErrors
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return { status: "error", message: "Revise os campos destacados.", fieldErrors }
  }
  if (isDemoMode) return { status: "error", message: DEMO_MESSAGE }

  try {
    const admin = createAdminClient()
    const origin = await appOrigin()
    const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      redirectTo: `${origin}/auth/callback?next=/auth/nova-senha`,
      data: { full_name: parsed.data.full_name },
    })
    if (error || !data.user) {
      console.error("[actions/equipe] inviteUserByEmail:", error)
      const exists = error?.code === "email_exists" || error?.status === 422
      return {
        status: "error",
        message: exists
          ? "Já existe uma conta com este e-mail. Ajuste o papel dela na lista."
          : "Não foi possível enviar o convite. Tente novamente.",
      }
    }

    const accessError = await setAccess(data.user.id, parsed.data.role, true)
    if (accessError) {
      revalidatePath("/equipe")
      return {
        status: "error",
        message: `Convite enviado, mas o acesso não foi liberado: ${accessError}`,
      }
    }
  } catch (error) {
    console.error("[actions/equipe] inviteMember:", error)
    return { status: "error", message: "Não foi possível enviar o convite. Tente novamente." }
  }

  revalidatePath("/equipe")
  return { status: "success", message: `Convite enviado para ${parsed.data.email}.` }
}

const accessSchema = z.object({
  userId: z.uuid(),
  role: roleSchema,
  ativo: z.boolean(),
})

/** Altera papel e/ou ativa/desativa um membro. */
export async function updateMemberAccess(input: {
  userId: string
  role: string
  ativo: boolean
}): Promise<EquipeActionResult> {
  const auth = await authorizeAction("admin")
  if (auth.error !== null) return { status: "error", message: auth.error }

  const parsed = accessSchema.safeParse(input)
  if (!parsed.success) {
    return { status: "error", message: "Dados inválidos — recarregue a página e tente novamente." }
  }
  if (parsed.data.userId === auth.data.id && (!parsed.data.ativo || parsed.data.role !== "admin")) {
    return {
      status: "error",
      message: "Você não pode remover o seu próprio acesso de administrador.",
    }
  }
  if (isDemoMode) return { status: "error", message: DEMO_MESSAGE }

  try {
    const accessError = await setAccess(parsed.data.userId, parsed.data.role, parsed.data.ativo)
    if (accessError) return { status: "error", message: accessError }
  } catch (error) {
    console.error("[actions/equipe] updateMemberAccess:", error)
    return { status: "error", message: "Não foi possível atualizar o acesso. Tente novamente." }
  }

  revalidatePath("/equipe")
  return { status: "success", message: "Acesso atualizado." }
}
