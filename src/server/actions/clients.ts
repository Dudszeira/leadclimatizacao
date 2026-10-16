"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isDemoMode } from "@/lib/env"
import { createClient as createSupabase } from "@/lib/supabase/server"
import { authorizeAction } from "@/server/auth"
import {
  DEMO_MESSAGE,
  RLS_BLOCK_MESSAGE,
  type ActionResult,
} from "@/components/clientes/action-result"
import {
  clientSchema,
  fieldErrorsFrom,
  fiscalSchema,
  type ClientInput,
  type FiscalInput,
} from "@/components/clientes/schemas"
import { onlyDigits } from "@/components/clientes/validators"
import { safeErrorLog } from "@/server/_shared"

const INVALID = "Revise os campos destacados antes de salvar."

/**
 * Cria ou atualiza um cliente. Zod no servidor; CPF/CNPJ gravado mascarado
 * (forma canônica) e checado contra duplicidade antes do insert para dar uma
 * mensagem melhor que a violação de unique.
 */
export async function saveClient(input: ClientInput): Promise<ActionResult> {
  const auth = await authorizeAction("admin", "atendente")
  if (auth.error !== null) return { ok: false, message: auth.error }

  const parsed = clientSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: INVALID, fieldErrors: fieldErrorsFrom(parsed.error) }
  }
  if (isDemoMode) return { ok: true, demo: true, message: DEMO_MESSAGE }

  const { id, documento, ...rest } = parsed.data
  const row = { ...rest, cnpj: documento }

  try {
    const supabase = await createSupabase()
    if (documento) {
      const digits = onlyDigits(documento)
      const { data: dup, error: dupError } = await supabase
        .from("clients")
        .select("id")
        .in("cnpj", [documento, digits])
        .limit(1)
      if (dupError) {
        console.error("[actions/clients] dup check:", safeErrorLog(dupError))
        return { ok: false, message: "Não foi possível salvar o cliente. Tente novamente." }
      }
      if (dup && dup.length > 0 && dup[0].id !== id) {
        return {
          ok: false,
          message: "Já existe um cliente com este CPF/CNPJ.",
          fieldErrors: { documento: "CPF/CNPJ já cadastrado." },
        }
      }
    }

    if (id) {
      const { data, error } = await supabase.from("clients").update(row).eq("id", id).select("id")
      if (error) {
        console.error("[actions/clients] update:", safeErrorLog(error))
        return { ok: false, message: "Não foi possível atualizar o cliente. Tente novamente." }
      }
      if (!data || data.length === 0) return { ok: false, message: RLS_BLOCK_MESSAGE }
      revalidatePath("/clientes")
      revalidatePath(`/clientes/${id}`)
      return { ok: true, message: "Cliente atualizado.", id }
    }

    const { data, error } = await supabase.from("clients").insert(row).select("id").single()
    if (error) {
      console.error("[actions/clients] insert:", safeErrorLog(error))
      return { ok: false, message: "Não foi possível cadastrar o cliente. Tente novamente." }
    }
    revalidatePath("/clientes")
    return { ok: true, message: "Cliente cadastrado.", id: data.id as string }
  } catch (error) {
    console.error("[actions/clients] saveClient:", safeErrorLog(error))
    return { ok: false, message: "Não foi possível salvar o cliente. Tente novamente." }
  }
}

const ativoSchema = z.object({ id: z.uuid(), ativo: z.boolean() })

/** Inativa/reativa (nunca apaga: o cliente tem histórico de OS e faturas). */
export async function setClientAtivo(input: { id: string; ativo: boolean }): Promise<ActionResult> {
  const auth = await authorizeAction("admin", "atendente")
  if (auth.error !== null) return { ok: false, message: auth.error }
  const parsed = ativoSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: "Cliente inválido." }
  if (isDemoMode) return { ok: true, demo: true, message: DEMO_MESSAGE }

  try {
    const supabase = await createSupabase()
    const { data, error } = await supabase
      .from("clients")
      .update({ ativo: parsed.data.ativo })
      .eq("id", parsed.data.id)
      .select("id")
    if (error) {
      console.error("[actions/clients] setClientAtivo:", safeErrorLog(error))
      return { ok: false, message: "Não foi possível alterar o status. Tente novamente." }
    }
    if (!data || data.length === 0) return { ok: false, message: RLS_BLOCK_MESSAGE }
    revalidatePath("/clientes")
    revalidatePath(`/clientes/${parsed.data.id}`)
    return {
      ok: true,
      message: parsed.data.ativo ? "Cliente reativado." : "Cliente inativado.",
      id: parsed.data.id,
    }
  } catch (error) {
    console.error("[actions/clients] setClientAtivo:", safeErrorLog(error))
    return { ok: false, message: "Não foi possível alterar o status. Tente novamente." }
  }
}

/** Dados fiscais da NFS-e (código do serviço municipal, ISS). */
export async function saveClientFiscal(input: FiscalInput): Promise<ActionResult> {
  const auth = await authorizeAction("admin", "atendente")
  if (auth.error !== null) return { ok: false, message: auth.error }
  const parsed = fiscalSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: INVALID, fieldErrors: fieldErrorsFrom(parsed.error) }
  }
  if (isDemoMode) return { ok: true, demo: true, message: DEMO_MESSAGE }

  const { client_id, ...row } = parsed.data
  try {
    const supabase = await createSupabase()
    const { data, error } = await supabase
      .from("clients")
      .update(row)
      .eq("id", client_id)
      .select("id")
    if (error) {
      console.error("[actions/clients] saveClientFiscal:", safeErrorLog(error))
      return { ok: false, message: "Não foi possível salvar os dados fiscais. Tente novamente." }
    }
    if (!data || data.length === 0) return { ok: false, message: RLS_BLOCK_MESSAGE }
    revalidatePath(`/clientes/${client_id}`)
    return { ok: true, message: "Dados fiscais atualizados.", id: client_id }
  } catch (error) {
    console.error("[actions/clients] saveClientFiscal:", safeErrorLog(error))
    return { ok: false, message: "Não foi possível salvar os dados fiscais. Tente novamente." }
  }
}
