"use client"

import * as React from "react"
import { cn } from "cn"
import { SearchIcon, SearchXIcon, XIcon } from "lucide-react"

import { EQUIPMENT_STATUS_META } from "@/lib/status-meta"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  buildingAddress,
  clientName,
  type MapaBuilding,
} from "@/components/mapa/status"

export type MapaPanelProps = {
  /** Prédios já filtrados pela busca e pelo chip de situação. */
  buildings: MapaBuilding[]
  totalCount: number
  query: string
  onQueryChange: (value: string) => void
  /** true quando um chip de situação (não "Todos") está ativo. */
  filtrado: boolean
  selectedId: string | null
  onSelect: (id: string) => void
}

function equipamentos(n: number): string {
  return n === 1 ? "1 equipamento" : `${n} equipamentos`
}

/**
 * Painel do mapa: busca e lista de prédios. Usado na coluna direita
 * (desktop) e dentro da gaveta inferior (celular).
 */
export function MapaPanel({
  buildings,
  totalCount,
  query,
  onQueryChange,
  filtrado,
  selectedId,
  onSelect,
}: MapaPanelProps) {
  const inputId = React.useId()

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-faint"
          aria-hidden="true"
        />
        <Input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Buscar prédio, cliente ou endereço"
          aria-label="Buscar prédio por nome, cliente ou endereço"
          className="pr-11 pl-10 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute top-1/2 right-1 -translate-y-1/2"
            aria-label="Limpar busca"
            onClick={() => onQueryChange("")}
          >
            <XIcon />
          </Button>
        )}
      </div>

      <section aria-label="Lista de prédios no mapa" className="flex min-h-0 flex-1 flex-col">
        <p className="px-1 pb-1 text-[0.8125rem] text-ink-dim tabular-nums" aria-live="polite">
          {buildings.length === totalCount
            ? `${totalCount} ${totalCount === 1 ? "prédio" : "prédios"}`
            : `${buildings.length} de ${totalCount} prédios`}
        </p>

        {buildings.length === 0 ? (
          <div className="mt-2 flex flex-col items-center gap-2 rounded-2xl bg-console-2/60 px-4 py-8 text-center">
            <SearchXIcon className="size-5 text-ink-faint" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-ink-dim">
              {query ? (
                <>
                  Nenhum prédio encontrado para{" "}
                  <span className="text-ink">&ldquo;{query}&rdquo;</span>
                  {filtrado ? " nesta situação." : "."}
                </>
              ) : (
                "Nenhum prédio nesta situação."
              )}
            </p>
          </div>
        ) : (
          <ul className="scroll-contain -mx-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1">
            {buildings.map((b) => {
              const ativo = selectedId === b.id
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(b.id)}
                    aria-label={`Ver ${b.nome} no mapa, ${EQUIPMENT_STATUS_META[b.pin_status].label}`}
                    aria-current={ativo ? "true" : undefined}
                    className={cn(
                      "w-full cursor-pointer rounded-2xl px-3 py-3 text-left transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-signal/50",
                      ativo ? "bg-console-3" : "hover:bg-console-2 active:bg-console-2"
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          EQUIPMENT_STATUS_META[b.pin_status].dotClassName
                        )}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-medium text-ink">
                        {b.nome}
                      </span>
                      <span className="shrink-0 text-xs text-ink-faint tabular-nums">
                        {equipamentos(b.equipment_total)}
                      </span>
                    </span>
                    <span className="mt-1 block truncate pl-[1.125rem] text-[0.8125rem] text-ink-dim">
                      {clientName(b)}
                    </span>
                    <span className="mt-0.5 block truncate pl-[1.125rem] text-xs text-ink-faint">
                      {buildingAddress(b)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
