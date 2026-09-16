"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isDemoMode } from "@/lib/env"
import { createClient as createSupabase } from "@/lib/supabase/server"

/**
 * Server actions da Central de Chamados — mesmo padrão de actions/clients.ts:
 * validação zod no servidor, modo demo devolve mensagem amigável (toast na UI)
 * e com Supabase real faz o update + revalidatePath.
 */

export interface OsActionResult {
  status: "success" | "error"
  message: string
}

const DEMO_MESSAGE =
  "Modo demonstração — as ações de chamado serão habilitadas quando o banco do cliente for conectado."

function demoResult(): OsActionResult {
  return { status: "error", message: DEMO_MESSAGE }
}

function revalidateOs(osId: string) {
  revalidatePath("/chamados")
  revalidatePath(`/chamados/${osId}`)
}

// ---------------------------------------------------------------------------
// Abertura manual de chamado (Dialog "Novo chamado")
// ---------------------------------------------------------------------------

export interface NewOsFieldErrors {
  client_id?: string
  building_id?: string
  tipo?: string
  prioridade?: string
  descricao?: string
}

export interface NewOsActionState {
  status: "idle" | "success" | "error"
  message?: string
  fieldErrors?: NewOsFieldErrors
}

const newOsSchema = z.object({
  client_id: z.uuid("Selecione o cliente."),
  building_id: z.uuid("Selecione o prédio."),
  equipment_id: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.uuid("Equipamento inválido.").optional()),
  tipo: z.enum(["preventiva_pmoc", "corretiva", "instalacao", "orcamento"], {
    error: "Selecione o tipo de serviço.",
  }),
  prioridade: z.enum(["baixa", "media", "alta", "urgente"], {
    error: "Selecione a prioridade.",
  }),
  descricao: z
    .string({ error: "Descreva o problema ou serviço." })
    .trim()
    .min(10, "Descreva o problema com pelo menos 10 caracteres."),
})

/** Cria uma OS manual (status "aberto", origem "manual"). */
export async function createServiceOrder(
  _prevState: NewOsActionState,
  formData: FormData,
): Promise<NewOsActionState> {
  const raw = {
    client_id: String(formData.get("client_id") ?? ""),
    building_id: String(formData.get("building_id") ?? ""),
    equipment_id: String(formData.get("equipment_id") ?? ""),
    tipo: String(formData.get("tipo") ?? ""),
    prioridade: String(formData.get("prioridade") ?? ""),
    descricao: String(formData.get("descricao") ?? ""),
  }

  const parsed = newOsSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: NewOsFieldErrors = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof NewOsFieldErrors | undefined
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message
    }
    return {
      status: "error",
      message: "Revise os campos destacados antes de abrir o chamado.",
      fieldErrors,
    }
  }

  if (isDemoMode) {
    return {
      status: "error",
      message:
        "Modo demonstração — a abertura de chamados será habilitada quando o banco do cliente for conectado.",
    }
  }

  const { building_id, equipment_id, tipo, prioridade, descricao } = parsed.data

  try {
    const supabase = await createSupabase()
    const { error } = await supabase.from("service_orders").insert({
      tipo,
      prioridade,
      status: "aberto",
      origem: "manual",
      building_id,
      equipment_id: equipment_id ?? null,
      descricao,
    })
    if (error) {
      console.error("[actions/service-orders] create:", error)
      return {
        status: "error",
        message: "Não foi possível abrir o chamado. Tente novamente.",
      }
    }
  } catch (error) {
    console.error("[actions/service-orders] createServiceOrder:", error)
    return {
      status: "error",
      message: "Não foi possível abrir o chamado. Tente novamente.",
    }
  }

  revalidatePath("/chamados")
  return { status: "success", message: "Chamado aberto com sucesso." }
}

// ---------------------------------------------------------------------------
// Ações do ciclo de vida da OS (página de execução)
// ---------------------------------------------------------------------------

const osIdSchema = z.uuid()

/** Designa (ou troca) o técnico responsável pela OS. */
export async function assignTechnician(
  osId: string,
  technicianId: string,
): Promise<OsActionResult> {
  const id = osIdSchema.safeParse(osId)
  const tech = osIdSchema.safeParse(technicianId)
  if (!id.success || !tech.success) {
    return { status: "error", message: "Dados inválidos — recarregue a página e tente novamente." }
  }
  if (isDemoMode) return demoResult()

  try {
    const supabase = await createSupabase()
    const { error } = await supabase
      .from("service_orders")
      .update({ technician_id: tech.data })
      .eq("id", id.data)
    if (error) {
      console.error("[actions/service-orders] assignTechnician:", error)
      return { status: "error", message: "Não foi possível designar o técnico. Tente novamente." }
    }
  } catch (error) {
    console.error("[actions/service-orders] assignTechnician:", error)
    return { status: "error", message: "Não foi possível designar o técnico. Tente novamente." }
  }

  revalidateOs(id.data)
  return { status: "success", message: "Técnico designado." }
}

