import type {
  IncomingMessageHandler,
  MessagingAdapter,
  OutgoingMessage,
} from "./adapter";
import { MessagingNotConfiguredError } from "./send";

/**
 * Adapter nulo: vigente enquanto o WhatsApp não é conectado (fora do go-live).
 *
 * Comportamento: REJEITA todo envio com MessagingNotConfiguredError, sem tocar
 * em rede. Assim nenhuma mensagem é gravada como enviada sem ter saído de
 * fato. Na ativação, basta registrar o provedor real na factory (`index.ts`).
 */
export function createNullAdapter(): MessagingAdapter {
  const handlers = new Set<IncomingMessageHandler>();

  return {
    provider: "null",

    async sendMessage(message: OutgoingMessage): Promise<never> {
      console.warn(
        `[messaging/null] envio bloqueado (sem provedor) para a conversa ${message.conversationId}`,
      );
      throw new MessagingNotConfiguredError();
    },

    async markRead(conversationId: string) {
      console.info(`[messaging/null] markRead → conversa ${conversationId}`);
    },

    onIncoming(handler: IncomingMessageHandler) {
      // Sem provedor conectado nunca chega mensagem; o handler fica registrado
      // apenas para manter o contrato simétrico ao dos adapters reais.
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
  };
}
