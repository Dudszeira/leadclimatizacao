"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { LoaderCircleIcon, SearchIcon } from "lucide-react"

import type { ConversationStatus } from "@/lib/types"
import { Input } from "@/components/ui/input"

export type ConversationStatusParam = ConversationStatus | "todas"

type ConversationsSearchProps = {
  q: string
  status: ConversationStatusParam
  /** Conversa selecionada (preservada na URL ao buscar). */
  c: string
}

/**
 * Busca por nome/telefone com debounce refletida na URL (searchParams),
 * mesmo padrão da ChamadosToolbar — o server component refaz a consulta.
 */
export function ConversationsSearch({ q, status, c }: ConversationsSearchProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [text, setText] = React.useState(q)
  const [isPending, startTransition] = React.useTransition()
  const lastAppliedQ = React.useRef(q)

  const apply = React.useCallback(
    (nextQ: string) => {
      lastAppliedQ.current = nextQ
      const params = new URLSearchParams()
      if (nextQ) params.set("q", nextQ)
      if (status !== "todas") params.set("status", status)
      if (c) params.set("c", c)
      const qs = params.toString()
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      })
    },
    [pathname, router, status, c],
  )

  // Navegação por histórico (voltar/avançar): ressincroniza o campo.
  React.useEffect(() => {
    if (q !== lastAppliedQ.current) {
      lastAppliedQ.current = q
      setText(q)
    }
  }, [q])

  // Debounce da busca digitada → URL.
  React.useEffect(() => {
    if (text === q) return
    const timer = setTimeout(() => apply(text), 350)
    return () => clearTimeout(timer)
  }, [text, q, apply])

  return (
    <div className="relative w-full min-w-0">
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-faint"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Buscar por nome ou telefone"
        aria-label="Buscar conversas por nome ou telefone"
        className="h-9 pl-8 max-md:h-11 [&::-webkit-search-cancel-button]:hidden"
      />
      {isPending && (
        <LoaderCircleIcon
          className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-ink-faint"
          aria-hidden="true"
        />
      )}
    </div>
  )
}
