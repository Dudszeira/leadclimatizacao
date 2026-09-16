"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { LoaderCircleIcon, SendIcon } from "lucide-react"
import { toast } from "sonner"

import { sendConversationMessage } from "@/server/actions/conversations"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type MessageComposerProps = {
  conversationId: string
}

/**
 * Input de resposta da equipe: Textarea + enviar (Enter envia,
 * Shift+Enter quebra linha). Modo demo → toast explicando; Supabase →
 * insert como autor humano via server action.
 */
export function MessageComposer({ conversationId }: MessageComposerProps) {
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
