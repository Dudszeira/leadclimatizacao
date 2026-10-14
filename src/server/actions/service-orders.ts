"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isDemoMode } from "@/lib/env"
import { createClient as createSupabase } from "@/lib/supabase/server"
import {
  STORAGE_BUCKETS,
  type ChecklistItem,
  type ChecklistRespostas,
  type EquipmentOption,
  type OsStatus,
  type ServiceOrderPhotoView,
} from "@/lib/types"
import {
  buildingsFixture,
  checklistTemplatesFixture,
  equipmentFixture,
  serviceOrdersFixture,
} from "@/lib/fixtures"
import { authorizeAction, authorizeServiceOrder, type SessionProfile } from "@/server/auth"
import { listEquipment } from "@/server/equipment"
import {
  CHECKLIST_TEXT_MAX,
  LEGENDA_MAX,
  PHOTO_ALLOWED_TYPES,
  PHOTO_MAX_BYTES,
  SIGNATURE_MAX_BYTES,
  SIGNATURE_TYPE,
  evaluateConclusion,
  isValidOsStoragePath,
  normalizeChecklistAnswers,
  sourceStatusesFor,
  validatePhotoUpload,
  validateSignatureUpload,
} from "@/components/chamados/execution-rules"

/**
 * Server actions da Central de Chamados e da execução em campo.
 *
 * Toda mudança de status é CONDICIONAL ao status atual (.in("status", ...))
 * e confere as linhas afetadas com .select("id"): se a RLS/guard bloquear ou
 * a OS já tiver mudado, a UI recebe erro claro em vez de falso sucesso.
 * concluded_at, reprogramação PMOC e equipment.status são do banco.
 *
 * Modo demo: valida a entrada e devolve sucesso com `demo: true` — a tela
 * mantém o estado em memória e avisa "modo demo, não salvo".
 */

export interface OsActionResult {
  status: "success" | "error"
  message: string
  /** true quando nada foi gravado (modo demonstração). */
  demo?: boolean
}

const DEMO_SUFFIX = " (modo demo, não salvo)"

function success(message: string): OsActionResult {
  return isDemoMode
    ? { status: "success", message: `${message}${DEMO_SUFFIX}`, demo: true }
    : { status: "success", message }
}

function error(message: string): OsActionResult {
  return { status: "error", message }
}

const INVALID = "Dados inválidos — recarregue a página e tente novamente."
const STALE =
  "A OS mudou de status ou você não tem permissão para esta ação. Recarregue a página."

function revalidateOs(osId: string) {
  revalidatePath("/chamados")
  revalidatePath(`/chamados/${osId}`)
  revalidatePath("/campo")
}

type SupabaseServer = Awaited<ReturnType<typeof createSupabase>>

/** Traduz o erro do PostgREST (guard do banco = 42501) para pt-BR. */
function dbError(context: string, err: unknown, fallback: string): OsActionResult {
  console.error(`[actions/service-orders] ${context}:`, err)
  const code = (err as { code?: string } | null)?.code
  if (code === "42501") return error("Sem permissão para esta mudança nesta OS.")
  return error(fallback)
}

/**
 * Update condicional: só aplica se o status atual estiver em `from` (e, para
 * técnico, se a OS for dele). 0 linhas = bloqueado/obsoleto.
 */
async function guardedUpdate(
  supabase: SupabaseServer,
  context: string,
  osId: string,
  patch: Record<string, unknown>,
  from: OsStatus[],
  profile: SessionProfile,
  fallback: string,
): Promise<OsActionResult | null> {
  if (from.length === 0) return error("Sem permissão para esta mudança nesta OS.")
  let query = supabase.from("service_orders").update(patch).eq("id", osId).in("status", from)
  if (profile.role === "tecnico") query = query.eq("technician_id", profile.id)
  const { data, error: err } = await query.select("id")
  if (err) return dbError(context, err, fallback)
  if (!data || data.length === 0) return error(STALE)
  return null
}

