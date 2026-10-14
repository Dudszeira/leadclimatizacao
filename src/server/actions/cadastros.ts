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
  buildingSchema,
  equipmentSchema,
  fieldErrorsFrom,
  leadSchema,
  moveLeadSchema,
  type BuildingInput,
  type EquipmentInput,
  type LeadInput,
} from "@/components/clientes/schemas"
import { onlyDigits } from "@/components/clientes/validators"

const INVALID = "Revise os campos destacados antes de salvar."
const GENERIC = "Não foi possível salvar. Tente novamente."

type PgError = { code?: string; message?: string } | null

function isUniqueViolation(error: PgError): boolean {
  return error?.code === "23505"
}

function isFkViolation(error: PgError): boolean {
  return error?.code === "23503"
}

// ---------------------------------------------------------------------------
// Prédios
// ---------------------------------------------------------------------------

export async function saveBuilding(input: BuildingInput): Promise<ActionResult> {
  const auth = await authorizeAction("admin", "atendente")
  if (auth.error !== null) return { ok: false, message: auth.error }
  const parsed = buildingSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: INVALID, fieldErrors: fieldErrorsFrom(parsed.error) }
  }
  if (isDemoMode) return { ok: true, demo: true, message: DEMO_MESSAGE }

  const { id, ...row } = parsed.data
  try {
    const supabase = await createSupabase()
    if (id) {
      // client_id não muda na edição (prédio não troca de dono)
      const { client_id, ...update } = row
      const { data, error } = await supabase
        .from("buildings")
        .update(update)
        .eq("id", id)
        .eq("client_id", client_id)
        .select("id")
      if (error) {
        console.error("[actions/cadastros] saveBuilding update:", error)
        return { ok: false, message: GENERIC }
      }
      if (!data || data.length === 0) return { ok: false, message: RLS_BLOCK_MESSAGE }
    } else {
      const { error } = await supabase.from("buildings").insert(row)
      if (error) {
        console.error("[actions/cadastros] saveBuilding insert:", error)
        return { ok: false, message: GENERIC }
      }
    }
    revalidatePath(`/clientes/${row.client_id}`)
    revalidatePath("/mapa")
    return { ok: true, message: id ? "Prédio atualizado." : "Prédio cadastrado." }
  } catch (error) {
    console.error("[actions/cadastros] saveBuilding:", error)
    return { ok: false, message: GENERIC }
  }
}

const idSchema = z.uuid()

/**
 * Exclui um prédio SEM equipamentos e sem OS (a FK de equipment é cascade —
 * por isso a checagem explícita). Só admin (RLS de delete é só admin).
 */
export async function deleteBuilding(id: string): Promise<ActionResult> {
  const auth = await authorizeAction("admin")
  if (auth.error !== null) return { ok: false, message: auth.error }
  const parsed = idSchema.safeParse(id)
  if (!parsed.success) return { ok: false, message: "Prédio inválido." }
  if (isDemoMode) return { ok: true, demo: true, message: DEMO_MESSAGE }

  try {
    const supabase = await createSupabase()
    const [eq, os] = await Promise.all([
      supabase.from("equipment").select("id", { count: "exact", head: true }).eq("building_id", parsed.data),
      supabase.from("service_orders").select("id", { count: "exact", head: true }).eq("building_id", parsed.data),
    ])
    if (eq.error || os.error) {
      console.error("[actions/cadastros] deleteBuilding check:", eq.error ?? os.error)
      return { ok: false, message: "Não foi possível excluir o prédio. Tente novamente." }
    }
    if ((eq.count ?? 0) > 0) {
      return { ok: false, message: "O prédio tem equipamentos cadastrados — inative-os ou mova antes de excluir." }
    }
    if ((os.count ?? 0) > 0) {
      return { ok: false, message: "O prédio tem histórico de OS e não pode ser excluído." }
    }
    const { data, error } = await supabase
      .from("buildings")
      .delete()
      .eq("id", parsed.data)
      .select("id, client_id")
    if (error) {
      console.error("[actions/cadastros] deleteBuilding:", error)
      return {
        ok: false,
        message: isFkViolation(error)
          ? "O prédio tem registros vinculados e não pode ser excluído."
          : "Não foi possível excluir o prédio. Tente novamente.",
      }
    }
    if (!data || data.length === 0) return { ok: false, message: RLS_BLOCK_MESSAGE }
    revalidatePath(`/clientes/${data[0].client_id}`)
    revalidatePath("/mapa")
    return { ok: true, message: "Prédio excluído." }
  } catch (error) {
    console.error("[actions/cadastros] deleteBuilding:", error)
    return { ok: false, message: "Não foi possível excluir o prédio. Tente novamente." }
  }
}

