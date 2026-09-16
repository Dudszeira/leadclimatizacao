"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isDemoMode } from "@/lib/env"
import { createClient as createSupabase } from "@/lib/supabase/server"
import { isValidCnpj, maskCnpj, onlyDigits } from "@/components/clientes/format"

export interface ClientFieldErrors {
  razao_social?: string
  cnpj?: string
  contato_nome?: string
  contato_email?: string
  contato_telefone?: string
}

export interface ClientActionState {
  status: "idle" | "success" | "error"
  message?: string
  fieldErrors?: ClientFieldErrors
}

const clientSchema = z.object({
  id: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined)),
  razao_social: z
    .string({ error: "Informe a razão social." })
    .trim()
    .min(3, "Informe a razão social (mínimo 3 caracteres)."),
  cnpj: z
    .string()
    .trim()
    .refine((v) => v === "" || isValidCnpj(v), {
      message: "CNPJ inválido — confira os dígitos.",
    }),
  contato_nome: z.string().trim().max(120, "Nome do contato muito longo."),
  contato_email: z
    .string()
    .trim()
    .refine((v) => v === "" || z.email().safeParse(v).success, {
      message: "E-mail inválido.",
    }),
  contato_telefone: z
    .string()
    .trim()
    .refine((v) => v === "" || onlyDigits(v).length >= 10, {
      message: "Telefone incompleto — use DDD + número.",
    }),
})

/**
 * Cria ou atualiza um cliente (Dialog de cadastro/edição).
 * Valida com zod no servidor; em modo demo não grava nada e devolve
 * mensagem amigável para a UI exibir via toast.
 */
export async function saveClient(
  _prevState: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  const raw = {
    id: String(formData.get("id") ?? ""),
    razao_social: String(formData.get("razao_social") ?? ""),
    cnpj: String(formData.get("cnpj") ?? ""),
    contato_nome: String(formData.get("contato_nome") ?? ""),
    contato_email: String(formData.get("contato_email") ?? ""),
    contato_telefone: String(formData.get("contato_telefone") ?? ""),
  }

  const parsed = clientSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: ClientFieldErrors = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof ClientFieldErrors | undefined
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message
    }
    return {
      status: "error",
      message: "Revise os campos destacados antes de salvar.",
      fieldErrors,
    }
  }

  if (isDemoMode) {
    return {
      status: "error",
      message:
        "Modo demonstração — o cadastro será habilitado quando o banco do cliente for conectado.",
    }
  }

  const { id, razao_social, cnpj, contato_nome, contato_email, contato_telefone } =
    parsed.data
  const row = {
    razao_social,
    cnpj: cnpj ? maskCnpj(cnpj) : null,
    contato_nome: contato_nome || null,
    contato_email: contato_email || null,
    contato_telefone: contato_telefone || null,
  }

  try {
    const supabase = await createSupabase()
    if (id) {
      const { error } = await supabase.from("clients").update(row).eq("id", id)
      if (error) {
        console.error("[actions/clients] update:", error)
        return {
          status: "error",
          message: "Não foi possível atualizar o cliente. Tente novamente.",
        }
      }
    } else {
      const { error } = await supabase.from("clients").insert(row)
      if (error) {
        console.error("[actions/clients] insert:", error)
        return {
          status: "error",
          message: "Não foi possível cadastrar o cliente. Tente novamente.",
        }
      }
    }
  } catch (error) {
    console.error("[actions/clients] saveClient:", error)
    return {
      status: "error",
      message: "Não foi possível salvar o cliente. Tente novamente.",
    }
  }

  revalidatePath("/clientes")
  if (id) revalidatePath(`/clientes/${id}`)
  return {
    status: "success",
    message: id
      ? "Cliente atualizado com sucesso."
      : "Cliente cadastrado com sucesso.",
  }
}