const uuid = z.uuid()

// ---------------------------------------------------------------------------
// Abertura manual de chamado (Dialog "Novo chamado")
// ---------------------------------------------------------------------------

export interface NewOsFieldErrors {
  client_id?: string
  building_id?: string
  equipment_id?: string
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
    .min(10, "Descreva o problema com pelo menos 10 caracteres.")
    .max(4000, "Descrição muito longa (máx. 4000 caracteres)."),
})

type Consistency = { ok: true } | { ok: false; fieldErrors: NewOsFieldErrors } | { ok: "error" }

/** Prédio pertence ao cliente e equipamento pertence ao prédio. */
async function checkLocationConsistency(
  clientId: string,
  buildingId: string,
  equipmentId: string | undefined,
): Promise<Consistency> {
  let buildingClient: string | null
  let equipmentBuilding: string | null = null

  if (isDemoMode) {
    buildingClient = buildingsFixture.find((b) => b.id === buildingId)?.client_id ?? null
    if (equipmentId) {
      equipmentBuilding = equipmentFixture.find((e) => e.id === equipmentId)?.building_id ?? null
    }
  } else {
    const supabase = await createSupabase()
    const { data: b, error: bErr } = await supabase
      .from("buildings")
      .select("client_id")
      .eq("id", buildingId)
      .maybeSingle()
    if (bErr) {
      console.error("[actions/service-orders] consistency building:", bErr)
      return { ok: "error" }
    }
    buildingClient = (b?.client_id as string | undefined) ?? null
    if (equipmentId) {
      const { data: e, error: eErr } = await supabase
        .from("equipment")
        .select("building_id")
        .eq("id", equipmentId)
        .maybeSingle()
      if (eErr) {
        console.error("[actions/service-orders] consistency equipment:", eErr)
        return { ok: "error" }
      }
      equipmentBuilding = (e?.building_id as string | undefined) ?? null
    }
  }

  const fieldErrors: NewOsFieldErrors = {}
  if (buildingClient !== clientId) {
    fieldErrors.building_id = "Este prédio não pertence ao cliente selecionado."
  }
  if (equipmentId && equipmentBuilding !== buildingId) {
    fieldErrors.equipment_id = "Este equipamento não está instalado no prédio selecionado."
  }
  return Object.keys(fieldErrors).length > 0 ? { ok: false, fieldErrors } : { ok: true }
}

/** Cria uma OS manual (status "aberto", origem "manual"). */
export async function createServiceOrder(
  _prevState: NewOsActionState,
  formData: FormData,
): Promise<NewOsActionState> {
  const auth = await authorizeAction("admin", "atendente")
  if (auth.error !== null) return { status: "error", message: auth.error }
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

  const { client_id, building_id, equipment_id, tipo, prioridade, descricao } = parsed.data

  try {
    const consistency = await checkLocationConsistency(client_id, building_id, equipment_id)
    if (consistency.ok === "error") {
      return { status: "error", message: "Não foi possível validar o local. Tente novamente." }
    }
    if (consistency.ok === false) {
      return {
        status: "error",
        message: "Cliente, prédio e equipamento não combinam — revise a seleção.",
        fieldErrors: consistency.fieldErrors,
      }
    }

    if (isDemoMode) {
      return {
        status: "success",
        message: `Chamado validado${DEMO_SUFFIX}.`,
      }
    }

    const supabase = await createSupabase()
    const { data, error: err } = await supabase
      .from("service_orders")
      .insert({
        tipo,
        prioridade,
        status: "aberto",
        origem: "manual",
        building_id,
        equipment_id: equipment_id ?? null,
        descricao,
        created_by: auth.data.id,
      })
      .select("id")
    if (err || !data || data.length === 0) {
      console.error("[actions/service-orders] create:", err)
      return { status: "error", message: "Não foi possível abrir o chamado. Tente novamente." }
    }
  } catch (err) {
    console.error("[actions/service-orders] createServiceOrder:", err)
    return { status: "error", message: "Não foi possível abrir o chamado. Tente novamente." }
  }

  revalidatePath("/chamados")
  return { status: "success", message: "Chamado aberto com sucesso." }
}

