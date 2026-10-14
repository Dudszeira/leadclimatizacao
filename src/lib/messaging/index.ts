import type { MessagingAdapter } from "./adapter";
import { createNullAdapter } from "./null-adapter";

export type {
  IncomingMessage,
  IncomingMessageHandler,
  MessagingAdapter,
  OutgoingMessage,
  SendReceipt,
} from "./adapter";
export {
  MESSAGING_NOT_CONFIGURED,
  MessagingNotConfiguredError,
  deliverAndPersist,
  type DeliveryOutcome,
} from "./send";

/**
 * Provedores com implementação real. Vazio na Fase 1: Atendimento IA e
 * WhatsApp ficaram fora do go-live. Ao implementar um provedor, registre aqui
 * (ex.: `evolution: createEvolutionAdapter`).
 */
const PROVIDERS: Record<string, () => MessagingAdapter> = {};

/**
 * Nome do provedor configurado e implementado, ou null quando o envio está
 * bloqueado (env ausente, "null" ou provedor ainda sem implementação).
 */
export function resolveMessagingProvider(
  value: string | undefined = process.env.MESSAGING_PROVIDER,
): string | null {
  const provider = value?.trim();
  if (!provider || provider === "null") return null;
  return Object.prototype.hasOwnProperty.call(PROVIDERS, provider) ? provider : null;
}

/** true somente quando existe um provedor real de envio (WhatsApp) ativo. */
export function isMessagingConfigured(): boolean {
  return resolveMessagingProvider() !== null;
}

let instance: MessagingAdapter | null = null;

/**
 * Factory do adapter de mensageria, escolhido pela env `MESSAGING_PROVIDER`.
 *
 * Sem provedor implementado devolve o NullAdapter, que REJEITA o envio
 * (MessagingNotConfiguredError): nada é gravado como enviado. Prefira checar
 * `isMessagingConfigured()` antes, para bloquear cedo e avisar a UI.
 */
export function getMessagingAdapter(): MessagingAdapter {
  if (instance) return instance;

  const provider = resolveMessagingProvider();
  if (provider) {
    instance = PROVIDERS[provider]();
    return instance;
  }
  const raw = process.env.MESSAGING_PROVIDER?.trim();
  if (raw && raw !== "null") {
    console.warn(
      `[messaging] Provedor "${raw}" ainda não implementado; envio bloqueado. Veja src/lib/messaging/README.md.`,
    );
  }
  instance = createNullAdapter();
  return instance;
}
