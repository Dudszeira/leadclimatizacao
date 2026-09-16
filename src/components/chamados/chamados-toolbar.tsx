"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { LoaderCircleIcon, SearchIcon, XIcon } from "lucide-react"

import type { OsPriority, OsStatus, OsType } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  OS_PRIORITY_META,
  OS_STATUS_META,
  OS_TYPE_META,
} from "@/components/chamados/format"

export type StatusParam = OsStatus | "todos"
export type TipoParam = OsType | "todos"
export type PrioridadeParam = OsPriority | "todos"

const STATUS_ITEMS: Record<string, string> = {
  todos: "Todos os status",
  ...Object.fromEntries(
    Object.entries(OS_STATUS_META).map(([value, meta]) => [value, meta.label]),
  ),
}

const TIPO_ITEMS: Record<string, string> = {
  todos: "Todos os tipos",
  ...Object.fromEntries(
    Object.entries(OS_TYPE_META).map(([value, meta]) => [value, meta.label]),
  ),
}

const PRIORIDADE_ITEMS: Record<string, string> = {
  todos: "Todas as prioridades",
  ...Object.fromEntries(
    Object.entries(OS_PRIORITY_META).map(([value, meta]) => [value, meta.label]),
  ),
}

type ChamadosToolbarProps = {
  q: string
  status: StatusParam
  tipo: TipoParam
  prioridade: PrioridadeParam
}

/**
 * Busca com debounce + filtros de status/tipo/prioridade refletidos na URL
 * (searchParams) para o server component refazer a consulta.
 */
export function ChamadosToolbar({
  q,
  status,
  tipo,
  prioridade,
}: ChamadosToolbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [text, setText] = React.useState(q)
  const [isPending, startTransition] = React.useTransition()
  const lastAppliedQ = React.useRef(q)

  const apply = React.useCallback(
    (next: {
      q: string
      status: StatusParam
      tipo: TipoParam
      prioridade: PrioridadeParam
    }) => {
      lastAppliedQ.current = next.q
      const params = new URLSearchParams()
      if (next.q) params.set("q", next.q)
      if (next.status !== "todos") params.set("status", next.status)
      if (next.tipo !== "todos") params.set("tipo", next.tipo)
      if (next.prioridade !== "todos") params.set("prioridade", next.prioridade)
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
    const timer = setTimeout(
      () => apply({ q: text, status, tipo, prioridade }),
      350,
    )
    return () => clearTimeout(timer)
  }, [text, q, status, tipo, prioridade, apply])

  const hasFilters =
    q !== "" || status !== "todos" || tipo !== "todos" || prioridade !== "todos"

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
          placeholder="Buscar por nº da OS ou descrição"
          aria-label="Buscar chamados"
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
        onValueChange={(value: StatusParam | null) => {
          if (value) apply({ q: text, status: value, tipo, prioridade })
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
        onValueChange={(value: TipoParam | null) => {
          if (value) apply({ q: text, status, tipo: value, prioridade })
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
      <Select
        items={PRIORIDADE_ITEMS}
        value={prioridade}
        onValueChange={(value: PrioridadeParam | null) => {
          if (value) apply({ q: text, status, tipo, prioridade: value })
        }}
      >
        <SelectTrigger
          aria-label="Filtrar por prioridade"
          className="h-9 min-w-40 max-md:h-11"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(PRIORIDADE_ITEMS).map(([value, label]) => (
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
            apply({ q: "", status: "todos", tipo: "todos", prioridade: "todos" })
          }}
        >
          <XIcon aria-hidden="true" />
          Limpar filtros
        </Button>
      )}
    </div>
  )
}
