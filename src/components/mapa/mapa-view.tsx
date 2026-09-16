"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { ListIcon } from "lucide-react"

import type { EquipmentStatus } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { MapCanvasSkeleton } from "@/components/mapa/map-skeleton"
import { MapaPanel } from "@/components/mapa/mapa-panel"
import {
  buildingAddress,
  clientName,
  normalizeSearch,
  type MapaBuilding,
} from "@/components/mapa/status"

// react-leaflet não renderiza no servidor — só cliente, com skeleton no meio-tempo.
const MapaCanvas = dynamic(() => import("@/components/mapa/mapa-canvas"), {
  ssr: false,
  loading: () => <MapCanvasSkeleton />,
})

type Focus = { id: string; nonce: number }

export type MapaViewProps = {
  buildings: MapaBuilding[]
}

/** Tela do Mapa de Equipamentos: mapa + painel (coluna no desktop, Sheet no mobile). */
export function MapaView({ buildings }: MapaViewProps) {
  const [query, setQuery] = React.useState("")
  const [focus, setFocus] = React.useState<Focus | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)

  const filtered = React.useMemo(() => {
    const term = normalizeSearch(query.trim())
    if (!term) return buildings
    return buildings.filter((b) =>
      normalizeSearch(`${b.nome} ${buildingAddress(b)} ${clientName(b)} ${b.client.razao_social}`)
        .includes(term),
    )
  }, [buildings, query])

  const legendCounts = React.useMemo(() => {
    const counts: Record<EquipmentStatus, number> = {
      operacional: 0,
      chamado_aberto: 0,
      tecnico_em_campo: 0,
      inativo: 0,
    }
    for (const b of filtered) counts[b.pin_status] += 1
    return counts
  }, [filtered])

  const handleSelect = React.useCallback((id: string) => {
    setFocus((prev) => ({ id, nonce: (prev?.nonce ?? 0) + 1 }))
    setSheetOpen(false)
  }, [])

  const panel = (
    <MapaPanel
      buildings={filtered}
      totalCount={buildings.length}
      query={query}
      onQueryChange={setQuery}
      legendCounts={legendCounts}
      selectedId={focus?.id ?? null}
      onSelect={handleSelect}
    />
  )

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-2xl border border-line bg-console">
        <MapaCanvas buildings={filtered} focus={focus} />

        {/* Trigger flutuante do painel — só mobile (44px). */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger
            render={
              <Button
                size="icon"
                className="absolute right-4 bottom-4 z-[1000] size-11 rounded-full shadow-lg shadow-black/40 md:hidden"
                aria-label="Abrir painel de prédios"
              />
            }
          >
            <ListIcon className="size-5" aria-hidden="true" />
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-[85vw] max-w-sm border-line bg-console p-4"
          >
            <SheetHeader className="p-0">
              <SheetTitle className="font-display text-ink">
                Prédios no mapa
              </SheetTitle>
              <SheetDescription className="text-ink-dim">
                Busque e toque em um prédio para localizá-lo no mapa.
              </SheetDescription>
            </SheetHeader>
            {panel}
          </SheetContent>
        </Sheet>
      </div>

      {/* Painel fixo — só desktop. */}
      <aside
        className="hidden w-80 shrink-0 flex-col rounded-2xl border border-line bg-console/50 p-4 md:flex"
        aria-label="Painel de prédios do mapa"
      >
        {panel}
      </aside>
    </div>
  )
}
