"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { LoaderCircleIcon, SearchIcon } from "lucide-react"

import { Input } from "@/components/ui/input"

/**
 * Busca da lista de orçamentos (número, cliente ou título) com debounce.
 * Mantém status e período da URL e volta para a página 1.
 */
export function QuotesSearch({ q }: { q: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [text, setText] = React.useState(q)
  const [isPending, startTransition] = React.useTransition()
  const lastApplied = React.useRef(q)

  React.useEffect(() => {
    if (q !== lastApplied.current) {
      lastApplied.current = q
      setText(q)
    }
  }, [q])

  React.useEffect(() => {
    if (text === q) return
    const timer = setTimeout(() => {
      lastApplied.current = text
      const params = new URLSearchParams(searchParams.toString())
      if (text.trim()) params.set("q", text.trim())
      else params.delete("q")
      params.delete("pagina")
      const qs = params.toString()
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      })
    }, 350)
    return () => clearTimeout(timer)
  }, [text, q, pathname, router, searchParams])

  return (
    <div className="relative w-full min-w-0 md:max-w-xs">
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-faint"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Buscar por número, cliente ou título"
        aria-label="Buscar orçamentos"
        maxLength={100}
        className="pl-10 [&::-webkit-search-cancel-button]:hidden"
      />
      {isPending && (
        <LoaderCircleIcon
          className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-ink-faint"
          aria-hidden="true"
        />
      )}
    </div>
  )
}
