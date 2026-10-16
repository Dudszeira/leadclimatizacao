import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCardSkeleton } from "@/components/stat-card-skeleton"

/** Skeleton da seção PMOC: 4 cards, calendário (grade/agenda), atenção e planos. */
export function PmocSectionSkeleton() {
  return (
    <div className="flex flex-col gap-6 md:gap-8" aria-hidden="true">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Desktop: grade de 7 colunas */}
      <Card className="hidden gap-0 py-0 md:flex">
        <div className="grid grid-cols-7 border-b border-line-soft">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="px-3 py-3.5">
              <Skeleton className="h-3 w-8" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-line-soft">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="flex min-h-28 flex-col gap-1.5 bg-console p-2">
              <Skeleton className="size-7 rounded-full" />
              {i % 5 === 1 && <Skeleton className="h-6 w-full rounded-full" />}
              {i % 7 === 3 && <Skeleton className="h-6 w-4/5 rounded-full" />}
            </div>
          ))}
        </div>
      </Card>

      {/* Celular: faixa de dias + agenda */}
      <Card className="gap-0 py-0 md:hidden">
        <div className="flex items-center justify-between px-4 pt-4">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-11 w-32 rounded-full" />
        </div>
        <div className="flex gap-1.5 overflow-hidden px-4 py-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-[4.5rem] w-12 shrink-0 rounded-2xl" />
          ))}
        </div>
        <div className="space-y-3 border-t border-line-soft px-4 py-4">
          <Skeleton className="h-4 w-44" />
          {Array.from({ length: 2 }).map((_, j) => (
            <div key={j} className="flex items-center gap-3 py-2">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3.5 w-48" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </Card>

      <Card className="gap-0">
        <div className="flex flex-col gap-3 px-(--card-spacing) md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3.5 w-72 max-w-full" />
          </div>
          <Skeleton className="h-11 w-full rounded-full md:h-9 md:w-40" />
        </div>
        <div className="mt-4 divide-y divide-line-soft">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-(--card-spacing) py-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 max-w-72 flex-1" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
