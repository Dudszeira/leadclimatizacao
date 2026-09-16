"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { LoaderCircleIcon, SearchIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SEGMENTO_LABELS } from "@/components/clientes/format"

export type StatusFilter = "todos" | "ativos" | "inativos"

const STATUS_ITEMS: Record<StatusFilter, string> = {
  todos: "Todos os status",
  ativos: "Ativos",
  inativos: "Inativos",
}

const TIPO_ITEMS: Record<string, string> = {
  todos: "Todos os tipos",
  ...SEGMENTO_LABELS,
}

type ClientsToolbarProps = {
  q: string
  status: StatusFilter
  tipo: string
}

/**
 * Busca com debounce + filtros de status e tipo, tudo refletido na URL
 * (searchParams) para o server component refazer a consulta.
 */
export function ClientsToolbar({ q, status, tipo }: ClientsToolbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [text, setText] = React.useState(q)
  const [isPending, startTransition] = React.useTransition()
  const lastAppliedQ = React.useRef(q)

  const apply = React.useCallback(
    (next: { q: string; status: StatusFilter; tipo: string }) => {
      lastAppliedQ.current = next.q
      const params = new URLSearchParams()
      if (next.q) params.set("q", next.q)
      if (next.status !== "todos") params.set("status", next.status)
      if (next.tipo !== "todos") params.set("tipo", next.tipo)
      const qs = params.toString()
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      })
    },
    [pathname, router],
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
    const timer = setTimeout(() => apply({ q: text, status, tipo }), 350)
    return () => clearTimeout(timer)
  }, [text, q, status, tipo, apply])

  const hasFilters = q !== "" || status !== "todos" || tipo !== "todos"

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full min-w-0 sm:max-w-xs">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-faint"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Buscar por razão social, CNPJ ou contato"
          aria-label="Buscar clientes"
          className="h-9 pl-8 max-md:h-11 [&::-webkit-search-cancel-button]:hidden"
        />
        {isPending && (
          <LoaderCircleIcon
            className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-ink-faint"
            aria-hidden="true"
          />
        )}
      </div>
      <Select
        items={STATUS_ITEMS}
        value={status}
        onValueChange={(value: StatusFilter | null) => {
          if (value) apply({ q: text, status: value, tipo })
        }}
      >
        <SelectTrigger
          aria-label="Filtrar por status"
          className="h-9 min-w-36 max-md:h-11"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(STATUS_ITEMS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        items={TIPO_ITEMS}
        value={tipo}
        onValueChange={(value: string | null) => {
          if (value) apply({ q: text, status, tipo: value })
        }}
      >
        <SelectTrigger
          aria-label="Filtrar por tipo"
          className="h-9 min-w-36 max-md:h-11"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(TIPO_ITEMS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hasFilters && (
        <Button
          variant="ghost"
          className="h-9 px-2.5 text-ink-dim max-md:h-11"
          onClick={() => {
            setText("")
            apply({ q: "", status: "todos", tipo: "todos" })
          }}
        >
          <XIcon aria-hidden="true" />
          Limpar filtros
        </Button>
      )}
    </div>
  )
}
