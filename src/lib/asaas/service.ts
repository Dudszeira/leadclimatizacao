import type {
  Client,
  InvoiceWithContract,
  PaymentMethod,
  Result,
} from "@/lib/types";
import { quoteNumeroLabel } from "@/lib/status-meta";
import { AsaasError, asaasFetch, isAsaasConfigured } from "./client";
import { dueDateForCharge, todayBRT } from "./dates";
import type { NfseFiscal } from "./fiscal";
import type {
  AsaasBillingType,
  AsaasCustomer,
  AsaasCustomerPayload,
  AsaasInvoice,
  AsaasInvoicePayload,
  AsaasListResponse,
  AsaasPayment,
  AsaasPaymentPayload,
} from "./types";

/**
 * Funções de alto nível sobre o cliente HTTP do Asaas — mesmo contrato do
 * data layer: tudo resolve para Result<T>, nunca lança, mensagens pt-BR.
 * Sem ASAAS_API_KEY todas falham com "Asaas ainda não configurado".
 */

const NOT_CONFIGURED =
  "Asaas ainda não configurado — defina ASAAS_API_KEY quando a conta da Lead Climatização for criada.";

function ok<T>(data: T): Result<T> {
  return { data, error: null };
}

function fail<T>(context: string, error: unknown, fallback: string): Result<T> {
  console.error(`[asaas/service] ${context}:`, error);
  const message = error instanceof AsaasError ? error.message : fallback;
  return { data: null, error: message };
}

const BILLING_TYPE: Record<PaymentMethod, AsaasBillingType> = {
  pix: "PIX",
  boleto: "BOLETO",
};

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** "YYYY-MM-01" → "set/2026" para descrições de cobrança. */
function competenciaLabel(competencia: string): string {
  const [y, m] = competencia.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
  });
}

/** Limite do campo description de /payments no Asaas. */
export const ASAAS_DESCRIPTION_MAX = 500;

/**
 * Descrição da cobrança: contrato gerado por orçamento aprovado leva
 * "Orçamento ORC-1004: <título>"; os demais, a manutenção da competência.
 * Truncada ao limite do Asaas.
 */
export function chargeDescription(
  invoice: Pick<InvoiceWithContract, "competencia"> & {
    contract: Pick<InvoiceWithContract["contract"], "quote_id" | "quote">;
  },
): string {
  const quote = invoice.contract.quote;
  const text =
    invoice.contract.quote_id && quote
      ? `Orçamento ${quoteNumeroLabel(Number(quote.numero))}: ${quote.titulo.trim()}`
      : `Manutenção de climatização — competência ${competenciaLabel(invoice.competencia)}`;
  return text.length > ASAAS_DESCRIPTION_MAX
    ? `${text.slice(0, ASAAS_DESCRIPTION_MAX - 1).trimEnd()}…`
    : text;
}

// ----------------------------------------------------------------------------
// Customer
// ----------------------------------------------------------------------------

/**
 * Garante o customer do cliente no Asaas: busca por externalReference
 * (clients.id) ou CNPJ; se não existir, cria.
 */
export async function ensureCustomer(
  client: Pick<Client, "id" | "razao_social" | "cnpj" | "contato_email" | "contato_telefone">,
): Promise<Result<AsaasCustomer>> {
  if (!isAsaasConfigured()) return { data: null, error: NOT_CONFIGURED };

  try {
    const byRef = await asaasFetch<AsaasListResponse<AsaasCustomer>>("/customers", {
      query: { externalReference: client.id, limit: 1 },
    });
    const existing = byRef.data.find((c) => !c.deleted);
    if (existing) return ok(existing);

    if (client.cnpj) {
      const byCnpj = await asaasFetch<AsaasListResponse<AsaasCustomer>>("/customers", {
        query: { cpfCnpj: onlyDigits(client.cnpj), limit: 1 },
      });
      const match = byCnpj.data.find((c) => !c.deleted);
      if (match) return ok(match);
    }

    const payload: AsaasCustomerPayload = {
      name: client.razao_social,
      cpfCnpj: client.cnpj ? onlyDigits(client.cnpj) : undefined,
      email: client.contato_email ?? undefined,
      phone: client.contato_telefone ? onlyDigits(client.contato_telefone) : undefined,
      externalReference: client.id,
    };
    const created = await asaasFetch<AsaasCustomer>("/customers", {
      method: "POST",
      body: payload,
    });
    return ok(created);
  } catch (error) {
    return fail(
      "ensureCustomer",
      error,
      "Não foi possível sincronizar o cliente com o Asaas. Tente novamente.",
    );
  }
}

// ----------------------------------------------------------------------------
// Payment (cobrança Pix/boleto)
// ----------------------------------------------------------------------------

/** Cria a cobrança (Pix ou boleto) de uma fatura para um customer do Asaas. */
export async function createPayment(
  invoice: InvoiceWithContract,
  customerId: string,
  metodo: PaymentMethod,
): Promise<Result<AsaasPayment>> {
  if (!isAsaasConfigured()) return { data: null, error: NOT_CONFIGURED };

  try {
    const payload: AsaasPaymentPayload = {
      customer: customerId,
      billingType: BILLING_TYPE[metodo],
      value: invoice.valor,
      dueDate: dueDateForCharge(invoice.vencimento),
      description: chargeDescription(invoice),
      externalReference: invoice.id,
    };
    const payment = await asaasFetch<AsaasPayment>("/payments", {
      method: "POST",
      body: payload,
    });
    return ok(payment);
  } catch (error) {
    return fail(
      "createPayment",
      error,
      "Não foi possível gerar a cobrança no Asaas. Tente novamente.",
    );
  }
}

