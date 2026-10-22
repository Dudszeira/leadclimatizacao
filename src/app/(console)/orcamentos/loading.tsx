import { Skeleton } from "@/components/ui/skeleton"
import { QuoteKpisSkeleton, QuotesListSkeleton } from "@/components/orcamentos/skeletons"

export default function OrcamentosLoading() {
  return (
    <div className="flex flex-1 flex-col" aria-busy="true">
      <div className="flex flex-col gap-4 pb-6 md:flex-row md:items-end md:justify-between md:pb-8">
        <div className="space-y-2.5">
          <Skeleton className="h-8 w-44 md:h-10" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-11 w-full rounded-full md:h-9 md:w-40" />
      </div>
      <div className="flex flex-col gap-6 md:gap-8">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-11 w-32 rounded-full md:h-9" />
          </div>
          <QuoteKpisSkeleton />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-11 w-full rounded-full sm:w-[30rem] md:h-10" />
          <Skeleton className="h-11 w-full rounded-xl md:h-10 md:max-w-xs" />
          <QuotesListSkeleton />
        </div>
      </div>
    </div>
  )
}
