import { Skeleton } from "@/components/ui/skeleton"
import {
  FaturasTableSkeleton,
  FinanceiroKpisSkeleton,
} from "@/components/financeiro/skeletons"

export default function FinanceiroLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4" aria-busy="true">
      <header className="space-y-2">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </header>
      <FinanceiroKpisSkeleton />
      <Skeleton className="h-10 w-52 rounded-lg" />
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-full sm:max-w-xs" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-44" />
      </div>
      <FaturasTableSkeleton />
    </div>
  )
}
