import type { MessagingAdapter, OutgoingMessage, SendReceipt } from "./adapter";

/** Texto exibido na UI e devolvido pelas actions enquanto não há provedor. */
export const MESSAGING_NOT_CONFIGURED = "Envio pelo WhatsApp ainda não configurado.";

/** Lançado pelo NullAdapter: sem provedor, nenhum envio é aceito. */
export class MessagingNotConfiguredError extends Error {
  constructor() {
    super(MESSAGING_NOT_CONFIGURED);
    this.name = "MessagingNotConfiguredError";
  }
}

export type DeliveryOutcome =
  | { ok: true; receipt: SendReceipt }
  | { ok: false; reason: "not_configured" | "provider_error" | "persist_error" };

/**
 * Fluxo único de envio: provedor primeiro, persistência depois.
 * - adapter null (sem provedor) ou NullAdapter: bloqueia, `persist` nunca roda.
 * - falha do provedor: `persist` nunca roda (nada é gravado como enviado).
 * - `persist` devolve false/lança: reporta persist_error.
 */
export async function deliverAndPersist(
  adapter: MessagingAdapter | null,
  message: OutgoingMessage,
  persist: (receipt: SendReceipt) => Promise<boolean>,
): Promise<DeliveryOutcome> {
  if (!adapter || adapter.provider === "null") return { ok: false, reason: "not_configured" };

  let receipt: SendReceipt;
  try {
    receipt = await adapter.sendMessage(message);
  } catch (error) {
    if (error instanceof MessagingNotConfiguredError) return { ok: false, reason: "not_configured" };
    console.error(`[messaging/${adapter.provider}] sendMessage:`, error);
    return { ok: false, reason: "provider_error" };
  }

  try {
    const saved = await persist(receipt);
    return saved ? { ok: true, receipt } : { ok: false, reason: "persist_error" };
  } catch (error) {
    console.error("[messaging] persist:", error);
    return { ok: false, reason: "persist_error" };
  }
}
