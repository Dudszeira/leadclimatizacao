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
      <div className="flex flex-col gap-2 border-t border-line-soft p-3">
        <p id={hintId} className="flex items-center gap-2 text-xs text-amber">
          <UnplugIcon className="size-3.5 shrink-0" aria-hidden="true" />
          {disabledReason}
        </p>
        <div className="flex items-end gap-2">
          <Textarea
            value=""
            readOnly
            disabled
            placeholder="Respostas pelo sistema serão liberadas com a integração."
            aria-label="Escrever resposta ao cliente (desativado)"
            aria-describedby={hintId}
            rows={1}
            className="max-h-32 min-h-11 flex-1 resize-none bg-console-2/60"
          />
          <Button
            type="button"
            size="icon-lg"
            className="size-11 shrink-0"
            disabled
            aria-label="Enviar mensagem (desativado)"
          >
            <SendIcon aria-hidden="true" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form
      className="flex items-end gap-2 border-t border-line-soft p-3"
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
        className="max-h-32 min-h-11 flex-1 resize-none bg-console-2/60"
        disabled={isPending}
      />
      <Button
        type="submit"
        size="icon-lg"
        className="size-11 shrink-0"
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
