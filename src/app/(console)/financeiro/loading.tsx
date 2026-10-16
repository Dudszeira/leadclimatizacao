import { Skeleton } from "@/components/ui/skeleton"
import {
  FaturasTableSkeleton,
  FaturasToolbarSkeleton,
  FinanceiroKpisSkeleton,
} from "@/components/financeiro/skeletons"

export default function FinanceiroLoading() {
  return (
    <div className="flex flex-1 flex-col" aria-busy="true">
      <div className="flex flex-col gap-4 pb-6 md:flex-row md:items-end md:justify-between md:pb-8">
        <div className="space-y-3">
          <Skeleton className="h-8 w-40 md:h-10 md:w-48" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex flex-col gap-2 md:flex-row">
          <Skeleton className="h-11 w-full rounded-full md:h-9 md:w-44" />
          <Skeleton className="h-11 w-full rounded-full md:h-9 md:w-48" />
        </div>
      </div>
      <div className="flex flex-col gap-6 md:gap-8">
        <FinanceiroKpisSkeleton />
        <div className="flex gap-6 border-b border-line-soft pb-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex flex-col gap-4">
          <FaturasToolbarSkeleton />
          <FaturasTableSkeleton />
        </div>
      </div>
    </div>
  )
}