/** Busca de equipamentos do prédio para o combobox (sem limite silencioso). */
export async function searchEquipmentOptions(
  buildingId: string,
  search: string,
): Promise<{ items: EquipmentOption[]; total: number; error: string | null }> {
  const auth = await authorizeAction("admin", "atendente")
  if (auth.error !== null) return { items: [], total: 0, error: auth.error }
  const id = uuid.safeParse(buildingId)
  if (!id.success) return { items: [], total: 0, error: "Selecione o prédio primeiro." }
  const term = search.trim().slice(0, 80)

  const result = await listEquipment({
    buildingId: id.data,
    search: term || undefined,
    pageSize: 20,
  })
  if (result.error !== null) return { items: [], total: 0, error: result.error }
  return {
    items: result.data.items.map((e) => ({
      id: e.id,
      building_id: e.building_id,
      label: `${e.codigo_interno}${e.ambiente ? ` — ${e.ambiente}` : ""}${
        e.marca ? ` · ${e.marca}${e.modelo ? ` ${e.modelo}` : ""}` : ""
      }`,
    })),
    total: result.data.total,
    error: null,
  }
}

// ---------------------------------------------------------------------------
// Ciclo de vida (escritório)
// ---------------------------------------------------------------------------

/** Designa (ou troca) o técnico responsável — só em OS aberta/agendada. */
export async function assignTechnician(
  osId: string,
  technicianId: string,
): Promise<OsActionResult> {
  const auth = await authorizeAction("admin", "atendente")
  if (auth.error !== null) return error(auth.error)
  const id = uuid.safeParse(osId)
  const tech = uuid.safeParse(technicianId)
  if (!id.success || !tech.success) return error(INVALID)
  if (isDemoMode) return success("Técnico designado")

  try {
    const supabase = await createSupabase()
    const { data: perfil, error: pErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", tech.data)
      .eq("role", "tecnico")
      .eq("ativo", true)
      .maybeSingle()
    if (pErr) return dbError("assignTechnician profile", pErr, "Não foi possível designar o técnico.")
    if (!perfil) return error("Técnico inválido ou inativo — escolha outro.")

    const blocked = await guardedUpdate(
      supabase,
      "assignTechnician",
      id.data,
      { technician_id: tech.data },
      ["aberto", "agendado"],
      auth.data,
      "Não foi possível designar o técnico. Tente novamente.",
    )
    if (blocked) return blocked
  } catch (err) {
    return dbError("assignTechnician", err, "Não foi possível designar o técnico. Tente novamente.")
  }

  revalidateOs(id.data)
  return success("Técnico designado")
}

const scheduleSchema = z.object({
  osId: z.uuid(),
  scheduledAt: z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), {
    message: "Data inválida.",
  }),
})

/** Agenda/reagenda a visita: scheduled_at + status "agendado". */
export async function scheduleServiceOrder(
  osId: string,
  scheduledAt: string,
): Promise<OsActionResult> {
  const auth = await authorizeAction("admin", "atendente")
  if (auth.error !== null) return error(auth.error)
  const parsed = scheduleSchema.safeParse({ osId, scheduledAt })
  if (!parsed.success) return error("Selecione uma data válida para o agendamento.")
  if (isDemoMode) return success("Visita agendada")

  try {
    const supabase = await createSupabase()
    const blocked = await guardedUpdate(
      supabase,
      "schedule",
      parsed.data.osId,
      { scheduled_at: new Date(parsed.data.scheduledAt).toISOString(), status: "agendado" },
      sourceStatusesFor("agendado", auth.data.role),
      auth.data,
      "Não foi possível agendar a visita. Tente novamente.",
    )
    if (blocked) return blocked
  } catch (err) {
    return dbError("scheduleServiceOrder", err, "Não foi possível agendar a visita. Tente novamente.")
  }

  revalidateOs(parsed.data.osId)
  return success("Visita agendada")
}

