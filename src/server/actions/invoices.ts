"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { contractsToBill } from "@/lib/asaas/billing"
import { competenciaBRT, isCompetencia } from "@/lib/asaas/dates"
import { fiscalFromClient } from "@/lib/asaas/fiscal"
import { isLock, isStaleLock, newLock } from "@/lib/asaas/lock"
import {
  createPayment,
  ensureCustomer,
  findInvoiceByReference,
  findPaymentByReference,
  scheduleInvoice,
} from "@/lib/asaas/service"
import { isDemoMode } from "@/lib/env"
import { contractsFixture, invoicesFixture } from "@/lib/fixtures"
import { formatCompetenciaLonga } from "@/lib/format"
import { httpsUrl } from "@/lib/safe-url"
import { createClient as createSupabase } from "@/lib/supabase/server"
import type { PaymentMethod } from "@/lib/types"
import { getInvoice } from "@/server/invoices"
import { authorizeAction } from "@/server/auth"
import { safeErrorLog } from "@/server/_shared"

/**
 * Server actions das faturas. Todas exigem admin (authorizeAction), validam
 * com zod e nunca devolvem erro cru (Supabase/Asaas só no log do servidor).
 *
 * Duplicidade: cobrança e NFS-e usam lock lógico (src/lib/asaas/lock.ts) —
 * UPDATE condicional com .select("id") ANTES da chamada externa; 0 linhas =
 * outra requisição já está emitindo (ou RLS bloqueou). Antes de criar, a
 * action ainda procura no Asaas algo já criado para a fatura
 * (externalReference) e reaproveita.
 */

export interface InvoiceActionResult {
  status: "success" | "error" | "info"
  message: string
  /** Faturas criadas (generateMonthlyInvoices) ou atualizadas (markOverdue). */
  count?: number
}

const DEMO_MESSAGE =
  "Modo demonstração — as ações de cobrança serão habilitadas quando a conta Asaas da Lead Climatização for criada."

function demoResult(): InvoiceActionResult {
  return { status: "info", message: DEMO_MESSAGE }
}

function invalid(): InvoiceActionResult {
  return {
    status: "error",
    message: "Dados inválidos — recarregue a página e tente novamente.",
  }
}

function error(message: string): InvoiceActionResult {
  return { status: "error", message }
}

const invoiceIdSchema = z.uuid()
const metodoSchema = z.enum(["pix", "boleto"])

type Supabase = Awaited<ReturnType<typeof createSupabase>>

/**
 * Adquire o lock lógico em `column` (asaas_id | asaas_invoice_id). Aceita a
 * coluna vazia ou um marcador abandonado. Devolve o marcador ou null.
 */
async function acquireLock(
  supabase: Supabase,
  invoiceId: string,
  column: "asaas_id" | "asaas_invoice_id",
  current: string | null | undefined,
  extra: (q: ReturnType<ReturnType<Supabase["from"]>["update"]>) => ReturnType<ReturnType<Supabase["from"]>["update"]>,
): Promise<{ lock: string | null; dbError: boolean }> {
  const lock = newLock()
  let query = supabase.from("invoices").update({ [column]: lock }).eq("id", invoiceId)
  query = isStaleLock(current) ? query.eq(column, current as string) : query.is(column, null)
  const { data, error: dbError } = await extra(query).select("id")
  if (dbError) {
    console.error(`[actions/invoices] lock ${column}:`, safeErrorLog(dbError))
    return { lock: null, dbError: true }
  }
  return { lock: data && data.length > 0 ? lock : null, dbError: false }
}

async function releaseLock(
  supabase: Supabase,
  invoiceId: string,
  column: "asaas_id" | "asaas_invoice_id",
  lock: string,
): Promise<void> {
  const { error: dbError } = await supabase
    .from("invoices")
    .update({ [column]: null })
    .eq("id", invoiceId)
    .eq(column, lock)
  if (dbError) console.error(`[actions/invoices] release ${column}:`, safeErrorLog(dbError))
}

// ---------------------------------------------------------------------------
// Gerar cobrança (Pix/boleto) no Asaas
// ---------------------------------------------------------------------------

