import { Skeleton } from "@/components/ui/skeleton"
import { PmocSectionSkeleton } from "@/components/pmoc/skeletons"

export default function PmocLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4" aria-busy="true">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton className="size-9" />
          <Skeleton className="h-5 w-36" />
          <Skeleton className="size-9" />
        </div>
      </header>
      <PmocSectionSkeleton />
    </div>
  )
}