/** Cancela a OS (confirmada via Dialog na UI). */
export async function cancelServiceOrder(osId: string): Promise<OsActionResult> {
  const auth = await authorizeAction("admin", "atendente")
  if (auth.error !== null) return error(auth.error)
  const id = uuid.safeParse(osId)
  if (!id.success) return error(INVALID)
  if (isDemoMode) return success("Chamado cancelado")

  try {
    const supabase = await createSupabase()
    const blocked = await guardedUpdate(
      supabase,
      "cancel",
      id.data,
      { status: "cancelado" },
      sourceStatusesFor("cancelado", auth.data.role),
      auth.data,
      "Não foi possível cancelar o chamado. Tente novamente.",
    )
    if (blocked) return blocked
  } catch (err) {
    return dbError("cancelServiceOrder", err, "Não foi possível cancelar o chamado. Tente novamente.")
  }

  revalidateOs(id.data)
  return success("Chamado cancelado")
}

// ---------------------------------------------------------------------------
// Execução em campo (técnico na OS dele, ou escritório)
// ---------------------------------------------------------------------------

const startSchema = z.object({
  osId: z.uuid(),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
})

/** Check-in: aberto|agendado -> em_campo + hora (e lat/lng se o aparelho permitir). */
export async function startServiceOrder(
  osId: string,
  coords: { lat: number | null; lng: number | null },
): Promise<OsActionResult> {
  const auth = await authorizeServiceOrder(osId)
  if (auth.error !== null) return error(auth.error)
  const parsed = startSchema.safeParse({ osId, lat: coords.lat, lng: coords.lng })
  if (!parsed.success) return error(INVALID)
  const comGps = parsed.data.lat !== null && parsed.data.lng !== null
  const msg = comGps ? "Check-in registrado com localização" : "Check-in registrado (sem localização)"
  if (isDemoMode) return success(msg)

  try {
    const supabase = await createSupabase()
    const blocked = await guardedUpdate(
      supabase,
      "start",
      parsed.data.osId,
      {
        status: "em_campo",
        checkin_at: new Date().toISOString(),
        checkin_lat: comGps ? parsed.data.lat : null,
        checkin_lng: comGps ? parsed.data.lng : null,
      },
      sourceStatusesFor("em_campo", auth.data.role),
      auth.data,
      "Não foi possível registrar o check-in. Tente novamente.",
    )
    if (blocked) return blocked
  } catch (err) {
    return dbError("startServiceOrder", err, "Não foi possível registrar o check-in. Tente novamente.")
  }

  revalidateOs(parsed.data.osId)
  return success(msg)
}

/** Itens do template da OS (para validar checklist e conclusão). */
async function loadExecutionContext(
  supabase: SupabaseServer,
  osId: string,
): Promise<
  | {
      status: OsStatus
      itens: ChecklistItem[] | null
      respostas: ChecklistRespostas | null
      assinatura_path: string | null
      assinado_por_nome: string | null
      fotos_depois: string[]
    }
  | null
> {
  const { data, error: err } = await supabase
    .from("service_orders")
    .select(
      "status, checklist_respostas, assinatura_path, assinado_por_nome, fotos_depois, checklist_template:checklist_templates(itens)",
    )
    .eq("id", osId)
    .maybeSingle()
  if (err) throw err
  if (!data) return null
  const row = data as unknown as {
    status: OsStatus
    checklist_respostas: ChecklistRespostas | null
    assinatura_path: string | null
    assinado_por_nome: string | null
    fotos_depois: string[] | null
    checklist_template: { itens: ChecklistItem[] } | { itens: ChecklistItem[] }[] | null
  }
  const tpl = Array.isArray(row.checklist_template)
    ? row.checklist_template[0] ?? null
    : row.checklist_template
  return {
    status: row.status,
    itens: tpl?.itens ?? null,
    respostas: row.checklist_respostas,
    assinatura_path: row.assinatura_path,
    assinado_por_nome: row.assinado_por_nome,
    fotos_depois: row.fotos_depois ?? [],
  }
}

