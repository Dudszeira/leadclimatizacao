"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isDemoMode } from "@/lib/env"
import { quotesFixture, serviceOrdersFixture } from "@/lib/fixtures"
import {
  QUOTES_PATH,
  approveQuoteSchema,
  catalogItemSchema,
  declineQuoteSchema,
  quoteFieldErrors,
  quoteSchema,
  type ApproveQuoteInput,
  type CatalogItemInput,
  type DeclineQuoteInput,
  type QuoteActionResult,
  type QuoteData,
  type QuoteInput,
} from "@/lib/quotes/schemas"
import { createClient as createSupabase } from "@/lib/supabase/server"
import { authorizeAction } from "@/server/auth"
import { generateCharge } from "@/server/actions/invoices"
import { safeErrorLog } from "@/server/_shared"

/**
 * Server actions de Orçamentos (0010). Matriz de acesso:
 * - admin, atendente e técnico: criar, editar (só "aguardando") e duplicar;
 * - só admin: aprovar (gera OS + fatura + cobrança Asaas), declinar, excluir
 *   e escrever no catálogo.
 * O banco reforça tudo (RLS + triggers + checagem nas RPCs). Zod no servidor,
 * mensagens pt-BR, erro cru só no log.
 */

const DEMO_MESSAGE = "Modo demonstração: dados validados, mas nada foi gravado. Conecte o banco para salvar."
const INVALID = "Revise os campos destacados antes de salvar."
const ALL_ROLES = ["admin", "atendente", "tecnico"] as const

const idSchema = z.uuid()

function fail(message: string, extra: Partial<QuoteActionResult> = {}): QuoteActionResult {
  return { ok: false, message, ...extra }
}

/**
 * Mensagens levantadas pelas nossas funções (RAISE em 0010) são pt-BR e
 * seguras; violações genéricas (constraint/RLS) viram o fallback.
 */
function dbMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") return fallback
  const { code, message } = error as { code?: unknown; message?: unknown }
  if (typeof code !== "string" || typeof message !== "string") return fallback
  if (!["P0001", "P0002", "22023", "22004", "23514", "42501"].includes(code)) return fallback
  if (/violates|row-level|constraint|permission denied|syntax|invalid input/i.test(message)) return fallback
  return message.slice(0, 300)
}

/** Recusa de aprovar_orcamento que a UI trata (hint definido em 0010). */
function approveErrorCode(error: unknown): QuoteActionResult["code"] {
  if (!error || typeof error !== "object") return undefined
  const { hint, message } = error as { hint?: unknown; message?: unknown }
  if (hint === "quote_alterado") return "alterado"
  if (hint === "quote_vencido") return "vencido"
  if (typeof message === "string") {
    if (/foi alterado por outra pessoa/.test(message)) return "alterado"
    if (/Orçamento vencido em/.test(message)) return "vencido"
  }
  return undefined
}

/**
 * Modo demonstração: nada é gravado; devolve ids de fixtures existentes para a
 * UI poder navegar (criar/duplicar → um orçamento "aguardando"; aprovar → uma OS).
 */
const DEMO_NEW_QUOTE_ID = (quotesFixture.find((q) => q.status === "aguardando") ?? quotesFixture[0])?.id
const DEMO_SERVICE_ORDER_ID = serviceOrdersFixture[0]?.id

function revalidateQuote(id?: string) {
  revalidatePath(QUOTES_PATH)
  if (id) revalidatePath(`${QUOTES_PATH}/${id}`)
}

function toRpcPayload(data: QuoteData) {
  const { items, ...header } = data
  return { header, items }
}

// ---------------------------------------------------------------------------
// Criar / editar / excluir / duplicar
// ---------------------------------------------------------------------------

