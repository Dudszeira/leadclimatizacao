import { Skeleton } from "@/components/ui/skeleton"
import {
  ClientsTableSkeleton,
  PageHeaderSkeleton,
} from "@/components/clientes/skeletons"

export default function ClientesLoading() {
  return (
    <div className="flex flex-1 flex-col" aria-busy="true">
      <PageHeaderSkeleton actions={3} />
      <div className="-mt-1 mb-6 flex flex-col gap-3 md:mb-8 md:flex-row md:items-center md:gap-2">
        <Skeleton className="h-11 w-full rounded-xl md:h-10 md:max-w-xs" />
        <div className="flex gap-2">
          <Skeleton className="h-11 w-36 rounded-full md:h-10" />
          <Skeleton className="h-11 w-36 rounded-full md:h-10" />
        </div>
      </div>
      <ClientsTableSkeleton />
    </div>
  )
}
