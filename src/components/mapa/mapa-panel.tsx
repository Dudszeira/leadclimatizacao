"use client"

import * as React from "react"
import { cn } from "cn"
import { Building2Icon, SearchIcon, SearchXIcon, XIcon } from "lucide-react"

import type { EquipmentStatus } from "@/lib/types"
import { EQUIPMENT_STATUS_META } from "@/lib/status-meta"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  buildingAddress,
  clientName,
  LEGEND_ORDER,
  type MapaBuilding,
} from "@/components/mapa/status"

export type MapaPanelProps = {
  /** Prédios já filtrados pela busca. */
  buildings: MapaBuilding[]
  totalCount: number
  query: string
  onQueryChange: (value: string) => void
  legendCounts: Record<EquipmentStatus, number>
  selectedId: string | null
  onSelect: (id: string) => void
}

/**
 * Painel do mapa: busca, legenda com contadores e lista de prédios.
 * Usado na coluna direita (desktop) e dentro do Sheet (mobile).
 */
export function MapaPanel({
  buildings,
  totalCount,
  query,
  onQueryChange,
  legendCounts,
  selectedId,
  onSelect,
}: MapaPanelProps) {
  const inputId = React.useId()

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-faint"
          aria-hidden="true"
        />
        <Input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Buscar por nome ou endereço"
          aria-label="Buscar prédio por nome ou endereço"
          className="h-9 bg-console pl-8 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon-xs"
            className="absolute top-1/2 right-1.5 -translate-y-1/2 text-ink-faint"
            aria-label="Limpar busca"
            onClick={() => onQueryChange("")}
          >
            <XIcon />
          </Button>
        )}
      </div>

      <section aria-label="Legenda de status dos prédios">
        <h3 className="text-[0.6875rem] font-semibold tracking-[0.12em] text-ink-faint uppercase">
          Legenda
        </h3>
        <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
          {LEGEND_ORDER.map((status) => (
            <li
              key={status}
              className="flex items-center gap-2 text-xs text-ink-dim"
            >
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  EQUIPMENT_STATUS_META[status].dotClassName,
                )}
                aria-hidden="true"
              />
              <span className="flex-1 truncate">
                {EQUIPMENT_STATUS_META[status].label}
              </span>
              <span className="font-mono text-ink">{legendCounts[status]}</span>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-label="Lista de prédios no mapa"
        className="flex min-h-0 flex-1 flex-col"
      >
        <h3 className="text-[0.6875rem] font-semibold tracking-[0.12em] text-ink-faint uppercase">
          Prédios{" "}
          <span className="font-mono normal-case">
            {buildings.length}/{totalCount}
          </span>
        </h3>

        {buildings.length === 0 ? (
          <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-console/50 px-4 py-8 text-center">
            <SearchXIcon className="size-5 text-ink-faint" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-ink-dim">
              Nenhum prédio encontrado para{" "}
              <span className="text-ink">&ldquo;{query}&rdquo;</span>.
            </p>
          </div>
        ) : (
          <ul className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
            {buildings.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => onSelect(b.id)}
                  aria-label={`Ver ${b.nome} no mapa`}
                  aria-current={selectedId === b.id ? "true" : undefined}
                  className={cn(
                    "w-full rounded-xl border px-3 py-2.5 text-left transition-colors outline-none",
                    "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                    selectedId === b.id
                      ? "border-signal/50 bg-signal-dim"
                      : "border-line-soft bg-console hover:border-line hover:bg-console-2",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        EQUIPMENT_STATUS_META[b.pin_status].dotClassName,
                      )}
                      aria-hidden="true"
                    />
                    <span className="truncate text-sm font-medium text-ink">
                      {b.nome}
                    </span>
                    <span className="ml-auto flex shrink-0 items-center gap-1 font-mono text-[0.6875rem] text-ink-faint">
                      <Building2Icon className="size-3" aria-hidden="true" />
                      {b.equipment_total}
                    </span>
                  </span>
                  <span className="mt-1 block truncate text-xs text-ink-dim">
                    {clientName(b)}
                  </span>
                  <span className="mt-0.5 block truncate text-[0.6875rem] text-ink-faint">
                    {buildingAddress(b)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