/** Cria a cobrança no Asaas e grava asaas_id/asaas_url/método na fatura. */
export async function generateCharge(
  invoiceId: string,
  metodo: PaymentMethod,
): Promise<InvoiceActionResult> {
  const auth = await authorizeAction("admin")
  if (auth.error !== null) return error(auth.error)
  const id = invoiceIdSchema.safeParse(invoiceId)
  const met = metodoSchema.safeParse(metodo)
  if (!id.success || !met.success) return invalid()
  if (isDemoMode) return demoResult()

  try {
    const invoiceResult = await getInvoice(id.data)
    if (invoiceResult.error !== null) return error(invoiceResult.error)
    const invoice = invoiceResult.data
    if (!invoice) return error("Fatura não encontrada — atualize a página.")
    if (invoice.status === "pago" || invoice.status === "cancelado") {
      return error("Esta fatura já foi paga ou cancelada.")
    }
    if (invoice.asaas_id && !isStaleLock(invoice.asaas_id)) {
      return error(
        isLock(invoice.asaas_id)
          ? "A cobrança desta fatura já está sendo gerada — aguarde alguns segundos e atualize a página."
          : "Esta fatura já tem cobrança no Asaas — use \"Copiar link de pagamento\".",
      )
    }

    const supabase = await createSupabase()
    const { data: clientRow, error: clientError } = await supabase
      .from("clients")
      .select("id, razao_social, cnpj, contato_email, contato_telefone")
      .eq("id", invoice.contract.client.id)
      .maybeSingle()
    if (clientError || !clientRow) {
      console.error("[actions/invoices] generateCharge cliente:", safeErrorLog(clientError))
      return error("Não foi possível carregar o cliente da fatura. Tente novamente.")
    }

    const { lock, dbError } = await acquireLock(supabase, id.data, "asaas_id", invoice.asaas_id, (q) =>
      q.in("status", ["pendente", "atrasado"]),
    )
    if (dbError) return error("Não foi possível reservar a fatura para cobrança. Tente novamente.")
    if (!lock) {
      return error(
        "Outra cobrança desta fatura já foi gerada ou está em andamento — atualize a página.",
      )
    }

    // Reaproveita cobrança criada por tentativa anterior que não foi gravada.
    const existing = await findPaymentByReference(id.data)
    if (existing.error !== null) {
      await releaseLock(supabase, id.data, "asaas_id", lock)
      return error(existing.error)
    }
    let payment = existing.data
    if (!payment) {
      const customer = await ensureCustomer(clientRow)
      if (customer.error !== null) {
        await releaseLock(supabase, id.data, "asaas_id", lock)
        return error(customer.error)
      }
      const created = await createPayment(invoice, customer.data.id, met.data)
      if (created.error !== null) {
        await releaseLock(supabase, id.data, "asaas_id", lock)
        return error(created.error)
      }
      payment = created.data
    }

    const metodoGravado =
      payment.billingType === "PIX" ? "pix" : payment.billingType === "BOLETO" ? "boleto" : met.data
    const { data: saved, error: saveError } = await supabase
      .from("invoices")
      .update({
        asaas_id: payment.id,
        asaas_url: payment.invoiceUrl ?? payment.bankSlipUrl,
        metodo: metodoGravado,
      })
      .eq("id", id.data)
      .eq("asaas_id", lock)
      .select("id")
    if (saveError || !saved || saved.length === 0) {
      console.error("[actions/invoices] generateCharge gravar:", safeErrorLog(saveError ?? "0 linhas"))
      return error(
        "Cobrança criada no Asaas, mas não foi possível gravar na fatura agora — ela será vinculada automaticamente pelo webhook. Atualize a página em instantes.",
      )
    }

    revalidatePath("/financeiro")
    return {
      status: "success",
      message: existing.data
        ? "Cobrança já existente no Asaas vinculada à fatura."
        : `Cobrança ${metodoGravado === "pix" ? "Pix" : "por boleto"} gerada no Asaas.`,
    }
  } catch (err) {
    console.error("[actions/invoices] generateCharge:", safeErrorLog(err))
    return error("Não foi possível gerar a cobrança. Tente novamente.")
  }
}

// ---------------------------------------------------------------------------
// Marcar como pago (recebimento manual, fora do Asaas)
// ---------------------------------------------------------------------------

