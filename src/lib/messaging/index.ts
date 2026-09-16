import type { MessagingAdapter } from "./adapter";
import { createNullAdapter } from "./null-adapter";

export type {
  IncomingMessage,
  IncomingMessageHandler,
  MessagingAdapter,
  OutgoingMessage,
  SendReceipt,
} from "./adapter";

let instance: MessagingAdapter | null = null;

/**
 * Factory do adapter de mensageria, escolhido pela env `MESSAGING_PROVIDER`.
 *
 * Valores previstos:
 * - ausente ou "null" → NullAdapter (demo/pré-integração, comportamento atual)
 * - "evolution"       → Evolution API (implementar em evolution-adapter.ts)
 * - "cloud-api"       → WhatsApp Cloud API (implementar em cloud-api-adapter.ts)
 *
 * Enquanto o provedor configurado não tiver implementação, cai no NullAdapter
 * com aviso no log — o sistema nunca quebra por env adiantada.
 */
export function getMessagingAdapter(): MessagingAdapter {
  if (instance) return instance;

  const provider = process.env.MESSAGING_PROVIDER ?? "null";
  switch (provider) {
    case "null":
      instance = createNullAdapter();
      break;
    default:
      console.warn(
        `[messaging] Provedor "${provider}" ainda não implementado — usando o adapter nulo. Veja src/lib/messaging/README.md.`,
      );
      instance = createNullAdapter();
      break;
  }
  return instance;
}
