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
        className="flex size-14 animate-pulse items-center justify-center rounded-2xl border border-line-soft bg-console-2"
        aria-hidden="true"
      >
        <MapPinnedIcon className="size-7 text-ink-faint" />
      </div>
      <p className="text-sm text-ink-dim">Carregando mapa…</p>
    </div>
  )
}

/** Skeleton do painel lateral (busca + legenda + lista). */
export function MapPanelSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4" aria-busy="true">
      <Skeleton className="h-9 w-full" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    </div>
  )
}
