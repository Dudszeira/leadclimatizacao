import Link from "next/link"
import { cn } from "cn"
import { UserRoundIcon } from "lucide-react"

import type { ConversationWithMessages } from "@/lib/types"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { formatListTime, formatTelefoneBR, initials } from "@/lib/format"
import { CONVERSATION_STATUS_META } from "@/lib/status-meta"
import { conversationName, lastMessage } from "@/components/atendimento/format"

type ConversationListProps = {
  conversations: ConversationWithMessages[]
  selectedId: string | null
  /**
   * true quando o usuário abriu a conversa (`?c=`). Sem isso, o destaque da
   * conversa padrão só aparece a partir de lg, onde a conversa fica ao lado.
   */
  selectionOnMobile: boolean
  /** Gera o href do item (mantém filtros e troca só o `c`). */
  hrefFor: (conversationId: string) => string
}

/**
 * Lista de conversas: linhas arredondadas com avatar, nome, hora, prévia da
 * última mensagem e status em pílula. Navegação por URL: cada item é um Link
 * que define `?c=` para o server component.
 */
export function ConversationList({
  conversations,
  selectedId,
  selectionOnMobile,
  hrefFor,
}: ConversationListProps) {
  return (
    <ul
      className="scroll-contain flex flex-col gap-0.5 rounded-[1.375rem] bg-console p-1.5 ring-1 ring-line md:-mx-1 md:min-h-0 md:flex-1 md:overflow-y-auto md:rounded-none md:bg-transparent md:p-1 md:ring-0"
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
                "flex items-start gap-3 rounded-2xl px-3 py-3 transition-colors duration-150 outline-none hover:bg-console-2 focus-visible:ring-3 focus-visible:ring-signal/50",
                selected &&
                  (selectionOnMobile
                    ? "bg-console-3 hover:bg-console-3"
                    : "lg:bg-console-3 lg:hover:bg-console-3"),
              )}
            >
              <Avatar size="lg">
                <AvatarFallback className="bg-console-3 text-xs font-medium text-ink-dim">
                  {conversation.client ? (
                    initials(nome)
                  ) : (
                    <UserRoundIcon className="size-4" aria-hidden="true" />
                  )}
                </AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[0.9375rem] font-medium text-ink">
                    {nome}
                  </span>
                  <time className="shrink-0 text-xs text-ink-faint tabular-nums">
                    {formatListTime(conversation.last_message_at)}
                  </time>
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[0.8125rem] text-ink-dim">{preview}</span>
                  <span
                    className={cn(
                      "inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-medium",
                      statusMeta.badgeClassName,
                    )}
                  >
                    {statusMeta.label}
                  </span>
                </span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
