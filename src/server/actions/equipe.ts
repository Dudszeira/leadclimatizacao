"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { env, isDemoMode, publicOrigin } from "@/lib/env"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient as createSupabase } from "@/lib/supabase/server"
import { authorizeAction } from "@/server/auth"
import { safeErrorLog } from "@/server/_shared"

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
  // Produção: só NEXT_PUBLIC_SITE_URL (publicOrigin lança se faltar). Dev: host do request.
  if (env.NEXT_PUBLIC_SITE_URL || process.env.NODE_ENV === "production") return publicOrigin()
  const h = await headers()
  return publicOrigin({ host: h.get("host"), proto: h.get("x-forwarded-proto") })
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
    console.error("[actions/equipe] admin_set_user_access:", safeErrorLog(error))
    return accessErrorMessage(error)
  }
  return null
}

/**
 * Espelha o "ativo" no Supabase Auth: desativado = banido (não renova sessão
 * nem faz login; o refresh token deixa de valer), reativado = ban removido.
 * A Admin API não encerra sessões por id de usuário (signOut exige o JWT do
 * próprio usuário); o access token ainda vivo expira sozinho e, enquanto isso,
 * get_my_role() já retorna null para perfil inativo (RLS nega tudo).
 */
async function syncAuthBan(userId: string, ativo: boolean): Promise<string | null> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: ativo ? "none" : "876000h",
    })
    if (!error) return null
    console.error("[actions/equipe] updateUserById ban:", { code: error.code, message: error.message })
  } catch (error) {
    console.error("[actions/equipe] syncAuthBan:", error instanceof Error ? error.message : "erro")
  }
  return ativo
    ? "Acesso reativado no sistema, mas o login continua bloqueado no provedor de autenticação. Tente novamente."
    : "Acesso desativado no sistema, mas não foi possível bloquear o login no provedor de autenticação. Tente novamente."
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
      console.error("[actions/equipe] inviteUserByEmail:", safeErrorLog(error))
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
    console.error("[actions/equipe] inviteMember:", safeErrorLog(error))
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
    const banError = await syncAuthBan(parsed.data.userId, parsed.data.ativo)
    if (banError) {
      revalidatePath("/equipe")
      return { status: "error", message: banError }
    }
  } catch (error) {
    console.error("[actions/equipe] updateMemberAccess:", safeErrorLog(error))
    return { status: "error", message: "Não foi possível atualizar o acesso. Tente novamente." }
  }

  revalidatePath("/equipe")
  return { status: "success", message: "Acesso atualizado." }
}