async function saveQuote(quoteId: string | null, input: QuoteInput): Promise<QuoteActionResult> {
  const auth = await authorizeAction(...ALL_ROLES)
  if (auth.error !== null) return fail(auth.error)
  if (quoteId !== null && !idSchema.safeParse(quoteId).success) return fail("Orçamento inválido.")
  const parsed = quoteSchema.safeParse(input)
  if (!parsed.success) return fail(INVALID, { fieldErrors: quoteFieldErrors(parsed.error) })
  if (isDemoMode) return { ok: true, demo: true, message: DEMO_MESSAGE, id: quoteId ?? DEMO_NEW_QUOTE_ID }

  const fallback = quoteId ? "Não foi possível atualizar o orçamento. Tente novamente." : "Não foi possível criar o orçamento. Tente novamente."
  try {
    const supabase = await createSupabase()
    const { header, items } = toRpcPayload(parsed.data)
    const { data, error } = await supabase.rpc("salvar_orcamento", {
      p_quote: quoteId,
      p_header: header,
      p_items: items,
    })
    if (error) {
      console.error("[actions/quotes] salvar_orcamento:", safeErrorLog(error))
      return fail(dbMessage(error, fallback))
    }
    const id = String(data)
    revalidateQuote(id)
    return { ok: true, message: quoteId ? "Orçamento atualizado." : "Orçamento criado.", id }
  } catch (error) {
    console.error("[actions/quotes] saveQuote:", safeErrorLog(error))
    return fail(fallback)
  }
}

/** Cria um orçamento (status "aguardando") com os itens. */
export async function createQuote(input: QuoteInput): Promise<QuoteActionResult> {
  return saveQuote(null, input)
}

/** Atualiza cabeçalho e SUBSTITUI os itens numa transação (só "aguardando"). */
export async function updateQuote(id: string, input: QuoteInput): Promise<QuoteActionResult> {
  return saveQuote(id, input)
}

/** Exclui (só admin, só "aguardando"). */
export async function deleteQuote(id: string): Promise<QuoteActionResult> {
  const auth = await authorizeAction("admin")
  if (auth.error !== null) return fail(auth.error)
  if (!idSchema.safeParse(id).success) return fail("Orçamento inválido.")
  if (isDemoMode) return { ok: true, demo: true, message: DEMO_MESSAGE, id }

  const fallback = "Não foi possível excluir o orçamento. Tente novamente."
  try {
    const supabase = await createSupabase()
    const { error } = await supabase.rpc("excluir_orcamento", { p_quote: id })
    if (error) {
      console.error("[actions/quotes] deleteQuote:", safeErrorLog(error))
      return fail(dbMessage(error, fallback))
    }
    revalidatePath(QUOTES_PATH)
    return { ok: true, message: "Orçamento excluído.", id }
  } catch (error) {
    console.error("[actions/quotes] deleteQuote:", safeErrorLog(error))
    return fail(fallback)
  }
}

/** Novo orçamento "aguardando" com o mesmo cabeçalho e itens (para refazer um decidido). */
export async function duplicateQuote(id: string): Promise<QuoteActionResult> {
  const auth = await authorizeAction(...ALL_ROLES)
  if (auth.error !== null) return fail(auth.error)
  if (!idSchema.safeParse(id).success) return fail("Orçamento inválido.")
  if (isDemoMode) return { ok: true, demo: true, message: DEMO_MESSAGE, id: DEMO_NEW_QUOTE_ID }

  const fallback = "Não foi possível duplicar o orçamento. Tente novamente."
  try {
    const supabase = await createSupabase()
    const { data, error } = await supabase.rpc("duplicar_orcamento", { p_quote: id })
    if (error) {
      console.error("[actions/quotes] duplicateQuote:", safeErrorLog(error))
      return fail(dbMessage(error, fallback))
    }
    const novo = String(data)
    revalidateQuote(novo)
    return { ok: true, message: "Orçamento duplicado — revise e envie ao cliente.", id: novo }
  } catch (error) {
    console.error("[actions/quotes] duplicateQuote:", safeErrorLog(error))
    return fail(fallback)
  }
}

