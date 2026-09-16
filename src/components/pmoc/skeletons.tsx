import { Skeleton } from "@/components/ui/skeleton"
import { StatCardSkeleton } from "@/components/stat-card-skeleton"

/** Skeleton dos 3 cards + grid do calendário + lista de atenção imediata. */
export function PmocSectionSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4" aria-hidden="true">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Desktop: grid 7 colunas */}
      <div className="overflow-hidden rounded-xl border border-line bg-console max-md:hidden">
        <div className="grid grid-cols-7 border-b border-line-soft">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex justify-center px-2 py-2.5">
              <Skeleton className="h-3 w-8" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-line-soft">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="flex min-h-24 flex-col gap-1.5 bg-console p-1.5">
              <Skeleton className="ml-auto size-4 rounded-full" />
              {i % 5 === 1 && <Skeleton className="h-4 w-full rounded" />}
              {i % 7 === 3 && <Skeleton className="h-4 w-4/5 rounded" />}
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: lista agrupada por dia */}
      <div className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-line bg-console">
            <div className="border-b border-line-soft px-3 py-2.5">
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="divide-y divide-line-soft">
              {Array.from({ length: 2 }).map((_, j) => (
                <div key={j} className="flex items-center gap-2.5 px-3 py-3">
                  <Skeleton className="size-2 rounded-full" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-console">
        <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="divide-y divide-line-soft">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 flex-1 max-w-72" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