const scheduleSchema = z.object({
  osId: z.uuid(),
  /** ISO 8601 da visita agendada. */
  scheduledAt: z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), {
    message: "Data inválida.",
  }),
})

/** Agenda a visita: grava scheduled_at e move a OS para "agendado". */
export async function scheduleServiceOrder(
  osId: string,
  scheduledAt: string,
): Promise<OsActionResult> {
  const parsed = scheduleSchema.safeParse({ osId, scheduledAt })
  if (!parsed.success) {
    return { status: "error", message: "Selecione uma data válida para o agendamento." }
  }
  if (isDemoMode) return demoResult()

  try {
    const supabase = await createSupabase()
    const { error } = await supabase
      .from("service_orders")
      .update({
        scheduled_at: new Date(parsed.data.scheduledAt).toISOString(),
        status: "agendado",
      })
      .eq("id", parsed.data.osId)
    if (error) {
      console.error("[actions/service-orders] schedule:", error)
      return { status: "error", message: "Não foi possível agendar a visita. Tente novamente." }
    }
  } catch (error) {
    console.error("[actions/service-orders] scheduleServiceOrder:", error)
    return { status: "error", message: "Não foi possível agendar a visita. Tente novamente." }
  }

  revalidateOs(parsed.data.osId)
  return { status: "success", message: "Visita agendada." }
}

const startSchema = z.object({
  osId: z.uuid(),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
})

/** Registra o check-in em campo: status "em_campo" + hora (e lat/lng se houver). */
export async function startServiceOrder(
  osId: string,
  coords: { lat: number | null; lng: number | null },
): Promise<OsActionResult> {
  const parsed = startSchema.safeParse({ osId, lat: coords.lat, lng: coords.lng })
  if (!parsed.success) {
    return { status: "error", message: "Dados inválidos — recarregue a página e tente novamente." }
  }
  if (isDemoMode) return demoResult()

  try {
    const supabase = await createSupabase()
    const { error } = await supabase
      .from("service_orders")
      .update({
        status: "em_campo",
        checkin_at: new Date().toISOString(),
        checkin_lat: parsed.data.lat,
        checkin_lng: parsed.data.lng,
      })
      .eq("id", parsed.data.osId)
    if (error) {
      console.error("[actions/service-orders] start:", error)
      return { status: "error", message: "Não foi possível registrar o check-in. Tente novamente." }
    }
  } catch (error) {
    console.error("[actions/service-orders] startServiceOrder:", error)
    return { status: "error", message: "Não foi possível registrar o check-in. Tente novamente." }
  }

  revalidateOs(parsed.data.osId)
  return { status: "success", message: "Atendimento iniciado — check-in registrado." }
}

/** Conclui a OS: status "concluido" + concluded_at agora. */
export async function concludeServiceOrder(osId: string): Promise<OsActionResult> {
  const id = osIdSchema.safeParse(osId)
  if (!id.success) {
    return { status: "error", message: "Dados inválidos — recarregue a página e tente novamente." }
  }
  if (isDemoMode) return demoResult()

  try {
    const supabase = await createSupabase()
    const { error } = await supabase
      .from("service_orders")
      .update({ status: "concluido", concluded_at: new Date().toISOString() })
      .eq("id", id.data)
    if (error) {
      console.error("[actions/service-orders] conclude:", error)
      return { status: "error", message: "Não foi possível concluir o chamado. Tente novamente." }
    }
  } catch (error) {
    console.error("[actions/service-orders] concludeServiceOrder:", error)
    return { status: "error", message: "Não foi possível concluir o chamado. Tente novamente." }
  }

  revalidateOs(id.data)
  return { status: "success", message: "Chamado concluído." }
}

/** Cancela a OS (confirmada via Dialog na UI). */
export async function cancelServiceOrder(osId: string): Promise<OsActionResult> {
  const id = osIdSchema.safeParse(osId)
  if (!id.success) {
    return { status: "error", message: "Dados inválidos — recarregue a página e tente novamente." }
  }
  if (isDemoMode) return demoResult()

  try {
    const supabase = await createSupabase()
    const { error } = await supabase
      .from("service_orders")
      .update({ status: "cancelado" })
      .eq("id", id.data)
    if (error) {
      console.error("[actions/service-orders] cancel:", error)
      return { status: "error", message: "Não foi possível cancelar o chamado. Tente novamente." }
    }
  } catch (error) {
    console.error("[actions/service-orders] cancelServiceOrder:", error)
    return { status: "error", message: "Não foi possível cancelar o chamado. Tente novamente." }
  }

  revalidateOs(id.data)
  return { status: "success", message: "Chamado cancelado." }
}
