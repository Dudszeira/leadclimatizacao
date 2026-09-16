import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/** Skeleton de um StatCard (label + ícone, valor grande, sublinha). */
export function StatCardSkeleton() {
  return (
    <Card size="sm" className="gap-0">
      <div className="flex items-start justify-between gap-2 px-(--card-spacing)">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="size-8 rounded-lg" />
      </div>
      <Skeleton className="mx-(--card-spacing) mt-2 h-7 w-28" />
      <Skeleton className="mx-(--card-spacing) mt-2 h-3 w-36" />
    </Card>
  )
}
