import { MapPinnedIcon } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"

/** Placeholder exibido enquanto o bundle do Leaflet carrega no cliente. */
export function MapCanvasSkeleton() {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-console"
      aria-busy="true"
      aria-label="Carregando mapa"
    >
      <div
        className="flex size-12 animate-pulse items-center justify-center rounded-full bg-console-2"
        aria-hidden="true"
      >
        <MapPinnedIcon className="size-5 text-ink-faint" />
      </div>
      <p className="text-sm text-ink-dim">Carregando mapa…</p>
    </div>
  )
}

/** Skeleton do painel de prédios (busca + lista). */
export function MapPanelSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4" aria-busy="true">
      <Skeleton className="h-11 w-full rounded-xl md:h-10" />
      <Skeleton className="h-4 w-28" />
      <div className="space-y-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2 px-3 py-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        ))}
      </div>
    </div>
  )
}
