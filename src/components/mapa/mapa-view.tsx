"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { cn } from "cn"
import { ChevronUpIcon } from "lucide-react"

import type { EquipmentStatus } from "@/lib/types"
import { EQUIPMENT_STATUS_META } from "@/lib/status-meta"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { MapCanvasSkeleton } from "@/components/mapa/map-skeleton"
import { MapaPanel } from "@/components/mapa/mapa-panel"
import {
  buildingAddress,
  clientName,
  emptyStatusCounts,
  LEGEND_ORDER,
  normalizeSearch,
  type MapaBuilding,
} from "@/components/mapa/status"

// react-leaflet não renderiza no servidor: só cliente, com skeleton no meio-tempo.
const MapaCanvas = dynamic(() => import("@/components/mapa/mapa-canvas"), {
  ssr: false,
  loading: () => <MapCanvasSkeleton />,
})

type Focus = { id: string; nonce: number }
type Filtro = EquipmentStatus | "todos"

export type MapaViewProps = {
  buildings: MapaBuilding[]
}

function plural(n: number): string {
  return n === 1 ? "1 prédio" : `${n} prédios`
}

/**
 * Tela do Mapa de Equipamentos: chips de status, mapa e painel de prédios
 * (coluna lateral no desktop; gaveta que sobe do rodapé no celular).
 */
/** Nome curto do status ao lado da contagem (não depender só da cor). */
const RESUMO_CURTO: Record<keyof typeof EQUIPMENT_STATUS_META, string> = {
  operacional: "ok",
  chamado_aberto: "chamado",
  tecnico_em_campo: "em campo",
  inativo: "inativo",
}

export function MapaView({ buildings }: MapaViewProps) {
  const [query, setQuery] = React.useState("")
  const [filtro, setFiltro] = React.useState<Filtro>("todos")
  const [focus, setFocus] = React.useState<Focus | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  // Foco inicial no título da gaveta: não abre o teclado do celular na busca.
  const sheetTitleRef = React.useRef<HTMLHeadingElement>(null)

  // Busca primeiro (os chips mostram a contagem dentro da busca), status depois.
  const buscados = React.useMemo(() => {
    const term = normalizeSearch(query.trim())
    if (!term) return buildings
    return buildings.filter((b) =>
      normalizeSearch(
        `${b.nome} ${buildingAddress(b)} ${clientName(b)} ${b.client.razao_social}`
      ).includes(term)
    )
  }, [buildings, query])

  const counts = React.useMemo(() => {
    const c = emptyStatusCounts()
    for (const b of buscados) c[b.pin_status] += 1
    return c
  }, [buscados])

  const visiveis = React.useMemo(
    () => (filtro === "todos" ? buscados : buscados.filter((b) => b.pin_status === filtro)),
    [buscados, filtro]
  )

  const handleSelect = React.useCallback((id: string) => {
    setFocus((prev) => ({ id, nonce: (prev?.nonce ?? 0) + 1 }))
    setSheetOpen(false)
  }, [])

  const panelProps = {
    buildings: visiveis,
    totalCount: buildings.length,
    query,
    onQueryChange: setQuery,
    filtrado: filtro !== "todos",
    selectedId: focus?.id ?? null,
    onSelect: handleSelect,
  }

  const chips: { value: Filtro; label: string; count: number; dot?: string }[] = [
    { value: "todos", label: "Todos", count: buscados.length },
    ...LEGEND_ORDER.map((s) => ({
      value: s as Filtro,
      label: EQUIPMENT_STATUS_META[s].label,
      count: counts[s],
      dot: EQUIPMENT_STATUS_META[s].dotClassName,
    })),
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        role="group"
        aria-label="Filtrar prédios por situação"
        className="no-scrollbar -mx-4 flex shrink-0 gap-2 overflow-x-auto px-4 pb-3 md:mx-0 md:flex-wrap md:px-0 md:pb-4"
      >
        {chips.map((chip) => {
          const ativo = filtro === chip.value
          return (
            <button
              key={chip.value}
              type="button"
              aria-pressed={ativo}
              onClick={() => setFiltro(chip.value)}
              className={cn(
                "inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-signal/50 md:h-9 md:px-3.5",
                ativo ? "bg-ink text-void" : "bg-console-2 text-ink-dim hover:bg-console-3 hover:text-ink"
              )}
            >
              {chip.dot && (
                <span className={cn("size-2 rounded-full", chip.dot)} aria-hidden="true" />
              )}
              {chip.label}
              <span className={cn("tabular-nums", ativo ? "text-void/60" : "text-ink-faint")}>
                {chip.count}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <div className="relative isolate min-h-0 flex-1 overflow-hidden rounded-[1.375rem] bg-console ring-1 ring-line">
          <MapaCanvas buildings={visiveis} focus={focus} />

          {/* Celular: alça da gaveta com o resumo; abre a lista de prédios. */}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            className="absolute inset-x-3 bottom-3 z-[1000] flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl bg-console-2/95 px-4 py-2.5 text-left shadow-[0_12px_32px_-8px_rgba(0,0,0,0.7)] ring-1 ring-line backdrop-blur-xl outline-none focus-visible:ring-3 focus-visible:ring-signal/50 md:hidden"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-medium text-ink">
                {plural(visiveis.length)}
                {visiveis.length !== buildings.length && (
                  <span className="font-normal text-ink-faint"> de {buildings.length}</span>
                )}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-dim">
                {LEGEND_ORDER.filter((s) => counts[s] > 0).map((s) => (
                  <span key={s} className="inline-flex items-center gap-1.5 tabular-nums">
                    <span
                      className={cn("size-1.5 rounded-full", EQUIPMENT_STATUS_META[s].dotClassName)}
                      aria-hidden="true"
                    />
                    {counts[s]} {RESUMO_CURTO[s]}
                  </span>
                ))}
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-ink">
              Ver lista
              <ChevronUpIcon className="size-4" aria-hidden="true" />
            </span>
          </button>
        </div>

        {/* Desktop: painel lateral fixo. */}
        <aside
          className="hidden w-[21rem] shrink-0 flex-col rounded-[1.375rem] bg-console p-4 ring-1 ring-line md:flex lg:w-[23rem]"
          aria-label="Prédios no mapa"
        >
          <MapaPanel {...panelProps} />
        </aside>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          initialFocus={sheetTitleRef}
          className="h-[82dvh] gap-0 md:hidden"
        >
          <span
            aria-hidden="true"
            className="absolute top-2.5 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-line"
          />
          <SheetHeader className="pt-7 pb-3">
            <SheetTitle ref={sheetTitleRef} tabIndex={-1} className="text-xl outline-none">
              Prédios no mapa
            </SheetTitle>
            <SheetDescription>Toque em um prédio para localizá-lo no mapa.</SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <MapaPanel {...panelProps} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