// ---------------------------------------------------------------------------
// Geocodificação (Nominatim/OSM) — só no servidor, opcional
// ---------------------------------------------------------------------------

const geocodeSchema = z.object({
  logradouro: z.string().trim().max(200),
  numero: z.string().trim().max(20),
  bairro: z.string().trim().max(80),
  cidade: z.string().trim().min(2, "Informe a cidade.").max(80),
  uf: z.string().trim().length(2, "Informe a UF."),
  cep: z.string().trim().max(10),
})

export interface GeocodeResult extends ActionResult {
  lat?: number
  lng?: number
  /** Endereço que o Nominatim encontrou (para o usuário conferir). */
  encontrado?: string
}

// Política de uso do Nominatim: no máximo 1 requisição/segundo por aplicação.
let ultimaConsulta = 0

/**
 * Busca lat/lng do endereço no Nominatim (OpenStreetMap). Chamada feita só do
 * servidor (a CSP do navegador não precisa liberar o domínio), com
 * User-Agent identificado e timeout de 6 s. Resultado é sugestão: o usuário
 * confere e pode editar os campos manualmente.
 */
export async function buscarCoordenadas(
  input: z.input<typeof geocodeSchema>,
): Promise<GeocodeResult> {
  const auth = await authorizeAction("admin", "atendente")
  if (auth.error !== null) return { ok: false, message: auth.error }
  const parsed = geocodeSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: "Preencha ao menos logradouro, cidade e UF." }
  }
  const { logradouro, numero, cidade, uf, cep } = parsed.data
  if (!logradouro && onlyDigits(cep).length !== 8) {
    return { ok: false, message: "Informe o logradouro ou um CEP completo para buscar." }
  }

  const agora = Date.now()
  if (agora - ultimaConsulta < 1100) {
    return { ok: false, message: "Aguarde um instante e tente de novo." }
  }
  ultimaConsulta = agora

  const params = new URLSearchParams({
    format: "jsonv2",
    limit: "1",
    countrycodes: "br",
    "accept-language": "pt-BR",
    city: cidade,
    state: uf,
  })
  if (logradouro) params.set("street", [numero, logradouro].filter(Boolean).join(" "))
  if (onlyDigits(cep).length === 8) params.set("postalcode", cep)

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        "User-Agent": "ControlLead/1.0 (Lead Climatizacao, Curitiba-PR; gestao de manutencao)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    })
    if (!res.ok) {
      console.error("[actions/cadastros] nominatim status:", res.status)
      return { ok: false, message: "Serviço de mapas indisponível agora — preencha manualmente." }
    }
    const json = (await res.json()) as Array<{ lat: string; lon: string; display_name?: string }>
    const hit = json[0]
    if (!hit) return { ok: false, message: "Endereço não encontrado — confira ou preencha manualmente." }
    const lat = Number(hit.lat)
    const lng = Number(hit.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { ok: false, message: "Resposta inválida do serviço de mapas." }
    }
    return {
      ok: true,
      message: "Coordenadas encontradas — confira antes de salvar.",
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
      encontrado: hit.display_name?.slice(0, 200),
    }
  } catch (error) {
    console.error("[actions/cadastros] nominatim:", error)
    return { ok: false, message: "Tempo esgotado ao buscar coordenadas — preencha manualmente." }
  }
}