function demoTemplateItens(osId: string): ChecklistItem[] | null {
  const os = serviceOrdersFixture.find((o) => o.id === osId)
  if (!os?.checklist_template_id) return null
  return checklistTemplatesFixture.find((t) => t.id === os.checklist_template_id)?.itens ?? null
}

/** Salva as respostas do checklist (validadas contra o template). */
export async function saveChecklist(osId: string, respostas: unknown): Promise<OsActionResult> {
  const auth = await authorizeServiceOrder(osId)
  if (auth.error !== null) return error(auth.error)
  const id = uuid.safeParse(osId)
  if (!id.success) return error(INVALID)

  try {
    if (isDemoMode) {
      const itens = demoTemplateItens(id.data)
      if (!itens) return error("Esta OS não tem checklist.")
      const { errors } = normalizeChecklistAnswers(itens, respostas)
      if (errors.length > 0) return error(errors[0])
      return success("Checklist salvo")
    }

    const supabase = await createSupabase()
    const ctx = await loadExecutionContext(supabase, id.data)
    if (!ctx) return error(STALE)
    if (ctx.status !== "em_campo") return error("Faça o check-in antes de preencher o checklist.")
    if (!ctx.itens) return error("Esta OS não tem checklist.")
    const { respostas: limpas, errors } = normalizeChecklistAnswers(ctx.itens, respostas)
    if (errors.length > 0) return error(errors[0])

    const blocked = await guardedUpdate(
      supabase,
      "saveChecklist",
      id.data,
      { checklist_respostas: limpas },
      ["em_campo"],
      auth.data,
      "Não foi possível salvar o checklist. Tente novamente.",
    )
    if (blocked) return blocked
  } catch (err) {
    return dbError("saveChecklist", err, "Não foi possível salvar o checklist. Tente novamente.")
  }

  revalidateOs(id.data)
  return success("Checklist salvo")
}

const laudoSchema = z.object({
  laudo: z.string().trim().max(CHECKLIST_TEXT_MAX * 2, "Laudo muito longo (máx. 4000 caracteres)."),
  observacoes: z
    .string()
    .trim()
    .max(CHECKLIST_TEXT_MAX * 2, "Observações muito longas (máx. 4000 caracteres)."),
})

/** Laudo técnico + observações técnicas do executor. */
export async function saveLaudo(
  osId: string,
  input: { laudo: string; observacoes: string },
): Promise<OsActionResult> {
  const auth = await authorizeServiceOrder(osId)
  if (auth.error !== null) return error(auth.error)
  const id = uuid.safeParse(osId)
  if (!id.success) return error(INVALID)
  const parsed = laudoSchema.safeParse(input)
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? INVALID)
  if (isDemoMode) return success("Laudo salvo")

  try {
    const supabase = await createSupabase()
    const blocked = await guardedUpdate(
      supabase,
      "saveLaudo",
      id.data,
      {
        laudo: parsed.data.laudo || null,
        observacoes_tecnicas: parsed.data.observacoes || null,
      },
      ["em_campo"],
      auth.data,
      "Não foi possível salvar o laudo. Tente novamente.",
    )
    if (blocked) return blocked
  } catch (err) {
    return dbError("saveLaudo", err, "Não foi possível salvar o laudo. Tente novamente.")
  }

  revalidateOs(id.data)
  return success("Laudo salvo")
}

