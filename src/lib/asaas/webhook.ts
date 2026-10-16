import { timingSafeEqual } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { httpsUrl } from "../safe-url";
import { paidAtFromAsaasDate } from "./dates";

/**
 * Núcleo do webhook do Asaas (cobranças + notas fiscais), sem dependência de
 * env/Next — o route handler injeta config e o client service role. Testado em
 * tests/unit/webhook-asaas.test.ts com um Supabase falso.
 *
 * Contrato com o Asaas (docs.asaas.com → Webhooks):
 * - Autenticação pelo header `asaas-access-token` (comparação em tempo constante).
 * - Entrega "at least once": o `id` do evento é a chave de idempotência —
 *   gravamos em public.webhook_events (on conflict do nothing) e, se o evento
 *   já foi processado, respondemos 200 sem reprocessar.
 * - Falha de banco → 500 (o Asaas reenvia) e o erro fica em webhook_events.error.
 *   Após 15 falhas seguidas o Asaas pausa a fila: monitore webhook_events.
 * - Fecha por padrão: modo demo ou token ausente → 503; token divergente → 401.
 * - Pagamento (RECEIVED/CONFIRMED) só marca a fatura como paga depois de
 *   conferir no Asaas (GET /payments/{id}) status e valor contra a fatura;
 *   divergência não marca, grava webhook_events.error e responde 200.
 * - LGPD: webhook_events.payload guarda só o mínimo (ids, evento, status,
 *   valores, datas, links/número) — nunca nome/CPF/e-mail do pagador.
 */

export const ASAAS_TOKEN_HEADER = "asaas-access-token";
/** Payloads do Asaas têm poucos KB; 64 KB dá folga e barra abuso. */
export const MAX_WEBHOOK_BODY_BYTES = 64 * 1024;

/** Cobrança como o Asaas devolve em GET /payments/{id} (só o que conferimos). */
export interface RemotePayment {
  id: string;
  status: string;
  value: number;
  billingType?: string | null;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  externalReference?: string | null;
  deleted?: boolean | null;
}

export interface WebhookConfig {
  demo: boolean;
  expectedToken: string | undefined;
  /**
   * Busca a cobrança na API do Asaas (fonte da verdade). Lança em falha de
   * rede/API → 500 e o Asaas reenvia. Injetado pelo route handler.
   */
  fetchPayment: (paymentId: string) => Promise<RemotePayment>;
}

export interface WebhookResult {
  status: number;
  body: Record<string, unknown>;
}

type Db = Pick<SupabaseClient, "from">;

// ----------------------------------------------------------------------------
// Validação do payload
// ----------------------------------------------------------------------------

const optionalText = z.string().max(2048).nullish();

const paymentSchema = z.looseObject({
  id: z.string().min(1).max(100),
  status: optionalText,
  billingType: optionalText,
  paymentDate: optionalText,
  clientPaymentDate: optionalText,
  invoiceUrl: optionalText,
  bankSlipUrl: optionalText,
  externalReference: optionalText,
});

const invoiceSchema = z.looseObject({
  id: z.string().min(1).max(100),
  status: optionalText,
  number: z.union([z.string().max(100), z.number()]).nullish(),
  pdfUrl: optionalText,
  xmlUrl: optionalText,
  payment: optionalText,
  externalReference: optionalText,
  statusDescription: optionalText,
});

export const webhookEventSchema = z.looseObject({
  id: z.string().min(1).max(200),
  event: z.string().min(1).max(100),
  dateCreated: optionalText,
  payment: paymentSchema.nullish(),
  invoice: invoiceSchema.nullish(),
});

export type ParsedWebhookEvent = z.infer<typeof webhookEventSchema>;
type ParsedPayment = z.infer<typeof paymentSchema>;
type ParsedInvoice = z.infer<typeof invoiceSchema>;

const uuidSchema = z.uuid();