// ---------------------------------------------------------------------------
// Equipamentos
// ---------------------------------------------------------------------------

export async function saveEquipment(input: EquipmentInput): Promise<ActionResult> {
  const auth = await authorizeAction("admin", "atendente")
  if (auth.error !== null) return { ok: false, message: auth.error }
  const parsed = equipmentSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: INVALID, fieldErrors: fieldErrorsFrom(parsed.error) }
  }
  if (isDemoMode) return { ok: true, demo: true, message: DEMO_MESSAGE }

  const { id, ...row } = parsed.data
  try {
    const supabase = await createSupabase()
    const { data: building, error: bError } = await supabase
      .from("buildings")
      .select("id, client_id")
      .eq("id", row.building_id)
      .maybeSingle()
    if (bError || !building) {
      if (bError) console.error("[actions/cadastros] saveEquipment building:", bError)
      return { ok: false, message: "Prédio não encontrado.", fieldErrors: { building_id: "Prédio inválido." } }
    }

    let error: PgError = null
    if (id) {
      // status não é editável aqui: é derivado das OS (0005) ou pelo inativar
      const res = await supabase.from("equipment").update(row).eq("id", id).select("id")
      error = res.error
      if (!error && (!res.data || res.data.length === 0)) {
        return { ok: false, message: RLS_BLOCK_MESSAGE }
      }
    } else {
      const res = await supabase.from("equipment").insert({ ...row, status: "operacional" })
      error = res.error
    }
    if (error) {
      console.error("[actions/cadastros] saveEquipment:", error)
      if (isUniqueViolation(error)) {
        const serie = (error.message ?? "").includes("numero_serie")
        return {
          ok: false,
          message: serie
            ? "Número de série já cadastrado em outro equipamento."
            : "Já existe um equipamento com este código interno no prédio.",
          fieldErrors: serie
            ? { numero_serie: "Número de série já cadastrado." }
            : { codigo_interno: "Código já usado neste prédio." },
        }
      }
      return { ok: false, message: GENERIC }
    }
    revalidatePath(`/clientes/${building.client_id}`)
    revalidatePath("/mapa")
    return { ok: true, message: id ? "Equipamento atualizado." : "Equipamento cadastrado." }
  } catch (error) {
    console.error("[actions/cadastros] saveEquipment:", error)
    return { ok: false, message: GENERIC }
  }
}

const equipAtivoSchema = z.object({ id: z.uuid(), ativo: z.boolean() })

/**
 * Inativa (status 'inativo' — os triggers de OS e o job PMOC passam a ignorar)
 * ou reativa ('operacional'). Não apaga: o equipamento tem histórico de OS.
 */
export async function setEquipmentAtivo(input: { id: string; ativo: boolean }): Promise<ActionResult> {
  const auth = await authorizeAction("admin", "atendente")
  if (auth.error !== null) return { ok: false, message: auth.error }
  const parsed = equipAtivoSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: "Equipamento inválido." }
  if (isDemoMode) return { ok: true, demo: true, message: DEMO_MESSAGE }

  try {
    const supabase = await createSupabase()
    const { data, error } = await supabase
      .from("equipment")
      .update({ status: parsed.data.ativo ? "operacional" : "inativo" })
      .eq("id", parsed.data.id)
      .select("id, building:buildings(client_id)")
    if (error) {
      console.error("[actions/cadastros] setEquipmentAtivo:", error)
      return { ok: false, message: "Não foi possível alterar o equipamento. Tente novamente." }
    }
    if (!data || data.length === 0) return { ok: false, message: RLS_BLOCK_MESSAGE }
    const building = (data[0] as unknown as { building: { client_id: string } | null }).building
    if (building) revalidatePath(`/clientes/${building.client_id}`)
    revalidatePath("/pmoc")
    revalidatePath("/mapa")
    return {
      ok: true,
      message: parsed.data.ativo ? "Equipamento reativado." : "Equipamento inativado.",
    }
  } catch (error) {
    console.error("[actions/cadastros] setEquipmentAtivo:", error)
    return { ok: false, message: "Não foi possível alterar o equipamento. Tente novamente." }
  }
}

