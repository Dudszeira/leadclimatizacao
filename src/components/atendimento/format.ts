import type { ConversationWithMessages, Message } from "@/lib/types"
import { formatTelefoneBR } from "@/lib/format"

/** Helpers puros do Atendimento IA (derivações de conversa/mensagem). */

/** Nome de exibição da conversa: cliente cadastrado ou o telefone. */
export function conversationName(c: ConversationWithMessages): string {
  return c.client?.nome_fantasia ?? c.client?.razao_social ?? formatTelefoneBR(c.telefone)
}

/** Última mensagem com texto (prévia da lista). */
export function lastMessage(c: ConversationWithMessages): Message | null {
  for (let i = c.messages.length - 1; i >= 0; i--) {
    if (c.messages[i].texto) return c.messages[i]
  }
  return null
}

/** Número de OS citado na mensagem (metadata.os_numero), se houver. */
export function messageOsNumero(m: Message): number | null {
  const numero = m.metadata?.os_numero
  return typeof numero === "number" && Number.isFinite(numero) ? numero : null
}

/** true quando a mensagem representa abertura automática de chamado pela IA. */
export function isChamadoAberto(m: Message): boolean {
  return m.metadata?.intent === "abrir_chamado" && messageOsNumero(m) !== null
}