/** Marca a fatura como paga manualmente (paid_at = agora). */
export async function markInvoicePaid(invoiceId: string): Promise<InvoiceActionResult> {
  const auth = await authorizeAction("admin")
  if (auth.error !== null) return error(auth.error)
  const id = invoiceIdSchema.safeParse(invoiceId)
  if (!id.success) return invalid()
  if (isDemoMode) return demoResult()

  try {
    const supabase = await createSupabase()
    const { data, error: dbError } = await supabase
      .from("invoices")
      .update({ status: "pago", paid_at: new Date().toISOString() })
      .eq("id", id.data)
      .in("status", ["pendente", "atrasado"])
      .select("id")
    if (dbError) {
      console.error("[actions/invoices] markInvoicePaid:", safeErrorLog(dbError))
      return error("Não foi possível marcar a fatura como paga. Tente novamente.")
    }
    if (!data || data.length === 0) {
      return error("A fatura não está mais em aberto (ou você não tem permissão) — atualize a página.")
    }
  } catch (err) {
    console.error("[actions/invoices] markInvoicePaid:", safeErrorLog(err))
    return error("Não foi possível marcar a fatura como paga. Tente novamente.")
  }

  revalidatePath("/financeiro")
  return { status: "success", message: "Fatura marcada como paga (recebimento manual)." }
}

// ---------------------------------------------------------------------------
// Emitir NFS-e via Asaas
// ---------------------------------------------------------------------------

/** Agenda a emissão da NFS-e da fatura no Asaas (vinculada à cobrança). */
export async function issueNfse(invoiceId: string): Promise<InvoiceActionResult> {
  const auth = await authorizeAction("admin")
  if (auth.error !== null) return error(auth.error)
  const id = invoiceIdSchema.safeParse(invoiceId)
  if (!id.success) return invalid()
  if (isDemoMode) return demoResult()

  try {
    const invoiceResult = await getInvoice(id.data)
    if (invoiceResult.error !== null) return error(invoiceResult.error)
    const invoice = invoiceResult.data
    if (!invoice) return error("Fatura não encontrada — atualize a página.")
    if (invoice.nf_numero) {
      return error(`A NFS-e ${invoice.nf_numero} já foi emitida para esta fatura.`)
    }
    if (invoice.status === "cancelado") {
      return error("Não é possível emitir NFS-e de fatura cancelada.")
    }
    if (invoice.asaas_invoice_id && !isStaleLock(invoice.asaas_invoice_id)) {
      return error(
        "A NFS-e desta fatura já foi solicitada — o número aparece quando a prefeitura autorizar.",
      )
    }
    if (!invoice.asaas_id || isLock(invoice.asaas_id)) {
      return error(
        "Gere a cobrança da fatura antes de emitir a NFS-e (a nota é vinculada à cobrança no Asaas).",
      )
    }

    const supabase = await createSupabase()
    const { data: clientRow, error: clientError } = await supabase
      .from("clients")
      .select("codigo_servico_municipal, aliquota_iss, reter_iss")
      .eq("id", invoice.contract.client.id)
      .maybeSingle()
    if (clientError || !clientRow) {
      console.error("[actions/invoices] issueNfse cliente:", safeErrorLog(clientError))
      return error("Não foi possível carregar os dados fiscais do cliente. Tente novamente.")
    }
    const fiscal = fiscalFromClient(clientRow)
    if (!fiscal.municipalServiceCode) {
      return error(
        "Cadastre o código de serviço municipal (NFS-e) no cliente antes de emitir a nota.",
      )
    }

    const { lock, dbError } = await acquireLock(
      supabase,
      id.data,
      "asaas_invoice_id",
      invoice.asaas_invoice_id,
      (q) => q.is("nf_numero", null).neq("status", "cancelado"),
    )
    if (dbError) return error("Não foi possível reservar a fatura para emissão. Tente novamente.")
    if (!lock) {
      return error("A NFS-e desta fatura já foi solicitada ou está em andamento — atualize a página.")
    }

    const existing = await findInvoiceByReference(id.data)
    if (existing.error !== null) {
      await releaseLock(supabase, id.data, "asaas_invoice_id", lock)
      return error(existing.error)
    }
    let nota = existing.data
    if (!nota) {
      const created = await scheduleInvoice(invoice, fiscal)
      if (created.error !== null) {
        await releaseLock(supabase, id.data, "asaas_invoice_id", lock)
        return error(created.error)
      }
      nota = created.data
    }

    const nfUrl = httpsUrl(nota.pdfUrl)
    const { data: saved, error: saveError } = await supabase
      .from("invoices")
      .update({
        asaas_invoice_id: nota.id,
        ...(nota.number ? { nf_numero: String(nota.number) } : {}),
        ...(nfUrl ? { nf_url: nfUrl } : {}),
      })
      .eq("id", id.data)
      .eq("asaas_invoice_id", lock)
      .select("id")
    if (saveError || !saved || saved.length === 0) {
      console.error("[actions/invoices] issueNfse gravar:", safeErrorLog(saveError ?? "0 linhas"))
      return error(
        "NFS-e agendada no Asaas, mas não foi possível gravar na fatura agora — o webhook vincula a nota automaticamente.",
      )
    }

    revalidatePath("/financeiro")
    return {
      status: "success",
      message: "NFS-e agendada no Asaas — o número aparece assim que a prefeitura autorizar.",
    }
  } catch (err) {
    console.error("[actions/invoices] issueNfse:", safeErrorLog(err))
    return error("Não foi possível emitir a NFS-e. Tente novamente.")
  }
}

