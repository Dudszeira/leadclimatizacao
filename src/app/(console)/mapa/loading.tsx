import { MapPinnedIcon } from "lucide-react"

import { MapPanelSkeleton } from "@/components/mapa/map-skeleton"

export default function MapaLoading() {
  return (
    <div className="flex min-h-0 flex-1 gap-4" aria-busy="true">
      <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-2xl border border-line bg-console">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div
            className="flex size-14 animate-pulse items-center justify-center rounded-2xl border border-line-soft bg-console-2"
            aria-hidden="true"
          >
            <MapPinnedIcon className="size-7 text-ink-faint" />
          </div>
          <p className="text-sm text-ink-dim">Carregando mapa…</p>
        </div>
      </div>
      <aside className="hidden w-80 shrink-0 flex-col rounded-2xl border border-line bg-console/50 p-4 md:flex">
        <MapPanelSkeleton />
      </aside>
    </div>
  )
}
