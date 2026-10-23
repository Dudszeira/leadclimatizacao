import { Skeleton } from "@/components/ui/skeleton"
import { QuotesListSkeleton } from "@/components/orcamentos/skeletons"

export default function CatalogoLoading() {
  return (
    <div className="flex flex-1 flex-col" aria-busy="true">
      <Skeleton className="mb-3 h-9 w-32 rounded-full" />
      <div className="flex flex-col gap-4 pb-6 md:flex-row md:items-end md:justify-between md:pb-8">
        <div className="space-y-2.5">
          <Skeleton className="h-8 w-40 md:h-10" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-11 w-full rounded-full md:h-9 md:w-32" />
      </div>
      <QuotesListSkeleton />
    </div>
  )
}
