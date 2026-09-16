/**
 * Tipos dos recursos do Asaas usados pelo Control Lead.
 * Cobertura mínima e intencional: Customer, Payment (Pix/boleto) e
 * Invoice (NFS-e). Referência: https://docs.asaas.com/reference
 */

/** Formas de cobrança que o Control Lead emite. */
export type AsaasBillingType = "PIX" | "BOLETO" | "UNDEFINED";

/** Status de um pagamento no Asaas (subset relevante). */
export type AsaasPaymentStatus =
  | "PENDING"
  | "RECEIVED"
  | "CONFIRMED"
  | "OVERDUE"
  | "REFUNDED"
  | "RECEIVED_IN_CASH"
  | "AWAITING_RISK_ANALYSIS";

/** Status de uma NFS-e no Asaas. */
export type AsaasInvoiceStatus =
  | "SCHEDULED"
  | "SYNCHRONIZED"
  | "AUTHORIZED"
  | "PROCESSING_CANCELLATION"
  | "CANCELED"
  | "CANCELLATION_DENIED"
  | "ERROR";

/** Eventos de webhook tratados por /api/webhooks/asaas. */
export type AsaasWebhookEventName =
  | "PAYMENT_RECEIVED"
  | "PAYMENT_CONFIRMED"
  | "PAYMENT_OVERDUE"
  | (string & {});

// ----------------------------------------------------------------------------
// Customer
// ----------------------------------------------------------------------------

export interface AsaasCustomer {
  id: string;
  name: string;
  cpfCnpj: string | null;
  email: string | null;
  phone: string | null;
  mobilePhone: string | null;
  /** Usamos o id do cliente no Control Lead (clients.id). */
  externalReference: string | null;
  deleted: boolean;
}

export interface AsaasCustomerPayload {
  name: string;
  cpfCnpj?: string;
  email?: string;
  phone?: string;
  externalReference?: string;
  notificationDisabled?: boolean;
}

// ----------------------------------------------------------------------------
// Payment (cobrança Pix/boleto)
// ----------------------------------------------------------------------------

export interface AsaasPayment {
  id: string;
  customer: string;
  billingType: AsaasBillingType;
  status: AsaasPaymentStatus;
  value: number;
  netValue: number | null;
  /** "YYYY-MM-DD". */
  dueDate: string;
  description: string | null;
  /** Usamos o id da fatura no Control Lead (invoices.id). */
  externalReference: string | null;
  /** Página de pagamento hospedada pelo Asaas (Pix + boleto). */
  invoiceUrl: string | null;
  /** PDF do boleto, quando billingType = BOLETO. */
  bankSlipUrl: string | null;
  /** "YYYY-MM-DD" do recebimento, quando pago. */
  paymentDate: string | null;
  clientPaymentDate: string | null;
  deleted: boolean;
}

export interface AsaasPaymentPayload {
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  /** "YYYY-MM-DD". */
  dueDate: string;
  description?: string;
  externalReference?: string;
}

// ----------------------------------------------------------------------------
// Invoice (NFS-e)
// ----------------------------------------------------------------------------

export interface AsaasInvoiceTaxes {
  retainIss: boolean;
  iss: number;
  cofins: number;
  csll: number;
  inss: number;
  ir: number;
  pis: number;
}

export interface AsaasInvoice {
  id: string;
  status: AsaasInvoiceStatus;
  customer: string;
  /** Cobrança vinculada (payments.id do Asaas), quando houver. */
  payment: string | null;
  serviceDescription: string;
  value: number;
  /** "YYYY-MM-DD" da emissão agendada. */
  effectiveDate: string;
  /** Número da nota, preenchido pelo Asaas após a autorização. */
  number: string | null;
  pdfUrl: string | null;
  xmlUrl: string | null;
  externalReference: string | null;
}

export interface AsaasInvoicePayload {
  /** Vincula a NFS-e à cobrança (recomendado). */
  payment?: string;
  /** Obrigatório quando não há payment. */
  customer?: string;
  serviceDescription: string;
  observations?: string;
  value: number;
  deductions?: number;
  /** "YYYY-MM-DD" — data de emissão. */
  effectiveDate: string;
  externalReference?: string;
  taxes?: AsaasInvoiceTaxes;
}

// ----------------------------------------------------------------------------
// Envelopes da API
// ----------------------------------------------------------------------------

/** Envelope padrão das listagens (GET /customers, /payments, ...). */
export interface AsaasListResponse<T> {
  object: "list";
  hasMore: boolean;
  totalCount: number;
  limit: number;
  offset: number;
  data: T[];
}

/** Corpo de erro padrão do Asaas. */
export interface AsaasErrorBody {
  errors?: Array<{ code: string; description: string }>;
}

/** Payload dos webhooks de cobrança. */
export interface AsaasWebhookEvent {
  id?: string;
  event: AsaasWebhookEventName;
  payment?: AsaasPayment;
}
