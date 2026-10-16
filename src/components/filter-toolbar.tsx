"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { LoaderCircleIcon, SearchIcon, XIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type FilterToolbarSelect = {
  /** Nome do searchParam na URL (omitido quando value === defaultValue). */
  param: string
  value: string
  /** Valor "sem filtro" ("todos"/"todas") — nunca vai pra URL. */
  defaultValue: string
  items: Record<string, string>
  ariaLabel: string
  /** Largura mínima do trigger (ex. "min-w-40"). */
  triggerClassName?: string
}

type FilterToolbarProps = {
  q: string
  searchPlaceholder: string
  searchAriaLabel: string
  /** Selects na ordem em que os params entram na URL (depois de `q`). */
  selects: FilterToolbarSelect[]
}

/**
 * Busca com debounce + selects de filtro, tudo refletido na URL
 * (searchParams) para o server component refazer a consulta.
 */
export function FilterToolbar({
  q,
  searchPlaceholder,
  searchAriaLabel,
  selects,
}: FilterToolbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [text, setText] = React.useState(q)
  const [isPending, startTransition] = React.useTransition()
  const lastAppliedQ = React.useRef(q)

  const values = React.useMemo(
    () => selects.map((s) => s.value),
    [selects],
  )

  const apply = React.useCallback(
    (nextQ: string, nextValues: string[]) => {
      lastAppliedQ.current = nextQ
      const params = new URLSearchParams()
      if (nextQ) params.set("q", nextQ)
      selects.forEach((s, i) => {
        if (nextValues[i] !== s.defaultValue) params.set(s.param, nextValues[i])
      })
      const qs = params.toString()
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      })
    },
    [pathname, router, selects],
  )

  // Navegação por histórico (voltar/avançar): ressincroniza o campo de busca.
  React.useEffect(() => {
    if (q !== lastAppliedQ.current) {
      lastAppliedQ.current = q
      setText(q)
    }
  }, [q])

  // Debounce da busca digitada → URL.
  React.useEffect(() => {
    if (text === q) return
    const timer = setTimeout(() => apply(text, values), 350)
    return () => clearTimeout(timer)
  }, [text, q, values, apply])

  const hasFilters =
    q !== "" || selects.some((s) => s.value !== s.defaultValue)

  return (
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-2">
      <div className="relative w-full min-w-0 md:max-w-xs">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-faint"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchAriaLabel}
          className="pl-10 [&::-webkit-search-cancel-button]:hidden"
        />
        {isPending && (
          <LoaderCircleIcon
            className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-ink-faint"
            aria-hidden="true"
          />
        )}
      </div>
      {/* Celular: filtros em chips roláveis numa linha só; desktop: em linha. */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
      {selects.map((select, index) => (
        <Select
          key={select.param}
          items={select.items}
          value={select.value}
          onValueChange={(value: string | null) => {
            if (value) {
              apply(
                text,
                values.map((v, i) => (i === index ? value : v)),
              )
            }
          }}
        >
          <SelectTrigger
            aria-label={select.ariaLabel}
            className={cn(
              "shrink-0 rounded-full",
              select.triggerClassName ?? "md:min-w-36",
              select.value !== select.defaultValue &&
                "border-transparent bg-ink text-void hover:border-transparent [&_svg]:text-void/60",
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(select.items).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      {hasFilters && (
        <Button
          variant="ghost"
          className="shrink-0"
          onClick={() => {
            setText("")
            apply(
              "",
              selects.map((s) => s.defaultValue),
            )
          }}
        >
          <XIcon aria-hidden="true" />
          Limpar filtros
        </Button>
      )}
      </div>
    </div>
  )
}
