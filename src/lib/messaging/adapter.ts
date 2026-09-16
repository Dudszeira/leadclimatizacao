/**
 * Contrato de mensageria do Atendimento IA.
 *
 * A integração real com WhatsApp foi adiada por decisão do cliente, então o
 * módulo /atendimento nasce como interface interna. Este arquivo define a
 * interface que QUALQUER provedor de mensagens (Evolution API, WhatsApp Cloud
 * API, Twilio…) deverá implementar quando a integração for ativada — a UI e as
 * server actions dependem apenas deste contrato, nunca do provedor.
 *
 * Para plugar um provedor novo, veja o README.md desta pasta.
 */

/** Mensagem de saída (equipe/IA → cliente) entregue ao provedor. */
export interface OutgoingMessage {
  /** Id da conversa no Control Lead (tabela conversations). */
  conversationId: string;
  /** Telefone do destinatário em E.164 (ex.: "+554133303030"). */
  telefone: string;
  /** Corpo da mensagem em texto puro. */
  texto: string;
}

/** Recibo devolvido pelo provedor após aceitar o envio. */
export interface SendReceipt {
  /**
   * Id externo da mensagem no provedor (ex.: wa_id do WhatsApp).
   * `null` quando o provedor não gera id (caso do NullAdapter).
   */
  externalId: string | null;
}

/** Mensagem recebida do cliente via webhook do provedor. */
export interface IncomingMessage {
  /** Telefone do remetente em E.164. */
  telefone: string;
  /** Corpo da mensagem em texto puro. */
  texto: string;
  /** Id externo da mensagem no provedor (para dedupe/markRead). */
  externalId: string | null;
  /** Quando a mensagem foi recebida (ISO 8601). */
  recebidaEm: string;
  /** Payload extra do provedor (mídia, contexto, etc.). */
  metadata?: Record<string, unknown>;
}

/** Handler chamado a cada mensagem recebida. */
export type IncomingMessageHandler = (
  message: IncomingMessage,
) => void | Promise<void>;

/**
 * Adapter de mensageria — porta única entre o Control Lead e o provedor.
 *
 * Implementações previstas:
 * - `null-adapter.ts` (atual): loga e resolve; usado em demo/pré-integração.
 * - Evolution API: `sendMessage` → POST /message/sendText, `onIncoming` ligado
 *   ao webhook de eventos, `markRead` → chat/markMessageAsRead.
 * - WhatsApp Cloud API: `sendMessage` → POST /{phone_id}/messages,
 *   `onIncoming` ligado ao webhook oficial da Meta.
 *
 * Regras do contrato:
 * - Nenhum método deve lançar por falha de rede previsível: rejeitar a Promise
 *   com Error descritivo — quem chama (server action) converte em mensagem
 *   pt-BR amigável.
 * - O adapter NÃO escreve no banco: persistir a mensagem (tabela messages) é
 *   responsabilidade de quem o consome.
 */
export interface MessagingAdapter {
  /** Nome do provedor (para logs/diagnóstico). */
  readonly provider: string;

  /** Envia uma mensagem de texto ao cliente e devolve o recibo do provedor. */
  sendMessage(message: OutgoingMessage): Promise<SendReceipt>;

  /** Marca as mensagens de uma conversa como lidas no provedor. */
  markRead(conversationId: string): Promise<void>;

  /**
   * Registra o handler de mensagens recebidas (webhook → handler).
   * Retorna a função de unsubscribe.
   */
  onIncoming(handler: IncomingMessageHandler): () => void;
}
