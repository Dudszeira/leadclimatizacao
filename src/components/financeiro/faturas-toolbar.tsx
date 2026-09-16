"use client"

import type { InvoiceStatus } from "@/lib/types"
import { FilterToolbar } from "@/components/filter-toolbar"
import { INVOICE_STATUS_META } from "@/lib/status-meta"

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

/** Busca + filtros de status/competência das faturas (refletidos na URL). */
export function FaturasToolbar({
  q,
  status,
  competencia,
  competencias,
}: FaturasToolbarProps) {
  const competenciaItems: Record<string, string> = {
    todas: "Todas as competências",
    ...Object.fromEntries(competencias.map((c) => [c.value, c.label])),
  }

  return (
    <FilterToolbar
      q={q}
      searchPlaceholder="Buscar por cliente ou nº da NFS-e"
      searchAriaLabel="Buscar faturas"
      selects={[
        {
          param: "status",
          value: status,
          defaultValue: "todos",
          items: STATUS_ITEMS,
          ariaLabel: "Filtrar por status",
        },
        {
          param: "competencia",
          value: competencia || "todas",
          defaultValue: "todas",
          items: competenciaItems,
          ariaLabel: "Filtrar por competência",
          triggerClassName: "min-w-44",
        },
      ]}
    />
  )
}