/** Confere no Storage que o objeto existe e respeita tipo/tamanho. */
async function checkStoredObject(
  supabase: SupabaseServer,
  bucket: string,
  path: string,
  allowed: readonly string[],
  maxBytes: number,
): Promise<string | null> {
  const [dir, file] = path.split("/")
  const { data, error: err } = await supabase.storage
    .from(bucket)
    .list(dir, { search: file, limit: 5 })
  if (err) {
    console.error("[actions/service-orders] storage list:", err)
    return "Não foi possível conferir o arquivo enviado. Tente novamente."
  }
  const obj = (data ?? []).find((o) => o.name === file)
  if (!obj) return "Arquivo não encontrado no armazenamento — envie novamente."
  const meta = (obj.metadata ?? {}) as { size?: number; mimetype?: string }
  if (typeof meta.size === "number" && meta.size > maxBytes) return "Arquivo acima do limite permitido."
  if (meta.mimetype && !allowed.includes(meta.mimetype)) return "Formato de arquivo não permitido."
  return null
}

const photoSchema = z.object({
  osId: z.uuid(),
  path: z.string().min(1).max(250),
  etapa: z.enum(["antes", "depois"]),
  legenda: z.string().trim().max(LEGENDA_MAX).optional().default(""),
  mime: z.string(),
  size: z.number().int(),
})

/**
 * Registra em service_order_photos uma foto já enviada pelo navegador ao
 * bucket os-fotos (upload direto com o client do usuário). Revalida tipo,
 * tamanho e caminho aqui e confere o objeto no Storage.
 */
export async function registerServiceOrderPhoto(input: {
  osId: string
  path: string
  etapa: "antes" | "depois"
  legenda?: string
  mime: string
  size: number
}): Promise<OsActionResult & { photo?: ServiceOrderPhotoView }> {
  const auth = await authorizeServiceOrder(input.osId)
  if (auth.error !== null) return error(auth.error)
  const parsed = photoSchema.safeParse(input)
  if (!parsed.success) return error(INVALID)
  const { osId, path, etapa, legenda, mime, size } = parsed.data
  const fileError = validatePhotoUpload({ type: mime, size })
  if (fileError) return error(fileError)
  if (!isValidOsStoragePath(osId, path, ["jpg", "jpeg", "png", "webp"])) {
    return error("Caminho de arquivo inválido para esta OS.")
  }
  if (isDemoMode) return success(`Foto "${etapa}" adicionada`)

  try {
    const supabase = await createSupabase()
    const ctx = await loadExecutionContext(supabase, osId)
    if (!ctx) return error(STALE)
    if (ctx.status !== "em_campo") return error("Fotos só podem ser enviadas com a OS em campo.")

    const objError = await checkStoredObject(
      supabase,
      STORAGE_BUCKETS.fotos,
      path,
      PHOTO_ALLOWED_TYPES,
      PHOTO_MAX_BYTES,
    )
    if (objError) return error(objError)

    const { data, error: err } = await supabase
      .from("service_order_photos")
      .insert({
        service_order_id: osId,
        storage_path: path,
        etapa,
        legenda: legenda || null,
        created_by: auth.data.id,
      })
      .select("id, created_at")
    if (err) return dbError("registerPhoto", err, "Não foi possível registrar a foto. Tente novamente.")
    const row = data?.[0] as { id: string; created_at: string } | undefined
    if (!row) return error(STALE)

    const { data: signed } = await supabase.storage
      .from(STORAGE_BUCKETS.fotos)
      .createSignedUrl(path, 60 * 60)

    revalidateOs(osId)
    return {
      status: "success",
      message: `Foto "${etapa}" enviada.`,
      photo: {
        id: row.id,
        storage_path: path,
        etapa,
        legenda: legenda || null,
        created_at: row.created_at,
        url: signed?.signedUrl ?? null,
      },
    }
  } catch (err) {
    return dbError("registerPhoto", err, "Não foi possível registrar a foto. Tente novamente.")
  }
}

const signatureSchema = z.object({
  osId: z.uuid(),
  path: z.string().min(1).max(250),
  nome: z
    .string()
    .trim()
    .min(3, "Informe o nome de quem assinou.")
    .max(120, "Nome muito longo."),
  mime: z.string(),
  size: z.number().int(),
})

