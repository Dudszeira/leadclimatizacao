"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { LoaderCircleIcon, SearchIcon, XIcon } from "lucide-react"

import type { InvoiceStatus } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { INVOICE_STATUS_META } from "@/components/financeiro/format"

export type StatusParam = InvoiceStatus | "todos"

export type CompetenciaOption = { value: string; label: string }

const STATUS_ITEMS: Record<string, string> = {
  todos: "Todos os status",
  ...Object.fromEntries(
    Object.entries(INVOICE_STATUS_META).map(([value, meta]) => [value, meta.label]),
  ),
}

type FaturasToolbarProps = {
  q: string
  status: StatusParam
  /** "" = todas as competências. */
  competencia: string
  competencias: CompetenciaOption[]
}

/**
 * Busca com debounce + filtros de status/competência refletidos na URL
 * (searchParams) para o server component refazer a consulta — mesmo padrão
 * da ChamadosToolbar.
 */
export function FaturasToolbar({
  q,
  status,
  competencia,
  competencias,
}: FaturasToolbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [text, setText] = React.useState(q)
  const [isPending, startTransition] = React.useTransition()
  const lastAppliedQ = React.useRef(q)

  const competenciaItems: Record<string, string> = React.useMemo(
    () => ({
      todas: "Todas as competências",
      ...Object.fromEntries(competencias.map((c) => [c.value, c.label])),
    }),
    [competencias],
  )

  const apply = React.useCallback(
    (next: { q: string; status: StatusParam; competencia: string }) => {
      lastAppliedQ.current = next.q
      const params = new URLSearchParams()
      if (next.q) params.set("q", next.q)
      if (next.status !== "todos") params.set("status", next.status)
      if (next.competencia) params.set("competencia", next.competencia)
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
    const timer = setTimeout(() => apply({ q: text, status, competencia }), 350)
    return () => clearTimeout(timer)
  }, [text, q, status, competencia, apply])

  const hasFilters = q !== "" || status !== "todos" || competencia !== ""

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
          placeholder="Buscar por cliente ou nº da NFS-e"
          aria-label="Buscar faturas"
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
          if (value) apply({ q: text, status: value, competencia })
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
        items={competenciaItems}
        value={competencia || "todas"}
        onValueChange={(value: string | null) => {
          if (value) {
            apply({
              q: text,
              status,
              competencia: value === "todas" ? "" : value,
            })
          }
        }}
      >
        <SelectTrigger
          aria-label="Filtrar por competência"
          className="h-9 min-w-44 max-md:h-11"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(competenciaItems).map(([value, label]) => (
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
            apply({ q: "", status: "todos", competencia: "" })
          }}
        >
          <XIcon aria-hidden="true" />
          Limpar filtros
        </Button>
      )}
    </div>
  )
}
