import { Skeleton } from "@/components/ui/skeleton"
import { ClientsTableSkeleton } from "@/components/clientes/skeletons"

export default function ClientesLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4" aria-busy="true">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-32" />
      </header>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-full sm:max-w-xs" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-36" />
      </div>
      <ClientsTableSkeleton />
    </div>
  )
}