// ---------------------------------------------------------------------------
// Decisão (só admin)
// ---------------------------------------------------------------------------

/**
 * Aprova: a RPC cria OS (aberta) + contrato avulso encerrado + fatura
 * pendente numa transação; depois tenta a cobrança no Asaas. Se a cobrança
 * falhar (ou o Asaas não estiver configurado), o orçamento CONTINUA aprovado
 * e a cobrança pode ser gerada pelo Financeiro.
 */
export async function approveQuote(id: string, input: ApproveQuoteInput): Promise<QuoteActionResult> {
  const auth = await authorizeAction("admin")
  if (auth.error !== null) return fail(auth.error)
  if (!idSchema.safeParse(id).success) return fail("Orçamento inválido.")
  const parsed = approveQuoteSchema.safeParse(input)
  if (!parsed.success) return fail(INVALID, { fieldErrors: quoteFieldErrors(parsed.error) })
  if (isDemoMode) {
    return {
      ok: true,
      demo: true,
      id,
      serviceOrderId: DEMO_SERVICE_ORDER_ID,
      message:
        "Modo demonstração: no banco real a aprovação gera a OS, a fatura e a cobrança no Asaas. Nada foi gravado.",
    }
  }

  const fallback = "Não foi possível aprovar o orçamento. Tente novamente."
  let serviceOrderId: string
  let invoiceId: string
  try {
    const supabase = await createSupabase()
    const { data, error } = await supabase.rpc("aprovar_orcamento", {
      p_quote: id,
      p_vencimento: parsed.data.vencimento,
      p_updated_at: parsed.data.updatedAt,
      p_aceitar_vencido: parsed.data.aceitarVencido,
    })
    if (error) {
      console.error("[actions/quotes] aprovar_orcamento:", safeErrorLog(error))
      const code = approveErrorCode(error)
      return fail(dbMessage(error, fallback), code ? { code } : {})
    }
    const r = (data ?? {}) as { service_order_id?: string; invoice_id?: string }
    if (!r.service_order_id || !r.invoice_id) {
      console.error("[actions/quotes] aprovar_orcamento: retorno sem ids")
      return fail(fallback)
    }
    serviceOrderId = r.service_order_id
    invoiceId = r.invoice_id
  } catch (error) {
    console.error("[actions/quotes] approveQuote:", safeErrorLog(error))
    return fail(fallback)
  }

  revalidateQuote(id)
  revalidatePath("/chamados")
  revalidatePath("/financeiro")

  const base = { ok: true as const, id, serviceOrderId, invoiceId }
  try {
    const charge = await generateCharge(invoiceId, parsed.data.metodo)
    if (charge.status === "success") {
      return {
        ...base,
        cobranca: "gerada",
        message: `Orçamento aprovado: OS aberta, fatura criada e ${charge.message.charAt(0).toLowerCase()}${charge.message.slice(1)}`,
      }
    }
    return {
      ...base,
      cobranca: "pendente",
      message: `Orçamento aprovado: OS aberta e fatura criada. A cobrança não foi gerada agora (${charge.message.replace(/\.$/, "")}) — gere pelo Financeiro.`,
    }
  } catch (error) {
    console.error("[actions/quotes] approveQuote cobrança:", safeErrorLog(error))
    return {
      ...base,
      cobranca: "pendente",
      message: "Orçamento aprovado: OS aberta e fatura criada. A cobrança não foi gerada agora — gere pelo Financeiro.",
    }
  }
}

