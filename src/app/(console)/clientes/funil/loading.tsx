import { Skeleton } from "@/components/ui/skeleton"

export default function FunilLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4" aria-busy="true">
      <Skeleton className="h-4 w-48" />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-28" />
      </header>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-72 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
