import type { ConversationStatus, ConversationWithMessages, Message } from "@/lib/types"

/**
 * Helpers puros do Atendimento IA: rótulos pt-BR e metadados visuais
 * (cores sempre pelos tokens do design system — nada hardcoded).
 */

export const CONVERSATION_STATUS_META: Record<
  ConversationStatus,
  { label: string; badgeClassName: string; dotClassName: string }
> = {
  ia: {
    label: "IA",
    badgeClassName: "border-transparent bg-signal-dim text-signal",
    dotClassName: "bg-signal",
  },
  transferido: {
    label: "Transferido",
    badgeClassName: "border-transparent bg-amber-dim text-amber",
    dotClassName: "bg-amber",
  },
  encerrado: {
    label: "Encerrado",
    badgeClassName: "border-line bg-console-2 text-ink-dim",
    dotClassName: "bg-ink-faint",
  },
}

/** "+554133303030" → "(41) 3330-3030" · "+5541998223302" → "(41) 99822-3302". */
export function formatTelefoneBR(e164: string): string {
  let d = e164.replace(/\D/g, "")
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2)
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  return e164
}

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

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Hora da lista de conversas: "14h05" hoje, "Ontem" ou "12/09". */
export function formatListTime(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const now = new Date()
  if (isSameDay(d, now)) {
    return `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`
  }
  const ontem = new Date(now)
  ontem.setDate(now.getDate() - 1)
  if (isSameDay(d, ontem)) return "Ontem"
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

/** Timestamp da bolha: "14h05" hoje, senão "12/09 · 14h05". */
export function formatMessageTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const hora = `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`
  if (isSameDay(d, new Date())) return hora
  const data = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
  return `${data} · ${hora}`
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
