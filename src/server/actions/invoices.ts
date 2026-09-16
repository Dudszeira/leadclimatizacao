"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import {
  createPayment,
  ensureCustomer,
  scheduleInvoice,
} from "@/lib/asaas/service"
import { isDemoMode } from "@/lib/env"
import { createClient as createSupabase } from "@/lib/supabase/server"
import type { PaymentMethod } from "@/lib/types"
import { getInvoice } from "@/server/invoices"

/**
 * Server actions das faturas — mesmo padrão de actions/service-orders.ts:
 * validação zod, modo demo devolve mensagem amigável (vira toast na UI) e
 * com Supabase real fala com o Asaas (src/lib/asaas) + atualiza o banco.
 */

export interface InvoiceActionResult {
  status: "success" | "error"
  message: string
}

const DEMO_MESSAGE =
  "Modo demonstração — as ações de cobrança serão habilitadas quando a conta Asaas da Lead Climatização for criada."

function demoResult(): InvoiceActionResult {
  return { status: "error", message: DEMO_MESSAGE }
}

function invalid(): InvoiceActionResult {
  return {
    status: "error",
    message: "Dados inválidos — recarregue a página e tente novamente.",
  }
}

const invoiceIdSchema = z.uuid()
const metodoSchema = z.enum(["pix", "boleto"])

// ---------------------------------------------------------------------------
// Gerar cobrança (Pix/boleto) no Asaas
// ---------------------------------------------------------------------------

/** Cria a cobrança no Asaas e grava asaas_id/asaas_url/método na fatura. */
export async function generateCharge(
  invoiceId: string,
  metodo: PaymentMethod,
): Promise<InvoiceActionResult> {
  const id = invoiceIdSchema.safeParse(invoiceId)
  const met = metodoSchema.safeParse(metodo)
  if (!id.success || !met.success) return invalid()
  if (isDemoMode) return demoResult()

  try {
    const invoiceResult = await getInvoice(id.data)
    if (invoiceResult.error !== null) {
      return { status: "error", message: invoiceResult.error }
    }
    const invoice = invoiceResult.data
    if (!invoice) {
      return { status: "error", message: "Fatura não encontrada — atualize a página." }
    }
    if (invoice.status === "pago" || invoice.status === "cancelado") {
      return { status: "error", message: "Esta fatura já foi paga ou cancelada." }
    }
    if (invoice.asaas_id) {
      return {
        status: "error",
        message: "Esta fatura já tem cobrança no Asaas — use \"Copiar link de pagamento\".",
      }
    }

    const supabase = await createSupabase()
    const { data: clientRow, error: clientError } = await supabase
      .from("clients")
      .select("id, razao_social, cnpj, contato_email, contato_telefone")
      .eq("id", invoice.contract.client.id)
      .maybeSingle()
    if (clientError || !clientRow) {
      console.error("[actions/invoices] generateCharge cliente:", clientError)
      return { status: "error", message: "Não foi possível carregar o cliente da fatura. Tente novamente." }
    }

    const customer = await ensureCustomer(clientRow)
    if (customer.error !== null) {
      return { status: "error", message: customer.error }
    }

    const payment = await createPayment(invoice, customer.data.id, met.data)
    if (payment.error !== null) {
      return { status: "error", message: payment.error }
    }

    const { error } = await supabase
      .from("invoices")
      .update({
        asaas_id: payment.data.id,
        asaas_url: payment.data.invoiceUrl ?? payment.data.bankSlipUrl,
        metodo: met.data,
      })
      .eq("id", id.data)
    if (error) {
      console.error("[actions/invoices] generateCharge update:", error)
      return {
        status: "error",
        message: "Cobrança criada no Asaas, mas não foi possível gravar na fatura. Recarregue a página.",
      }
    }

    revalidatePath("/financeiro")
    return {
      status: "success",
      message: `Cobrança ${met.data === "pix" ? "Pix" : "por boleto"} gerada no Asaas.`,
    }
  } catch (error) {
    console.error("[actions/invoices] generateCharge:", error)
    return { status: "error", message: "Não foi possível gerar a cobrança. Tente novamente." }
  }
}

// ---------------------------------------------------------------------------
// Marcar como pago (recebimento manual, fora do Asaas)
// ---------------------------------------------------------------------------

/** Marca a fatura como paga manualmente (paid_at = agora). */
export async function markInvoicePaid(
  invoiceId: string,
): Promise<InvoiceActionResult> {
  const id = invoiceIdSchema.safeParse(invoiceId)
  if (!id.success) return invalid()
  if (isDemoMode) return demoResult()

  try {
    const supabase = await createSupabase()
    const { error } = await supabase
      .from("invoices")
      .update({ status: "pago", paid_at: new Date().toISOString() })
      .eq("id", id.data)
      .in("status", ["pendente", "atrasado"])
    if (error) {
      console.error("[actions/invoices] markInvoicePaid:", error)
      return { status: "error", message: "Não foi possível marcar a fatura como paga. Tente novamente." }
    }
  } catch (error) {
    console.error("[actions/invoices] markInvoicePaid:", error)
    return { status: "error", message: "Não foi possível marcar a fatura como paga. Tente novamente." }
  }

  revalidatePath("/financeiro")
  return { status: "success", message: "Fatura marcada como paga (recebimento manual)." }
}

// ---------------------------------------------------------------------------
// Emitir NFS-e via Asaas
// ---------------------------------------------------------------------------

/** Agenda a emissão da NFS-e da fatura no Asaas (vinculada à cobrança). */
export async function issueNfse(
  invoiceId: string,
): Promise<InvoiceActionResult> {
  const id = invoiceIdSchema.safeParse(invoiceId)
  if (!id.success) return invalid()
  if (isDemoMode) return demoResult()

  try {
    const invoiceResult = await getInvoice(id.data)
    if (invoiceResult.error !== null) {
      return { status: "error", message: invoiceResult.error }
    }
    const invoice = invoiceResult.data
    if (!invoice) {
      return { status: "error", message: "Fatura não encontrada — atualize a página." }
    }
    if (invoice.nf_numero) {
      return { status: "error", message: `A NFS-e ${invoice.nf_numero} já foi emitida para esta fatura.` }
    }
    if (invoice.status === "cancelado") {
      return { status: "error", message: "Não é possível emitir NFS-e de fatura cancelada." }
    }

    const nota = await scheduleInvoice(invoice)
    if (nota.error !== null) {
      return { status: "error", message: nota.error }
    }

    // O número definitivo chega quando a prefeitura autorizar (webhook ou
    // consulta); se o Asaas já devolveu, gravamos agora.
    if (nota.data.number) {
      const supabase = await createSupabase()
      const { error } = await supabase
        .from("invoices")
        .update({ nf_numero: nota.data.number })
        .eq("id", id.data)
      if (error) console.error("[actions/invoices] issueNfse update:", error)
    }

    revalidatePath("/financeiro")
    return {
      status: "success",
      message: "NFS-e agendada no Asaas — o número aparece assim que a prefeitura autorizar.",
    }
  } catch (error) {
    console.error("[actions/invoices] issueNfse:", error)
    return { status: "error", message: "Não foi possível emitir a NFS-e. Tente novamente." }
  }
}
