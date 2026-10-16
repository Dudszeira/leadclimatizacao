import { Skeleton } from "@/components/ui/skeleton"
import { PmocSectionSkeleton } from "@/components/pmoc/skeletons"

export default function PmocLoading() {
  return (
    <div className="flex flex-1 flex-col" aria-busy="true">
      <div className="flex flex-col gap-4 pb-6 md:flex-row md:items-end md:justify-between md:gap-8 md:pb-8">
        <div className="space-y-2.5">
          <Skeleton className="h-8 w-60 md:h-10 md:w-72" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="size-11 rounded-full md:size-9" />
          <Skeleton className="h-11 flex-1 rounded-full md:h-9 md:w-44 md:flex-none" />
          <Skeleton className="size-11 rounded-full md:size-9" />
        </div>
      </div>
      <PmocSectionSkeleton />
    </div>
  )
}
