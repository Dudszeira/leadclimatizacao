import { Skeleton } from "@/components/ui/skeleton"

export default function CampoLoading() {
  return (
    <div className="flex flex-1 flex-col" aria-busy="true">
      <div className="flex flex-col gap-5 pb-6 md:pb-8">
        <div className="space-y-2.5">
          <Skeleton className="h-8 w-40 md:h-10" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex gap-2 overflow-hidden">
          <Skeleton className="h-11 w-20 shrink-0 rounded-full md:h-10" />
          <Skeleton className="h-11 w-32 shrink-0 rounded-full md:h-10" />
          <Skeleton className="h-11 w-32 shrink-0 rounded-full md:h-10" />
        </div>
      </div>
      <Skeleton className="mb-3 h-6 w-36" />
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-4 rounded-[1.375rem] bg-console p-4 ring-1 ring-line md:p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="space-y-2.5">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-full" />
            </div>
            <Skeleton className="h-12 w-full rounded-full" />
            <Skeleton className="h-12 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
