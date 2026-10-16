import { Skeleton } from "@/components/ui/skeleton"
import { ChamadosTableSkeleton } from "@/components/chamados/skeletons"

export default function ChamadosLoading() {
  return (
    <div className="flex flex-1 flex-col" aria-busy="true">
      <div className="flex flex-col gap-5 pb-6 md:pb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2.5">
            <Skeleton className="h-8 w-44 md:h-10" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <Skeleton className="h-11 w-full rounded-full md:h-9 md:w-36" />
        </div>
        <Skeleton className="h-11 w-full rounded-full sm:w-96 md:h-10" />
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-2">
          <Skeleton className="h-11 w-full rounded-xl md:h-10 md:max-w-xs" />
          <div className="flex gap-2 overflow-hidden">
            <Skeleton className="h-11 w-36 shrink-0 rounded-full md:h-10" />
            <Skeleton className="h-11 w-36 shrink-0 rounded-full md:h-10" />
            <Skeleton className="h-11 w-40 shrink-0 rounded-full md:h-10" />
          </div>
        </div>
        <ChamadosTableSkeleton />
      </div>
    </div>
  )
}
