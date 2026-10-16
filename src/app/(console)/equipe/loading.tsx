import { Skeleton } from "@/components/ui/skeleton"

export default function EquipeLoading() {
  return (
    <div className="flex flex-1 flex-col" aria-busy="true">
      <div className="flex flex-col gap-4 pb-6 md:flex-row md:items-end md:justify-between md:pb-8">
        <div className="space-y-3">
          <Skeleton className="h-8 w-32 md:h-10" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-11 w-full rounded-full md:h-9 md:w-40" />
      </div>
      <div className="flex flex-col gap-6 md:gap-8" aria-hidden="true">
        <Skeleton className="h-24 w-full rounded-[1.375rem] md:max-w-xl" />
        <div className="overflow-hidden rounded-[1.375rem] bg-console ring-1 ring-line">
          <div className="divide-y divide-line-soft">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5 md:px-5">
                <Skeleton className="size-10 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-40 max-w-full" />
                  <Skeleton className="h-3 w-52 max-w-full" />
                </div>
                <Skeleton className="hidden h-6 w-24 rounded-full md:block" />
                <Skeleton className="hidden h-6 w-16 rounded-full md:block" />
                <Skeleton className="size-9 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
