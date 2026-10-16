"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { LoaderCircleIcon, SendIcon, UnplugIcon } from "lucide-react"
import { toast } from "sonner"

import { sendConversationMessage } from "@/server/actions/conversations"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type MessageComposerProps = {
  conversationId: string
  /** Quando preenchido, o envio fica desativado e o motivo é exibido. */
  disabledReason?: string | null
}

/**
 * Input de resposta da equipe: Textarea + enviar (Enter envia,
 * Shift+Enter quebra linha). Sem provedor de WhatsApp o campo fica
 * desativado com aviso (a action também bloqueia no servidor).
 */
export function MessageComposer({ conversationId, disabledReason = null }: MessageComposerProps) {
  const router = useRouter()
  const [texto, setTexto] = React.useState("")
  const [isPending, startTransition] = React.useTransition()

  function enviar() {
    const corpo = texto.trim()
    if (!corpo || isPending) return
    startTransition(async () => {
      const result = await sendConversationMessage(conversationId, corpo)
      if (result.status === "success") {
        toast.success(result.message)
        setTexto("")
        router.refresh()
      } else {
        toast.error(result.message)
      }
    })
  }

  if (disabledReason) {
    const hintId = `composer-bloqueado-${conversationId}`
    return (
      <div className="flex items-center gap-2 border-t border-line-soft p-3 md:p-4">
        <p
          id={hintId}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-console-2 px-4 py-2 text-[0.8125rem] leading-snug text-ink-dim"
        >
          <UnplugIcon className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
          <span className="min-w-0">{disabledReason}</span>
        </p>
        <Button
          type="button"
          size="icon-lg"
          variant="secondary"
          disabled
          aria-label="Enviar mensagem (desativado)"
          aria-describedby={hintId}
        >
          <SendIcon aria-hidden="true" />
        </Button>
      </div>
    )
  }

  return (
    <form
      className="flex items-end gap-2 border-t border-line-soft p-3 md:p-4"
      onSubmit={(e) => {
        e.preventDefault()
        enviar()
      }}
    >
      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            enviar()
          }
        }}
        placeholder="Responder ao cliente…"
        aria-label="Escrever resposta ao cliente"
        rows={1}
        className="max-h-32 min-h-11 flex-1 resize-none py-2.5"
        disabled={isPending}
      />
      <Button
        type="submit"
        size="icon-lg"
        disabled={isPending || texto.trim() === ""}
        aria-busy={isPending}
        aria-label="Enviar mensagem"
      >
        {isPending ? (
          <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
        ) : (
          <SendIcon aria-hidden="true" />
        )}
      </Button>
    </form>
  )
}
