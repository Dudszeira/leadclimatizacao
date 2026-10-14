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
  fieldErrorsFrom,
  pmocPlanSchema,
  type PmocPlanInput,
} from "@/components/clientes/schemas"

export interface GerarOsPmocState {
  status: "success" | "error"
  message: string
}

/**
 * Dispara a RPC generate_pmoc_service_orders(p_janela_dias := 7): gera OS
 * preventivas para os planos atrasados e para os que vencem nos próximos
 * 7 dias. Idempotente no banco — não duplica enquanto houver OS em andamento
 * ligada ao plano. Em modo demo não grava nada e devolve mensagem para toast.
 * Só admin: a RPC recusa qualquer outro papel (0005).
 */
export async function gerarOsPmoc(): Promise<GerarOsPmocState> {
  const auth = await authorizeAction("admin")
  if (auth.error !== null) return { status: "error", message: auth.error }
  if (isDemoMode) {
    return {
      status: "error",
      message:
        "Modo demonstração — a geração de OS será habilitada quando o banco do cliente for conectado.",
    }
  }

  try {
    const supabase = await createSupabase()
    const { data, error } = await supabase.rpc("generate_pmoc_service_orders", {
      p_janela_dias: 7,
    })
    if (error) {
      console.error("[actions/pmoc] generate_pmoc_service_orders:", error)
      return {
        status: "error",
        message: "Não foi possível gerar as OS agora. Tente novamente.",
      }
    }

    revalidatePath("/pmoc")
    revalidatePath("/chamados")

    const criadas = typeof data === "number" ? data : 0
    if (criadas === 0) {
      return {
        status: "success",
        message:
          "Nenhuma OS nova — os planos devidos já têm OS em andamento.",
      }
    }
    return {
      status: "success",
      message:
        criadas === 1
          ? "1 OS preventiva gerada com sucesso."
          : `${criadas} OS preventivas geradas com sucesso.`,
    }
  } catch (error) {
    console.error("[actions/pmoc] gerarOsPmoc:", error)
    return {
      status: "error",
      message: "Não foi possível gerar as OS agora. Tente novamente.",
    }
  }
}

// ---------------------------------------------------------------------------
// CRUD de planos PMOC
// ---------------------------------------------------------------------------

/**
 * Cria ou edita o plano PMOC de um equipamento (1 plano por equipamento —
 * unique(equipment_id)). Criar sobre um plano encerrado o reativa com os
 * novos dados. A proxima_data informada aqui é a única edição manual: depois
 * o banco a avança sozinho na CONCLUSÃO de cada OS preventiva.
 */
export async function savePmocPlan(input: PmocPlanInput): Promise<ActionResult> {
  const auth = await authorizeAction("admin", "atendente")
  if (auth.error !== null) return { ok: false, message: auth.error }
  const parsed = pmocPlanSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revise os campos destacados antes de salvar.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    }
  }
  if (isDemoMode) return { ok: true, demo: true, message: DEMO_MESSAGE }

  const { id, ...row } = parsed.data
  try {
    const supabase = await createSupabase()
    const { data: equipment, error: eqError } = await supabase
      .from("equipment")
      .select("id, status, building:buildings(client_id)")
      .eq("id", row.equipment_id)
      .maybeSingle()
    if (eqError || !equipment) {
      if (eqError) console.error("[actions/pmoc] savePmocPlan equipment:", eqError)
      return { ok: false, message: "Equipamento não encontrado.", fieldErrors: { equipment_id: "Equipamento inválido." } }
    }
    if (equipment.status === "inativo") {
      return { ok: false, message: "Equipamento inativo — reative-o antes de manter um plano PMOC." }
    }
    const clientId = (equipment as unknown as { building: { client_id: string } | null }).building?.client_id

    let planId = id
    if (!planId) {
      const { data: existente, error: exError } = await supabase
        .from("pmoc_plans")
        .select("id, ativo")
        .eq("equipment_id", row.equipment_id)
        .maybeSingle()
      if (exError) {
        console.error("[actions/pmoc] savePmocPlan existente:", exError)
        return { ok: false, message: "Não foi possível salvar o plano. Tente novamente." }
      }
      if (existente?.ativo) {
        return { ok: false, message: "Este equipamento já tem um plano PMOC ativo — edite o plano existente." }
      }
      planId = existente?.id
    }

    if (planId) {
      const { equipment_id, ...update } = row
      const { data, error } = await supabase
        .from("pmoc_plans")
        .update({ ...update, ativo: true })
        .eq("id", planId)
        .eq("equipment_id", equipment_id)
        .select("id")
      if (error) {
        console.error("[actions/pmoc] savePmocPlan update:", error)
        return { ok: false, message: "Não foi possível salvar o plano. Tente novamente." }
      }
      if (!data || data.length === 0) return { ok: false, message: RLS_BLOCK_MESSAGE }
    } else {
      const { error } = await supabase.from("pmoc_plans").insert({ ...row, ativo: true })
      if (error) {
        console.error("[actions/pmoc] savePmocPlan insert:", error)
        return { ok: false, message: "Não foi possível criar o plano. Tente novamente." }
      }
    }

    revalidatePath("/pmoc")
    if (clientId) revalidatePath(`/clientes/${clientId}`)
    return { ok: true, message: id ? "Plano PMOC atualizado." : "Plano PMOC salvo." }
  } catch (error) {
    console.error("[actions/pmoc] savePmocPlan:", error)
    return { ok: false, message: "Não foi possível salvar o plano. Tente novamente." }
  }
}

const planAtivoSchema = z.object({ id: z.uuid(), ativo: z.boolean() })

/** Encerra (ativo=false) ou reabre um plano. Nunca apaga: OS antigas apontam para ele. */
export async function setPmocPlanAtivo(input: { id: string; ativo: boolean }): Promise<ActionResult> {
  const auth = await authorizeAction("admin", "atendente")
  if (auth.error !== null) return { ok: false, message: auth.error }
  const parsed = planAtivoSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: "Plano inválido." }
  if (isDemoMode) return { ok: true, demo: true, message: DEMO_MESSAGE }

  try {
    const supabase = await createSupabase()
    const { data, error } = await supabase
      .from("pmoc_plans")
      .update({ ativo: parsed.data.ativo })
      .eq("id", parsed.data.id)
      .select("id, equipment:equipment(building:buildings(client_id))")
    if (error) {
      console.error("[actions/pmoc] setPmocPlanAtivo:", error)
      return { ok: false, message: "Não foi possível alterar o plano. Tente novamente." }
    }
    if (!data || data.length === 0) return { ok: false, message: RLS_BLOCK_MESSAGE }
    const clientId = (data[0] as unknown as {
      equipment: { building: { client_id: string } | null } | null
    }).equipment?.building?.client_id
    revalidatePath("/pmoc")
    if (clientId) revalidatePath(`/clientes/${clientId}`)
    return {
      ok: true,
      message: parsed.data.ativo
        ? "Plano reaberto."
        : "Plano encerrado — OS já geradas continuam abertas até serem concluídas ou canceladas.",
    }
  } catch (error) {
    console.error("[actions/pmoc] setPmocPlanAtivo:", error)
    return { ok: false, message: "Não foi possível alterar o plano. Tente novamente." }
  }
}
