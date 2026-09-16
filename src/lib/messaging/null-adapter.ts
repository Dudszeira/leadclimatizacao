import type {
  IncomingMessageHandler,
  MessagingAdapter,
  OutgoingMessage,
} from "./adapter";

/**
 * Adapter nulo — implementação vigente enquanto o WhatsApp não é conectado.
 *
 * Comportamento: loga a intenção no servidor e resolve com sucesso, sem tocar
 * em rede. Assim, as server actions já usam o fluxo definitivo (validar →
 * adapter.sendMessage → persistir) e, na ativação, basta trocar o adapter na
 * factory (`index.ts`) — nenhuma tela ou action muda.
 */
export function createNullAdapter(): MessagingAdapter {
  const handlers = new Set<IncomingMessageHandler>();

  return {
    provider: "null",

    async sendMessage(message: OutgoingMessage) {
      console.info(
        `[messaging/null] sendMessage → ${message.telefone} (conversa ${message.conversationId}): ${message.texto.slice(0, 80)}`,
      );
      return { externalId: null };
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