/** Consulta o status atual de uma cobrança (payments.id do Asaas). */
export async function getPaymentStatus(
  asaasPaymentId: string,
): Promise<Result<AsaasPayment>> {
  if (!isAsaasConfigured()) return { data: null, error: NOT_CONFIGURED };

  try {
    const payment = await asaasFetch<AsaasPayment>(
      `/payments/${encodeURIComponent(asaasPaymentId)}`,
    );
    return ok(payment);
  } catch (error) {
    return fail(
      "getPaymentStatus",
      error,
      "Não foi possível consultar a cobrança no Asaas. Tente novamente.",
    );
  }
}

// ----------------------------------------------------------------------------
// Invoice (NFS-e)
// ----------------------------------------------------------------------------

/**
 * Agenda a emissão da NFS-e de uma fatura. Quando a cobrança já existe no
 * Asaas (invoice.asaas_id), a nota é vinculada a ela; senão exige customerId.
 * O número da nota chega depois, via consulta ou webhook INVOICE_AUTHORIZED.
 * Alíquota/retenção de ISS e código de serviço vêm do cadastro do cliente
 * (fiscalFromClient — fallback 5%).
 */
export async function scheduleInvoice(
  invoice: InvoiceWithContract,
  fiscal: NfseFiscal,
  customerId?: string,
): Promise<Result<AsaasInvoice>> {
  if (!isAsaasConfigured()) return { data: null, error: NOT_CONFIGURED };

  if (!fiscal.municipalServiceCode) {
    return {
      data: null,
      error:
        "Cadastre o código de serviço municipal (NFS-e) no cliente antes de emitir a nota.",
    };
  }

  if (!invoice.asaas_id && !customerId) {
    return {
      data: null,
      error:
        "Gere a cobrança da fatura antes de emitir a NFS-e (a nota é vinculada à cobrança no Asaas).",
    };
  }

  try {
    const descricao = `Serviços de manutenção de climatização (PMOC) — competência ${competenciaLabel(invoice.competencia)}`;
    const payload: AsaasInvoicePayload = {
      payment: invoice.asaas_id ?? undefined,
      customer: invoice.asaas_id ? undefined : customerId,
      serviceDescription: descricao,
      observations: `Fatura ${invoice.id} — competência ${competenciaLabel(invoice.competencia)}.`,
      municipalServiceCode: fiscal.municipalServiceCode,
      municipalServiceName: descricao,
      value: invoice.valor,
      effectiveDate: todayBRT(),
      externalReference: invoice.id,
      taxes: {
        retainIss: fiscal.retainIss,
        iss: fiscal.iss,
        cofins: 0,
        csll: 0,
        inss: 0,
        ir: 0,
        pis: 0,
      },
    };
    const nota = await asaasFetch<AsaasInvoice>("/invoices", {
      method: "POST",
      body: payload,
    });
    return ok(nota);
  } catch (error) {
    return fail(
      "scheduleInvoice",
      error,
      "Não foi possível agendar a NFS-e no Asaas. Tente novamente.",
    );
  }
}

// ----------------------------------------------------------------------------
// Reconciliação (antes de criar, procura o que já existe para a fatura)
// ----------------------------------------------------------------------------

/**
 * Cobrança ativa já criada no Asaas para a fatura (externalReference =
 * invoices.id). Evita duplicar quando uma tentativa anterior criou a cobrança
 * mas não conseguiu gravar o retorno (timeout, queda do processo).
 */
export async function findPaymentByReference(
  invoiceId: string,
): Promise<Result<AsaasPayment | null>> {
  if (!isAsaasConfigured()) return { data: null, error: NOT_CONFIGURED };
  try {
    const list = await asaasFetch<AsaasListResponse<AsaasPayment>>("/payments", {
      query: { externalReference: invoiceId, limit: 10 },
    });
    return ok(list.data.find((p) => !p.deleted && p.status !== "REFUNDED") ?? null);
  } catch (error) {
    return fail(
      "findPaymentByReference",
      error,
      "Não foi possível consultar as cobranças no Asaas. Tente novamente.",
    );
  }
}

/** NFS-e já agendada/autorizada no Asaas para a fatura (externalReference). */
export async function findInvoiceByReference(
  invoiceId: string,
): Promise<Result<AsaasInvoice | null>> {
  if (!isAsaasConfigured()) return { data: null, error: NOT_CONFIGURED };
  try {
    const list = await asaasFetch<AsaasListResponse<AsaasInvoice>>("/invoices", {
      query: { externalReference: invoiceId, limit: 10 },
    });
    return ok(
      list.data.find(
        (n) => n.status !== "CANCELED" && n.status !== "ERROR" && n.status !== "PROCESSING_CANCELLATION",
      ) ?? null,
    );
  } catch (error) {
    return fail(
      "findInvoiceByReference",
      error,
      "Não foi possível consultar as notas fiscais no Asaas. Tente novamente.",
    );
  }
}
