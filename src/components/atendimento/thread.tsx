import Link from "next/link"
import { cn } from "cn"
import { ArchiveIcon, ArrowLeftIcon, BotIcon, HistoryIcon, UserRoundIcon } from "lucide-react"

import type { ConversationWithMessages, Message } from "@/lib/types"
import type { ConversationOsRef } from "@/server/conversations"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { formatMessageTime, formatTelefoneBR, initials } from "@/lib/format"
import { CONVERSATION_STATUS_META, OS_PRIORITY_META } from "@/lib/status-meta"
import { AiSummaryMobile, type AiStep } from "@/components/atendimento/ai-panel"
import {
  conversationName,
  isChamadoAberto,
  messageOsNumero,
} from "@/components/atendimento/format"
import { MessageComposer } from "@/components/atendimento/message-composer"

type ThreadProps = {
  conversation: ConversationWithMessages
  /** OS citadas nas mensagens, já resolvidas (id/prioridade/equipamento). */
  osRefs: ConversationOsRef[]
  /** Passos do painel "O que a IA fez" (compartilhados com o AiPanel). */
  aiSteps: AiStep[]
  /** Href de volta para a lista (mobile). */
  backHref: string
  /** Href que amplia a janela de mensagens; null quando não há anteriores. */
  olderHref?: string | null
  /** Motivo do envio estar bloqueado (ex.: WhatsApp não configurado). */
  sendDisabledReason?: string | null
}

/**
 * Thread da conversa (coluna central): header com contato, resumo da IA
 * (< xl), bolhas estilo WhatsApp, eventos de sistema e input de resposta.
 */
export function Thread({
  conversation,
  osRefs,
  aiSteps,
  backHref,
  olderHref = null,
  sendDisabledReason = null,
}: ThreadProps) {
  const nome = conversationName(conversation)
  const telefone = formatTelefoneBR(conversation.telefone)
  const statusMeta = CONVERSATION_STATUS_META[conversation.status]
  const refByNumero = new Map(osRefs.map((ref) => [ref.numero, ref]))
  const encerrada = conversation.status === "encerrado"

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-line-soft px-3 py-2.5 md:px-4">
        <Link
          href={backHref}
          aria-label="Voltar para a lista de conversas"
          className="flex size-11 shrink-0 items-center justify-center rounded-lg text-ink-dim transition-colors hover:bg-console-2 hover:text-ink md:hidden"
        >
          <ArrowLeftIcon className="size-5" aria-hidden="true" />
        </Link>
        <Avatar>
          <AvatarFallback className="bg-console-3 font-mono text-[11px] text-ink-dim">
            {conversation.client ? (
              initials(nome)
            ) : (
              <UserRoundIcon className="size-4" aria-hidden="true" />
            )}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">
            {conversation.client?.id ? (
              <Link
                href={`/clientes/${conversation.client.id}`}
                className="rounded-sm outline-none hover:underline focus-visible:underline"
              >
                {nome}
              </Link>
            ) : (
              nome
            )}
          </p>
          <p className="truncate font-mono text-[11px] text-ink-faint tabular-nums">
            {telefone}
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 font-mono text-[9px] tracking-wider uppercase",
            statusMeta.badgeClassName,
          )}
        >
          {statusMeta.label}
        </Badge>
      </header>

      <AiSummaryMobile
        conversationId={conversation.id}
        status={conversation.status}
        steps={aiSteps}
      />

      <div
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 md:p-4"
        aria-label={`Mensagens da conversa com ${nome}`}
      >
        {olderHref && (
          <Link
            href={olderHref}
            scroll={false}
            className="flex min-h-9 items-center justify-center gap-1.5 self-center rounded-full border border-line-soft px-3 text-xs text-ink-dim transition-colors outline-none hover:bg-console-2 hover:text-ink focus-visible:border-ring max-md:min-h-11"
          >
            <HistoryIcon className="size-3.5" aria-hidden="true" />
            Carregar mensagens anteriores
          </Link>
        )}
        {conversation.messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            osRef={
              isChamadoAberto(message)
                ? refByNumero.get(messageOsNumero(message) ?? -1) ?? null
                : null
            }
          />
        ))}
      </div>

      {encerrada ? (
        <p className="flex items-center justify-center gap-2 border-t border-line-soft px-4 py-3.5 text-xs text-ink-faint">
          <ArchiveIcon className="size-3.5" aria-hidden="true" />
          Conversa encerrada. O envio de novas mensagens está desativado.
        </p>
      ) : (
        <MessageComposer
          conversationId={conversation.id}
          disabledReason={sendDisabledReason}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bolhas e eventos de sistema
// ---------------------------------------------------------------------------

function MessageItem({
  message,
  osRef,
}: {
  message: Message
  osRef: ConversationOsRef | null
}) {
  const doCliente = message.autor === "cliente"
  const daIa = message.autor === "ia"
  const numero = messageOsNumero(message)

  return (
    <>
      <div
        className={cn(
          "flex max-w-[85%] flex-col gap-1 rounded-2xl px-3.5 py-2.5 md:max-w-[70%]",
          doCliente
            ? "self-start rounded-bl-md bg-console-2"
            : "self-end rounded-br-md border border-signal/40 bg-signal-dim",
        )}
      >
        {!doCliente && (
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-signal">
            {daIa ? (
              <>
                <BotIcon className="size-3.5" aria-hidden="true" />
                IA
              </>
            ) : (
              <>
                <UserRoundIcon className="size-3.5" aria-hidden="true" />
                Equipe
              </>
            )}
          </span>
        )}
        <p className="text-sm leading-relaxed break-words text-ink">
          {message.texto}
        </p>
        <time
          dateTime={message.created_at}
          className="self-end font-mono text-[10px] text-ink-faint tabular-nums"
        >
          {formatMessageTime(message.created_at)}
        </time>
      </div>

      {isChamadoAberto(message) && numero !== null && (
        <div className="flex justify-center py-1">
          {osRef ? (
            <Link
              href={`/chamados/${osRef.id}`}
              aria-label={`Abrir chamado #${numero}`}
              className="rounded-full border border-amber/30 bg-amber-dim px-3 py-1.5 text-center font-mono text-[10px] tracking-wider text-amber uppercase transition-colors outline-none hover:border-amber/60 focus-visible:border-amber"
            >
              Chamado #{numero} aberto automaticamente
              {osRef.prioridade === "urgente" || osRef.prioridade === "alta"
                ? ` · Prioridade ${OS_PRIORITY_META[osRef.prioridade].label}`
                : ""}
            </Link>
          ) : (
            <span className="rounded-full border border-amber/30 bg-amber-dim px-3 py-1.5 text-center font-mono text-[10px] tracking-wider text-amber uppercase">
              Chamado #{numero} aberto automaticamente
            </span>
          )}
        </div>
      )}
    </>
  )
}