/** Declina (só admin, só "aguardando"). Motivo opcional. */
export async function declineQuote(id: string, input: DeclineQuoteInput = {}): Promise<QuoteActionResult> {
  const auth = await authorizeAction("admin")
  if (auth.error !== null) return fail(auth.error)
  if (!idSchema.safeParse(id).success) return fail("Orçamento inválido.")
  const parsed = declineQuoteSchema.safeParse(input)
  if (!parsed.success) return fail(INVALID, { fieldErrors: quoteFieldErrors(parsed.error) })
  if (isDemoMode) return { ok: true, demo: true, message: DEMO_MESSAGE, id }

  const fallback = "Não foi possível declinar o orçamento. Tente novamente."
  try {
    const supabase = await createSupabase()
    const { error } = await supabase.rpc("declinar_orcamento", {
      p_quote: id,
      p_motivo: parsed.data.motivo,
    })
    if (error) {
      console.error("[actions/quotes] declineQuote:", safeErrorLog(error))
      return fail(dbMessage(error, fallback))
    }
    revalidateQuote(id)
    return { ok: true, message: "Orçamento marcado como declinado.", id }
  } catch (error) {
    console.error("[actions/quotes] declineQuote:", safeErrorLog(error))
    return fail(fallback)
  }
}

// ---------------------------------------------------------------------------
// Catálogo (escrita só admin)
// ---------------------------------------------------------------------------

/** Cria (sem id) ou atualiza um item do catálogo. */
export async function upsertCatalogItem(input: CatalogItemInput): Promise<QuoteActionResult> {
  const auth = await authorizeAction("admin")
  if (auth.error !== null) return fail(auth.error)
  const parsed = catalogItemSchema.safeParse(input)
  if (!parsed.success) return fail(INVALID, { fieldErrors: quoteFieldErrors(parsed.error) })
  if (isDemoMode) return { ok: true, demo: true, message: DEMO_MESSAGE, id: parsed.data.id ?? undefined }

  const { id, ...row } = parsed.data
  const fallback = "Não foi possível salvar o item do catálogo. Tente novamente."
  try {
    const supabase = await createSupabase()
    const query = id
      ? supabase.from("service_catalog").update(row).eq("id", id).select("id")
      : supabase.from("service_catalog").insert(row).select("id")
    const { data, error } = await query
    if (error) {
      console.error("[actions/quotes] upsertCatalogItem:", safeErrorLog(error))
      return fail(fallback)
    }
    if (!data || data.length === 0) return fail("Item não encontrado ou sem permissão — atualize a página.")
    revalidatePath(QUOTES_PATH)
    revalidatePath(`${QUOTES_PATH}/catalogo`)
    return { ok: true, message: id ? "Item do catálogo atualizado." : "Item adicionado ao catálogo.", id: String(data[0].id) }
  } catch (error) {
    console.error("[actions/quotes] upsertCatalogItem:", safeErrorLog(error))
    return fail(fallback)
  }
}

const toggleSchema = z.object({ id: z.uuid(), ativo: z.boolean() })

/** Ativa/inativa um item do catálogo (nunca apaga: orçamentos guardam o vínculo). */
export async function toggleCatalogItem(id: string, ativo: boolean): Promise<QuoteActionResult> {
  const auth = await authorizeAction("admin")
  if (auth.error !== null) return fail(auth.error)
  const parsed = toggleSchema.safeParse({ id, ativo })
  if (!parsed.success) return fail("Item inválido.")
  if (isDemoMode) return { ok: true, demo: true, message: DEMO_MESSAGE, id }

  const fallback = "Não foi possível alterar o item do catálogo. Tente novamente."
  try {
    const supabase = await createSupabase()
    const { data, error } = await supabase
      .from("service_catalog")
      .update({ ativo: parsed.data.ativo })
      .eq("id", parsed.data.id)
      .select("id")
    if (error) {
      console.error("[actions/quotes] toggleCatalogItem:", safeErrorLog(error))
      return fail(fallback)
    }
    if (!data || data.length === 0) return fail("Item não encontrado ou sem permissão — atualize a página.")
    revalidatePath(QUOTES_PATH)
    revalidatePath(`${QUOTES_PATH}/catalogo`)
    return { ok: true, message: parsed.data.ativo ? "Item reativado." : "Item inativado.", id }
  } catch (error) {
    console.error("[actions/quotes] toggleCatalogItem:", safeErrorLog(error))
    return fail(fallback)
  }
}