// ---------------------------------------------------------------------------
// Leads (funil comercial)
// ---------------------------------------------------------------------------

export async function saveLead(input: LeadInput): Promise<ActionResult> {
  const auth = await authorizeAction("admin", "atendente")
  if (auth.error !== null) return { ok: false, message: auth.error }
  const parsed = leadSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: INVALID, fieldErrors: fieldErrorsFrom(parsed.error) }
  }
  if (isDemoMode) return { ok: true, demo: true, message: DEMO_MESSAGE }

  const { id, ...rest } = parsed.data
  const row = { ...rest, motivo_perda: rest.estagio === "perdido" ? rest.motivo_perda : null }
  try {
    const supabase = await createSupabase()
    if (id) {
      const { data, error } = await supabase.from("leads").update(row).eq("id", id).select("id")
      if (error) {
        console.error("[actions/cadastros] saveLead update:", error)
        return { ok: false, message: GENERIC }
      }
      if (!data || data.length === 0) return { ok: false, message: RLS_BLOCK_MESSAGE }
    } else {
      const { error } = await supabase.from("leads").insert(row)
      if (error) {
        console.error("[actions/cadastros] saveLead insert:", error)
        return { ok: false, message: GENERIC }
      }
    }
    revalidatePath("/clientes/funil")
    revalidatePath("/")
    return { ok: true, message: id ? "Lead atualizado." : "Lead cadastrado." }
  } catch (error) {
    console.error("[actions/cadastros] saveLead:", error)
    return { ok: false, message: GENERIC }
  }
}

export async function moveLeadStage(input: z.input<typeof moveLeadSchema>): Promise<ActionResult> {
  const auth = await authorizeAction("admin", "atendente")
  if (auth.error !== null) return { ok: false, message: auth.error }
  const parsed = moveLeadSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Etapa inválida." }
  }
  if (isDemoMode) return { ok: true, demo: true, message: DEMO_MESSAGE }

  const { id, estagio, motivo_perda } = parsed.data
  try {
    const supabase = await createSupabase()
    const { data, error } = await supabase
      .from("leads")
      .update({ estagio, motivo_perda: estagio === "perdido" ? motivo_perda ?? null : null })
      .eq("id", id)
      .select("id")
    if (error) {
      console.error("[actions/cadastros] moveLeadStage:", error)
      return { ok: false, message: "Não foi possível mover o lead. Tente novamente." }
    }
    if (!data || data.length === 0) return { ok: false, message: RLS_BLOCK_MESSAGE }
    revalidatePath("/clientes/funil")
    revalidatePath("/")
    return { ok: true, message: "Lead movido." }
  } catch (error) {
    console.error("[actions/cadastros] moveLeadStage:", error)
    return { ok: false, message: "Não foi possível mover o lead. Tente novamente." }
  }
}

/** Exclusão definitiva de lead — só admin (RLS de delete é só admin). */
export async function deleteLead(id: string): Promise<ActionResult> {
  const auth = await authorizeAction("admin")
  if (auth.error !== null) return { ok: false, message: auth.error }
  const parsed = idSchema.safeParse(id)
  if (!parsed.success) return { ok: false, message: "Lead inválido." }
  if (isDemoMode) return { ok: true, demo: true, message: DEMO_MESSAGE }

  try {
    const supabase = await createSupabase()
    const { data, error } = await supabase.from("leads").delete().eq("id", parsed.data).select("id")
    if (error) {
      console.error("[actions/cadastros] deleteLead:", error)
      return { ok: false, message: "Não foi possível excluir o lead. Tente novamente." }
    }
    if (!data || data.length === 0) return { ok: false, message: RLS_BLOCK_MESSAGE }
    revalidatePath("/clientes/funil")
    revalidatePath("/")
    return { ok: true, message: "Lead excluído." }
  } catch (error) {
    console.error("[actions/cadastros] deleteLead:", error)
    return { ok: false, message: "Não foi possível excluir o lead. Tente novamente." }
  }
}