/** Grava assinatura (já enviada ao bucket os-assinaturas) + nome + momento. */
export async function saveSignature(input: {
  osId: string
  path: string
  nome: string
  mime: string
  size: number
}): Promise<OsActionResult & { url?: string | null }> {
  const auth = await authorizeServiceOrder(input.osId)
  if (auth.error !== null) return error(auth.error)
  const parsed = signatureSchema.safeParse(input)
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? INVALID)
  const { osId, path, nome, mime, size } = parsed.data
  const fileError = validateSignatureUpload({ type: mime, size })
  if (fileError) return error(fileError)
  if (!isValidOsStoragePath(osId, path, ["png"])) {
    return error("Caminho de arquivo inválido para esta OS.")
  }
  if (isDemoMode) return success("Assinatura registrada")

  try {
    const supabase = await createSupabase()
    const objError = await checkStoredObject(
      supabase,
      STORAGE_BUCKETS.assinaturas,
      path,
      [SIGNATURE_TYPE],
      SIGNATURE_MAX_BYTES,
    )
    if (objError) return error(objError)

    const blocked = await guardedUpdate(
      supabase,
      "saveSignature",
      osId,
      { assinatura_path: path, assinado_por_nome: nome, assinado_em: new Date().toISOString() },
      ["em_campo"],
      auth.data,
      "Não foi possível salvar a assinatura. Tente novamente.",
    )
    if (blocked) return blocked

    const { data: signed } = await supabase.storage
      .from(STORAGE_BUCKETS.assinaturas)
      .createSignedUrl(path, 60 * 60)
    revalidateOs(osId)
    return { status: "success", message: "Assinatura registrada.", url: signed?.signedUrl ?? null }
  } catch (err) {
    return dbError("saveSignature", err, "Não foi possível salvar a assinatura. Tente novamente.")
  }
}

/**
 * Conclui a OS: em_campo -> concluido. Revalida no servidor checklist
 * obrigatório + foto "depois" + assinatura. concluded_at, PMOC e status do
 * equipamento ficam com o banco (trigger).
 */
export async function concludeServiceOrder(osId: string): Promise<OsActionResult> {
  const auth = await authorizeServiceOrder(osId)
  if (auth.error !== null) return error(auth.error)
  const id = uuid.safeParse(osId)
  if (!id.success) return error(INVALID)
  // Demo: a tela já aplicou evaluateConclusion sobre o estado em memória.
  if (isDemoMode) return success("Chamado concluído")

  try {
    const supabase = await createSupabase()
    const ctx = await loadExecutionContext(supabase, id.data)
    if (!ctx) return error(STALE)

    const { count, error: cErr } = await supabase
      .from("service_order_photos")
      .select("id", { count: "exact", head: true })
      .eq("service_order_id", id.data)
      .eq("etapa", "depois")
    if (cErr) return dbError("conclude count", cErr, "Não foi possível conferir as fotos. Tente novamente.")

    const readiness = evaluateConclusion({
      status: ctx.status,
      itens: ctx.itens,
      respostas: ctx.respostas,
      fotosDepois: (count ?? 0) + ctx.fotos_depois.length,
      assinaturaPath: ctx.assinatura_path,
      assinadoPorNome: ctx.assinado_por_nome,
    })
    if (!readiness.ready) return error(readiness.pendencias[0])

    const blocked = await guardedUpdate(
      supabase,
      "conclude",
      id.data,
      { status: "concluido" },
      sourceStatusesFor("concluido", auth.data.role),
      auth.data,
      "Não foi possível concluir o chamado. Tente novamente.",
    )
    if (blocked) return blocked
  } catch (err) {
    return dbError("concludeServiceOrder", err, "Não foi possível concluir o chamado. Tente novamente.")
  }

  revalidateOs(id.data)
  return success("Chamado concluído")
}
