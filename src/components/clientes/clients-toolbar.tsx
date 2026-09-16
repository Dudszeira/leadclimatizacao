"use client"

import { FilterToolbar } from "@/components/filter-toolbar"
import { SEGMENTO_LABELS } from "@/lib/status-meta"

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

/** Busca + filtros de status e tipo da lista de clientes (refletidos na URL). */
export function ClientsToolbar({ q, status, tipo }: ClientsToolbarProps) {
  return (
    <FilterToolbar
      q={q}
      searchPlaceholder="Buscar por razão social, CNPJ ou contato"
      searchAriaLabel="Buscar clientes"
      selects={[
        {
          param: "status",
          value: status,
          defaultValue: "todos",
          items: STATUS_ITEMS,
          ariaLabel: "Filtrar por status",
        },
        {
          param: "tipo",
          value: tipo,
          defaultValue: "todos",
          items: TIPO_ITEMS,
          ariaLabel: "Filtrar por tipo",
        },
      ]}
    />
  )
}