// ---------------------------------------------------------------------------
// Faturamento mensal e inadimplência (RPCs de 0006)
// ---------------------------------------------------------------------------

/** Chama generate_monthly_invoices(p_competencia) e informa quantas faturas nasceram. */
export async function generateMonthlyInvoices(competencia?: string): Promise<InvoiceActionResult> {
  const auth = await authorizeAction("admin")
  if (auth.error !== null) return error(auth.error)
  const comp = competencia ?? competenciaBRT(0)
  if (!isCompetencia(comp)) return invalid()
  const label = formatCompetenciaLonga(comp)

  if (isDemoMode) {
    const n = contractsToBill(contractsFixture, invoicesFixture, comp).length
    return {
      status: "info",
      count: n,
      message: `Modo demonstração — ${n === 0 ? "nenhuma fatura nova seria criada" : `${n} fatura${n > 1 ? "s seriam criadas" : " seria criada"}`} para ${label}. Nada foi gravado.`,
    }
  }

  try {
    const supabase = await createSupabase()
    const { data, error: rpcError } = await supabase.rpc("generate_monthly_invoices", {
      p_competencia: comp,
    })
    if (rpcError) {
      console.error("[actions/invoices] generateMonthlyInvoices:", safeErrorLog(rpcError))
      return error("Não foi possível gerar as faturas do mês. Tente novamente.")
    }
    const n = Number(data ?? 0)
    revalidatePath("/financeiro")
    return {
      status: "success",
      count: n,
      message:
        n === 0
          ? `Nenhuma fatura nova — todas as faturas de ${label} já existiam.`
          : `${n} fatura${n > 1 ? "s criadas" : " criada"} para ${label}.`,
    }
  } catch (err) {
    console.error("[actions/invoices] generateMonthlyInvoices:", safeErrorLog(err))
    return error("Não foi possível gerar as faturas do mês. Tente novamente.")
  }
}

/** Chama mark_overdue_invoices(): pendentes vencidas (BRT) viram "atrasado". */
export async function markOverdueInvoices(): Promise<InvoiceActionResult> {
  const auth = await authorizeAction("admin")
  if (auth.error !== null) return error(auth.error)
  if (isDemoMode) {
    return {
      status: "info",
      message: "Modo demonstração — no banco real as faturas pendentes vencidas viram \"Atrasada\" (o job diário já faz isso às 06:05).",
    }
  }

  try {
    const supabase = await createSupabase()
    const { data, error: rpcError } = await supabase.rpc("mark_overdue_invoices")
    if (rpcError) {
      console.error("[actions/invoices] markOverdueInvoices:", safeErrorLog(rpcError))
      return error("Não foi possível atualizar as faturas atrasadas. Tente novamente.")
    }
    const n = Number(data ?? 0)
    revalidatePath("/financeiro")
    return {
      status: "success",
      count: n,
      message:
        n === 0
          ? "Nenhuma fatura pendente vencida — tudo em dia."
          : `${n} fatura${n > 1 ? "s marcadas" : " marcada"} como atrasada${n > 1 ? "s" : ""}.`,
    }
  } catch (err) {
    console.error("[actions/invoices] markOverdueInvoices:", safeErrorLog(err))
    return error("Não foi possível atualizar as faturas atrasadas. Tente novamente.")
  }
}
