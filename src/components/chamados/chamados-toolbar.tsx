"use client"

import type { OsPriority, OsStatus, OsType } from "@/lib/types"
import { FilterToolbar } from "@/components/filter-toolbar"
import {
  OS_PRIORITY_META,
  OS_STATUS_META,
  OS_TYPE_META,
} from "@/lib/status-meta"

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

/** Busca + filtros de status/tipo/prioridade dos chamados (refletidos na URL). */
export function ChamadosToolbar({
  q,
  status,
  tipo,
  prioridade,
}: ChamadosToolbarProps) {
  return (
    <FilterToolbar
      q={q}
      searchPlaceholder="Buscar por nº da OS ou descrição"
      searchAriaLabel="Buscar chamados"
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
        {
          param: "prioridade",
          value: prioridade,
          defaultValue: "todos",
          items: PRIORIDADE_ITEMS,
          ariaLabel: "Filtrar por prioridade",
          triggerClassName: "min-w-40",
        },
      ]}
    />
  )
}
