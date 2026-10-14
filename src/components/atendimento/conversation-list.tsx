import Link from "next/link"
import { cn } from "cn"
import { UserRoundIcon } from "lucide-react"

import type { ConversationWithMessages } from "@/lib/types"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { formatListTime, formatTelefoneBR, initials } from "@/lib/format"
import { CONVERSATION_STATUS_META } from "@/lib/status-meta"
import { conversationName, lastMessage } from "@/components/atendimento/format"

type ConversationListProps = {
  conversations: ConversationWithMessages[]
  selectedId: string | null
  /** Gera o href do item (mantém filtros e troca só o `c`). */
  hrefFor: (conversationId: string) => string
}

/**
 * Lista de conversas (coluna esquerda): avatar com iniciais, nome/telefone,
 * prévia da última mensagem, hora e badge de status. Navegação por URL —
 * cada item é um Link que define `?c=` para o server component.
 */
export function ConversationList({
  conversations,
  selectedId,
  hrefFor,
}: ConversationListProps) {
  return (
    <ul
      className="flex min-h-0 flex-1 flex-col divide-y divide-line-soft overflow-y-auto"
      aria-label="Conversas do atendimento"
    >
      {conversations.map((conversation) => {
        const nome = conversationName(conversation)
        const telefone = formatTelefoneBR(conversation.telefone)
        const preview = lastMessage(conversation)?.texto ?? "Sem mensagens"
        const statusMeta = CONVERSATION_STATUS_META[conversation.status]
        const selected = conversation.id === selectedId
        return (
          <li key={conversation.id}>
            <Link
              href={hrefFor(conversation.id)}
              aria-current={selected ? "true" : undefined}
              aria-label={`Abrir conversa com ${nome} (${telefone}), status ${statusMeta.label}`}
              className={cn(
                "flex min-h-11 items-start gap-3 px-3 py-3 transition-colors outline-none focus-visible:bg-console-2",
                selected
                  ? "border-l-2 border-l-signal bg-console-2"
                  : "border-l-2 border-l-transparent hover:bg-console-2/60",
              )}
            >
              <Avatar className="mt-0.5">
                <AvatarFallback className="bg-console-3 font-mono text-[11px] text-ink-dim">
                  {conversation.client ? (
                    initials(nome)
                  ) : (
                    <UserRoundIcon className="size-4" aria-hidden="true" />
                  )}
                </AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium text-ink">
                    {nome}
                  </span>
                  <time className="shrink-0 font-mono text-[10px] text-ink-faint tabular-nums">
                    {formatListTime(conversation.last_message_at)}
                  </time>
                </span>
                <span className="font-mono text-[11px] text-ink-faint tabular-nums">
                  {telefone}
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-ink-dim">{preview}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 font-mono text-[9px] tracking-wider uppercase",
                      statusMeta.badgeClassName,
                    )}
                  >
                    {statusMeta.label}
                  </Badge>
                </span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