function asUuid(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = uuidSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// ----------------------------------------------------------------------------
// Autenticação e leitura do corpo
// ----------------------------------------------------------------------------

/** Compara tokens em tempo constante (tamanhos diferentes → false sem vazar timing do conteúdo). */
export function tokensMatch(received: string | null | undefined, expected: string): boolean {
  if (!received) return false;
  const a = Buffer.from(received, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    // Mantém o custo de uma comparação para não sinalizar o tamanho correto.
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

class BodyTooLargeError extends Error {}

/** Lê o corpo como texto respeitando o limite (mesmo sem content-length). */
async function readBodyLimited(request: Request, limit: number): Promise<string> {
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > limit) throw new BodyTooLargeError();
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

// ----------------------------------------------------------------------------
// Acesso ao banco
// ----------------------------------------------------------------------------

/** Falha de banco: vira 500 para o Asaas reenviar. */
export class WebhookDbError extends Error {
  constructor(context: string, cause: unknown) {
    const detail =
      cause && typeof cause === "object" && "message" in cause
        ? String((cause as { message: unknown }).message)
        : String(cause);
    super(`${context}: ${detail}`.slice(0, 500));
    this.name = "WebhookDbError";
  }
}

/** Webhook diz "pago", mas a API do Asaas não confirma (status/valor/fatura). */
export class PaymentDivergenceError extends Error {
  constructor(reason: string) {
    super(`Pagamento não confirmado no Asaas: ${reason}`.slice(0, 500));
    this.name = "PaymentDivergenceError";
  }
}

/** Status do Asaas que significam dinheiro recebido/confirmado. */
const PAID_STATUSES = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

type InvoiceTarget = { id: string; valor: number; status: string; via: "pid" | "ref" };

/** Confere a cobrança remota contra a fatura local; devolve o motivo da divergência ou null. */
export function paymentDivergence(
  remote: RemotePayment | null | undefined,
  pid: string,
  invoice: Pick<InvoiceTarget, "id" | "valor">,
): string | null {
  if (!remote || typeof remote !== "object") return "cobrança não encontrada na API";
  if (remote.id !== pid) return "id da cobrança diferente do evento";
  if (remote.deleted) return "cobrança removida no Asaas";
  if (!PAID_STATUSES.has(String(remote.status))) return `status no Asaas é ${String(remote.status)}`;
  const valorRemoto = Number(remote.value);
  const valorFatura = Number(invoice.valor);
  if (!Number.isFinite(valorRemoto) || !Number.isFinite(valorFatura)) return "valor inválido";
  // Juros/multa podem aumentar o valor recebido; a menor é divergência.
  if (valorRemoto + 0.009 < valorFatura) {
    return `valor no Asaas (${valorRemoto.toFixed(2)}) menor que o da fatura (${valorFatura.toFixed(2)})`;
  }
  const ref = asUuid(remote.externalReference);
  if (ref && ref !== invoice.id) return "externalReference aponta para outra fatura";
  return null;
}

type Cond =
  | { op: "eq"; col: string; val: string }
  | { op: "neq"; col: string; val: string }
  | { op: "in"; col: string; val: string[] }
  | { op: "is"; col: string; val: null }
  | { op: "or"; expr: string };

/** UPDATE condicional em invoices; devolve quantas linhas mudaram. */
async function updateInvoices(
  db: Db,
  context: string,
  patch: Record<string, unknown>,
  conds: Cond[],
): Promise<number> {
  let query = db.from("invoices").update(patch);
  for (const c of conds) {
    if (c.op === "eq") query = query.eq(c.col, c.val);
    else if (c.op === "neq") query = query.neq(c.col, c.val);
    else if (c.op === "in") query = query.in(c.col, c.val);
    else if (c.op === "is") query = query.is(c.col, c.val);
    else query = query.or(c.expr);
  }
  const { data, error } = await query.select("id");
  if (error) throw new WebhookDbError(context, error);
  return Array.isArray(data) ? data.length : 0;
}

/** Fatura sem cobrança vinculada ou com o lock lógico de geração ("pending:…"). */
const SEM_COBRANCA = "asaas_id.is.null,asaas_id.like.pending:*";
const SEM_NOTA = "asaas_invoice_id.is.null,asaas_invoice_id.like.pending:*";

function metodoFrom(billingType: string | null | undefined): "pix" | "boleto" | null {
  if (billingType === "PIX") return "pix";
  if (billingType === "BOLETO") return "boleto";
  return null;
}

// ----------------------------------------------------------------------------
// Regras por evento
// ----------------------------------------------------------------------------

/** Fatura alvo do pagamento: por asaas_id; senão por externalReference sem cobrança gravada. */
async function findInvoiceForPayment(
  db: Db,
  event: string,
  pid: string,
  ref: string | null,
): Promise<InvoiceTarget | null> {
  const { data, error } = await db
    .from("invoices")
    .select("id, valor, status")
    .eq("asaas_id", pid)
    .neq("status", "cancelado")
    .maybeSingle();
  if (error) throw new WebhookDbError(`${event} (buscar fatura)`, error);
  const row = data as { id: string; valor: number | string; status: string } | null;
  if (row) return { id: row.id, valor: Number(row.valor), status: row.status, via: "pid" };
  if (!ref) return null;

  const { data: byRef, error: refError } = await db
    .from("invoices")
    .select("id, valor, status")
    .eq("id", ref)
    .or(SEM_COBRANCA)
    .neq("status", "cancelado")
    .maybeSingle();
  if (refError) throw new WebhookDbError(`${event} (buscar fatura por referência)`, refError);
  const r = byRef as { id: string; valor: number | string; status: string } | null;
  return r ? { id: r.id, valor: Number(r.valor), status: r.status, via: "ref" } : null;
}

// ----------------------------------------------------------------------------
// Minimização (LGPD): o que fica gravado em webhook_events.payload
// ----------------------------------------------------------------------------

const PAYMENT_KEEP = [
  "id", "status", "billingType", "value", "netValue", "originalValue", "interestValue",
  "dueDate", "originalDueDate", "paymentDate", "clientPaymentDate", "confirmedDate",
  "creditDate", "invoiceUrl", "bankSlipUrl", "invoiceNumber", "externalReference", "deleted",
] as const;
const INVOICE_KEEP = [
  "id", "status", "number", "value", "pdfUrl", "xmlUrl", "payment", "externalReference",
  "effectiveDate", "statusDescription",
] as const;

function pickScalars(source: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (!source || typeof source !== "object") return null;
  const obj = source as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string") out[k] = v.slice(0, 500);
    else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
  }
  return out;
}

/** Só ids, evento, status, valores, datas e links/número — sem dados do pagador. */
export function minimizeWebhookPayload(event: ParsedWebhookEvent): Record<string, unknown> {
  const out: Record<string, unknown> = { id: event.id, event: event.event };
  if (event.dateCreated) out.dateCreated = event.dateCreated;
  const payment = pickScalars(event.payment, PAYMENT_KEEP);
  if (payment) out.payment = payment;
  const invoice = pickScalars(event.invoice, INVOICE_KEEP);
  if (invoice) out.invoice = invoice;
  return out;
}

/** Aplica o evento de cobrança; devolve quantas faturas foram afetadas. */
async function applyPaymentEvent(
  db: Db,
  event: string,
  payment: ParsedPayment,
  fetchPayment: WebhookConfig["fetchPayment"],
): Promise<number> {
  const pid = payment.id;
  const byPid: Cond = { op: "eq", col: "asaas_id", val: pid };
  const ref = asUuid(payment.externalReference);
  const link = payment.invoiceUrl ?? payment.bankSlipUrl ?? null;

  // Fallback por externalReference (= invoices.id) quando a gravação do
  // asaas_id falhou depois de criar a cobrança (lock "pending:" ficou).
  const byRef = async (patch: Record<string, unknown>, extra: Cond[] = []) =>
    ref
      ? updateInvoices(db, `${event} (externalReference)`, { ...patch, asaas_id: pid, asaas_url: link }, [
          { op: "eq", col: "id", val: ref },
          { op: "or", expr: SEM_COBRANCA },
          ...extra,
        ])
      : 0;

  switch (event) {
    case "PAYMENT_RECEIVED":
    case "PAYMENT_CONFIRMED": {
      const alvo = await findInvoiceForPayment(db, event, pid, ref);
      if (!alvo) return 0;
      // Fonte da verdade: a API do Asaas (o corpo do webhook só dispara a conferência).
      const remote = await fetchPayment(pid);
      const divergence = paymentDivergence(remote, pid, alvo);
      if (divergence) throw new PaymentDivergenceError(divergence);

      const metodo = metodoFrom(remote.billingType ?? payment.billingType);
      const patch = {
        status: "pago",
        paid_at: paidAtFromAsaasDate(
          remote.paymentDate ?? remote.clientPaymentDate ?? payment.paymentDate ?? payment.clientPaymentDate,
        ),
        ...(metodo ? { metodo } : {}),
      };
      const notCanceled: Cond = { op: "neq", col: "status", val: "cancelado" };
      const byId: Cond = { op: "eq", col: "id", val: alvo.id };
      if (alvo.via === "pid") return updateInvoices(db, event, patch, [byPid, byId, notCanceled]);
      return byRef(patch, [notCanceled]);
    }
    case "PAYMENT_OVERDUE": {
      const pendente: Cond = { op: "eq", col: "status", val: "pendente" };
      const n = await updateInvoices(db, event, { status: "atrasado" }, [byPid, pendente]);
      return n > 0 ? n : byRef({ status: "atrasado" }, [pendente]);
    }
    case "PAYMENT_DELETED":
      // Cobrança removida no Asaas: a fatura volta a ficar sem cobrança e pode
      // ser cobrada de novo. Faturas pagas/canceladas não são tocadas.
      return updateInvoices(db, event, { asaas_id: null, asaas_url: null }, [
        byPid,
        { op: "in", col: "status", val: ["pendente", "atrasado"] },
      ]);
    case "PAYMENT_RESTORED":
      return ref
        ? updateInvoices(db, event, { asaas_id: pid, asaas_url: link }, [
            { op: "eq", col: "id", val: ref },
            { op: "or", expr: SEM_COBRANCA },
          ])
        : 0;
    case "PAYMENT_REFUNDED":
      // Estorno total: o valor voltou ao cliente — a fatura sai do previsto.
      return updateInvoices(db, event, { status: "cancelado", paid_at: null }, [byPid]);
    case "PAYMENT_RECEIVED_IN_CASH_UNDONE":
      return updateInvoices(db, event, { status: "pendente", paid_at: null }, [
        byPid,
        { op: "eq", col: "status", val: "pago" },
      ]);
    case "PAYMENT_CHARGEBACK_REQUESTED":
    case "PAYMENT_CHARGEBACK_DISPUTE":
    case "PAYMENT_AWAITING_CHARGEBACK_REVERSAL":
      // Valor contestado: deixa de contar como recebido e entra na inadimplência.
      return updateInvoices(db, event, { status: "atrasado", paid_at: null }, [
        byPid,
        { op: "eq", col: "status", val: "pago" },
      ]);
    default:
      return 0;
  }
}

/** Aplica o evento de nota fiscal; devolve quantas faturas foram afetadas. */
async function applyInvoiceEvent(db: Db, event: string, nota: ParsedInvoice): Promise<number> {
  const iid = nota.id;
  const byIid: Cond = { op: "eq", col: "asaas_invoice_id", val: iid };
  const ref = asUuid(nota.externalReference);

  /** Casa pelo id da nota; senão por externalReference; senão pela cobrança. */
  const updateNota = async (patch: Record<string, unknown>, fallbackPatch: Record<string, unknown>) => {
    const n = await updateInvoices(db, event, patch, [byIid]);
    if (n > 0) return n;
    if (ref) {
      const m = await updateInvoices(db, `${event} (externalReference)`, fallbackPatch, [
        { op: "eq", col: "id", val: ref },
        { op: "or", expr: SEM_NOTA },
      ]);
      if (m > 0) return m;
    }
    if (nota.payment) {
      return updateInvoices(db, `${event} (payment)`, fallbackPatch, [
        { op: "eq", col: "asaas_id", val: nota.payment },
        { op: "or", expr: SEM_NOTA },
      ]);
    }
    return 0;
  };

  switch (event) {
    case "INVOICE_AUTHORIZED": {
      const numero = nota.number == null || nota.number === "" ? null : String(nota.number);
      const link = httpsUrl(nota.pdfUrl);
      const patch = {
        asaas_invoice_id: iid,
        ...(numero ? { nf_numero: numero } : {}),
        ...(link ? { nf_url: link } : {}),
      };
      return updateNota(patch, patch);
    }
    case "INVOICE_ERROR":
      // Prefeitura recusou: libera a fatura para nova emissão (o motivo fica
      // no payload gravado em webhook_events).
      return updateNota({ asaas_invoice_id: null }, { asaas_invoice_id: null });
    case "INVOICE_CANCELED":
      return updateNota(
        { asaas_invoice_id: null, nf_numero: null, nf_url: null },
        { asaas_invoice_id: null, nf_numero: null, nf_url: null },
      );
    default:
      return 0;
  }
}

// ----------------------------------------------------------------------------
// Handler
// ----------------------------------------------------------------------------

function json(status: number, body: Record<string, unknown>): WebhookResult {
  return { status, body };
}

export async function handleAsaasWebhook(
  request: Request,
  config: WebhookConfig,
  getDb: () => Db,
): Promise<WebhookResult> {
  if (config.demo) {
    return json(503, {
      error:
        "Modo demonstração — o webhook do Asaas será habilitado quando o banco do cliente (Supabase) for conectado.",
    });
  }
  if (!config.expectedToken) {
    console.error("[webhooks/asaas] ASAAS_WEBHOOK_TOKEN ausente — evento recusado por segurança.");
    return json(503, { error: "Webhook não configurado." });
  }
  if (!tokensMatch(request.headers.get(ASAAS_TOKEN_HEADER), config.expectedToken)) {
    return json(401, { error: "Token do webhook inválido." });
  }

  let raw: string;
  try {
    raw = await readBodyLimited(request, MAX_WEBHOOK_BODY_BYTES);
  } catch (error) {
    if (error instanceof BodyTooLargeError) return json(413, { error: "Corpo muito grande." });
    return json(400, { error: "Corpo inválido." });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return json(400, { error: "Corpo inválido." });
  }
  const parsed = webhookEventSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return json(400, { error: "Evento inválido." });
  }
  const event = parsed.data;

  let db: Db;
  try {
    db = getDb();
  } catch (error) {
    console.error("[webhooks/asaas] client service role indisponível:", error);
    return json(500, { error: "Falha temporária." });
  }

  // 1. Idempotência: registra o evento (on conflict do nothing) e checa se já foi processado.
  try {
    const { error: insertError } = await db
      .from("webhook_events")
      .upsert(
        { id: event.id, event: event.event, payload: minimizeWebhookPayload(event) },
        { onConflict: "id", ignoreDuplicates: true },
      );
    if (insertError) throw new WebhookDbError("registrar evento", insertError);

    const { data: existing, error: readError } = await db
      .from("webhook_events")
      .select("processed_at")
      .eq("id", event.id)
      .maybeSingle();
    if (readError) throw new WebhookDbError("ler evento", readError);
    if (existing && (existing as { processed_at: string | null }).processed_at) {
      return json(200, { received: true, duplicate: true });
    }
  } catch (error) {
    console.error("[webhooks/asaas] falha ao registrar evento:", error instanceof Error ? error.message : error);
    return json(500, { error: "Falha temporária ao registrar o evento." });
  }

  // 2. Regra de negócio.
  let affected = 0;
  try {
    if (event.event.startsWith("PAYMENT_") && event.payment) {
      affected = await applyPaymentEvent(db, event.event, event.payment, config.fetchPayment);
    } else if (event.event.startsWith("INVOICE_") && event.invoice) {
      affected = await applyInvoiceEvent(db, event.event, event.invoice);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof PaymentDivergenceError) {
      // Não marca pago nem processado (um reenvio manual reconfere); 200 evita
      // que o Asaas fique reenviando algo que não vai mudar sozinho.
      console.error(`[webhooks/asaas] ${event.event} (${event.id}) recusado: ${message}`);
      const { error: markError } = await db
        .from("webhook_events")
        .update({ error: message.slice(0, 500) })
        .eq("id", event.id);
      if (markError) console.error("[webhooks/asaas] falha ao gravar erro do evento:", markError.message);
      return json(200, { received: true, affected: 0, verified: false });
    }
    console.error(`[webhooks/asaas] falha ao processar ${event.event} (${event.id}): ${message}`);
    const { error: markError } = await db
      .from("webhook_events")
      .update({ error: message.slice(0, 500) })
      .eq("id", event.id);
    if (markError) console.error("[webhooks/asaas] falha ao gravar erro do evento:", markError.message);
    return json(500, { error: "Falha temporária ao processar o evento." });
  }

  // 3. Marca como processado (se falhar, o reenvio reaplica updates idempotentes).
  const { error: doneError } = await db
    .from("webhook_events")
    .update({ processed_at: new Date().toISOString(), error: null })
    .eq("id", event.id);
  if (doneError) {
    console.error("[webhooks/asaas] falha ao marcar evento processado:", doneError.message);
    return json(500, { error: "Falha temporária ao concluir o evento." });
  }

  return json(200, { received: true, affected });
}
