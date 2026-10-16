import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/** Skeleton de um StatCard (label + ícone, valor grande, sublinha). */
export function StatCardSkeleton() {
  return (
    <Card size="sm" className="gap-0">
      <div className="flex items-start justify-between gap-2 px-(--card-spacing)">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="size-4 rounded-full" />
      </div>
      <Skeleton className="mx-(--card-spacing) mt-4 h-8 w-24" />
      <Skeleton className="mx-(--card-spacing) mt-3 h-3 w-32" />
    </Card>
  )
}
