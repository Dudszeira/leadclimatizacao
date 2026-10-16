import Link from "next/link"
import { cn } from "cn"
import {
  ArchiveIcon,
  ArrowLeftIcon,
  BotIcon,
  HistoryIcon,
  TicketIcon,
  UserRoundIcon,
} from "lucide-react"

import type { ConversationWithMessages, Message } from "@/lib/types"
import type { ConversationOsRef } from "@/server/conversations"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { buttonVariants } from "@/components/ui/button"
import { formatMessageTime, formatTelefoneBR, initials } from "@/lib/format"
import { CONVERSATION_STATUS_META, OS_PRIORITY_META } from "@/lib/status-meta"
import { AiPanelSheet, type AiStep } from "@/components/atendimento/ai-panel"
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
  /** Href de volta para a lista (celular e tablet). */
  backHref: string
  /** Href que amplia a janela de mensagens; null quando não há anteriores. */
  olderHref?: string | null
  /** Motivo do envio estar bloqueado (ex.: WhatsApp não configurado). */
  sendDisabledReason?: string | null
}

/**
 * Conversa (painel central): cabeçalho com contato e status, bolhas no estilo
 * WhatsApp ancoradas no fim, eventos de sistema e campo de resposta. Abaixo de
 * xl o painel da IA abre em folha inferior pelo botão do cabeçalho.
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
      <header className="flex items-center gap-2 border-b border-line-soft px-2 py-2 md:gap-3 md:px-4 md:py-3">
        <Link
          href={backHref}
          aria-label="Voltar para a lista de conversas"
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "text-ink lg:hidden")}
        >
          <ArrowLeftIcon className="size-5" aria-hidden="true" />
        </Link>
        <Avatar size="lg">
          <AvatarFallback className="bg-console-3 text-xs font-medium text-ink-dim">
            {conversation.client ? (
              initials(nome)
            ) : (
              <UserRoundIcon className="size-4" aria-hidden="true" />
            )}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-[1.0625rem] leading-snug font-medium tracking-[-0.01em] text-ink">
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
          </h2>
          <p className="flex min-w-0 items-center gap-2 text-[0.8125rem] text-ink-dim">
            {conversation.client ? (
              <span className="truncate tabular-nums">{telefone}</span>
            ) : null}
            <span className="inline-flex shrink-0 items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn("size-1.5 rounded-full", statusMeta.dotClassName)}
              />
              <span className="sr-only">Status:</span>
              {statusMeta.label}
            </span>
          </p>
        </div>
        <AiPanelSheet
          conversationId={conversation.id}
          status={conversation.status}
          steps={aiSteps}
        />
      </header>

      {/* flex-col-reverse: a rolagem começa na mensagem mais recente. */}
      <div
        className="scroll-contain flex min-h-0 flex-1 flex-col-reverse overflow-y-auto"
        aria-label={`Mensagens da conversa com ${nome}`}
      >
        <div className="flex flex-col gap-2.5 px-3 py-4 md:px-5 md:py-5">
          {olderHref && (
            <Link
              href={olderHref}
              scroll={false}
              className={cn(
                buttonVariants({ variant: "secondary", size: "sm" }),
                "mb-2 self-center text-ink-dim",
              )}
            >
              <HistoryIcon aria-hidden="true" />
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
      </div>

      {encerrada ? (
        <p className="flex items-center justify-center gap-2 border-t border-line-soft px-4 py-4 text-[0.8125rem] text-ink-dim">
          <ArchiveIcon className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
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
  const prioridadeAlta =
    osRef && (osRef.prioridade === "urgente" || osRef.prioridade === "alta")
      ? ` · Prioridade ${OS_PRIORITY_META[osRef.prioridade].label.toLowerCase()}`
      : ""

  return (
    <>
      <div
        className={cn(
          "flex max-w-[85%] flex-col gap-1 rounded-[1.25rem] px-4 py-2.5 md:max-w-[72%]",
          doCliente
            ? "self-start rounded-bl-md bg-console-2"
            : daIa
              ? "self-end rounded-br-md bg-signal-dim"
              : "self-end rounded-br-md bg-console-3",
        )}
      >
        {!doCliente && (
          <span
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium",
              daIa ? "text-signal" : "text-ink-dim",
            )}
          >
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
        <p className="text-[0.9375rem] leading-relaxed break-words text-ink md:text-sm">
          {message.texto}
        </p>
        <time
          dateTime={message.created_at}
          className="self-end text-xs text-ink-faint tabular-nums"
        >
          {formatMessageTime(message.created_at)}
        </time>
      </div>

      {isChamadoAberto(message) && numero !== null && (
        <div className="flex justify-center py-1.5">
          {osRef ? (
            <Link
              href={`/chamados/${osRef.id}`}
              aria-label={`Abrir chamado #${numero}`}
              className="inline-flex min-h-9 items-center gap-2 rounded-2xl bg-amber-dim px-3.5 py-1.5 text-center text-[0.8125rem] font-medium text-amber transition-colors outline-none hover:bg-amber/20 focus-visible:ring-3 focus-visible:ring-amber/40"
            >
              <TicketIcon className="size-4 shrink-0" aria-hidden="true" />
              <span>
                Chamado <span className="tabular-nums">#{numero}</span> aberto automaticamente
                {prioridadeAlta}
              </span>
            </Link>
          ) : (
            <span className="inline-flex min-h-9 items-center gap-2 rounded-2xl bg-amber-dim px-3.5 py-1.5 text-center text-[0.8125rem] font-medium text-amber">
              <TicketIcon className="size-4 shrink-0" aria-hidden="true" />
              <span>
                Chamado <span className="tabular-nums">#{numero}</span> aberto automaticamente
              </span>
            </span>
          )}
        </div>
      )}
    </>
  )
}
