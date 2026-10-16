import { Skeleton } from "@/components/ui/skeleton"
import { MapCanvasSkeleton, MapPanelSkeleton } from "@/components/mapa/map-skeleton"
import { MAPA_TELA_CLASS } from "@/components/mapa/status"

export default function MapaLoading() {
  return (
    <div className={MAPA_TELA_CLASS} aria-busy="true">
      <div className="space-y-2.5 pb-4 md:pb-6">
        <Skeleton className="h-8 w-64 md:h-10 md:w-80" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="flex gap-2 overflow-hidden pb-3 md:pb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-28 shrink-0 rounded-full md:h-9" />
        ))}
      </div>
      <div className="flex min-h-0 flex-1 gap-4">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-[1.375rem] ring-1 ring-line">
          <MapCanvasSkeleton />
        </div>
        <aside className="hidden w-[21rem] shrink-0 flex-col rounded-[1.375rem] bg-console p-4 ring-1 ring-line md:flex">
          <MapPanelSkeleton />
        </aside>
      </div>
    </div>
  )
}
