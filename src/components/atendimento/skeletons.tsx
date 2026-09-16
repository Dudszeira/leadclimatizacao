import { Skeleton } from "@/components/ui/skeleton"

/** Skeleton do módulo de atendimento (lista + thread), usado no loading e no Suspense. */
export function AtendimentoSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 gap-4" aria-hidden="true">
      <div className="flex w-full flex-col overflow-hidden rounded-xl border border-line bg-console md:w-80 md:shrink-0">
        <div className="flex flex-col gap-2 border-b border-line-soft p-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-8 w-56 max-w-full rounded-lg" />
        </div>
        <div className="divide-y divide-line-soft">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 px-3 py-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-3 w-5/6" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="hidden min-h-72 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-console md:flex">
        <div className="flex items-center gap-3 border-b border-line-soft px-4 py-2.5">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          <Skeleton className="h-14 w-2/3 self-start rounded-2xl" />
          <Skeleton className="h-16 w-2/3 self-end rounded-2xl" />
          <Skeleton className="h-6 w-64 max-w-full self-center rounded-full" />
          <Skeleton className="h-14 w-1/2 self-end rounded-2xl" />
        </div>
        <div className="flex items-end gap-2 border-t border-line-soft p-3">
          <Skeleton className="h-11 flex-1" />
          <Skeleton className="size-11" />
        </div>
      </div>
      <div className="hidden w-72 shrink-0 flex-col gap-4 rounded-xl border border-line bg-console p-4 xl:flex">
        <Skeleton className="h-7 w-40" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
        <div className="mt-auto space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    </div>
  )
}
