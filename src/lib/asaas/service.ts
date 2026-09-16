import type {
  Client,
  InvoiceWithContract,
  PaymentMethod,
  Result,
} from "@/lib/types";
import { AsaasError, asaasFetch, isAsaasConfigured } from "./client";
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
      dueDate: invoice.vencimento ?? new Date().toISOString().slice(0, 10),
      description: `Manutenção de climatização — competência ${competenciaLabel(invoice.competencia)}`,
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
 */
export async function scheduleInvoice(
  invoice: InvoiceWithContract,
  customerId?: string,
): Promise<Result<AsaasInvoice>> {
  if (!isAsaasConfigured()) return { data: null, error: NOT_CONFIGURED };

  if (!invoice.asaas_id && !customerId) {
    return {
      data: null,
      error:
        "Gere a cobrança da fatura antes de emitir a NFS-e (a nota é vinculada à cobrança no Asaas).",
    };
  }

  try {
    const payload: AsaasInvoicePayload = {
      payment: invoice.asaas_id ?? undefined,
      customer: invoice.asaas_id ? undefined : customerId,
      serviceDescription: `Serviços de manutenção de climatização (PMOC) — competência ${competenciaLabel(invoice.competencia)}`,
      value: invoice.valor,
      effectiveDate: new Date().toISOString().slice(0, 10),
      externalReference: invoice.id,
      taxes: {
        retainIss: false,
        iss: 5,
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
